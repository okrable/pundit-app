import { Handler } from '@netlify/functions';
import { query } from './lib/db';
import { authorizeUser } from './lib/auth';
import { enforceRateLimit } from './lib/rateLimit';
import { syncIdentityRecord } from './lib/identity';

// Username validation rules (same as checkUsername)
const USERNAME_REGEX = /^[a-z0-9][a-z0-9_]{1,18}[a-z0-9]$/;
const MIN_LENGTH = 3;
const MAX_LENGTH = 20;
const COOLDOWN_DAYS = 30;

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { userId, username } = JSON.parse(event.body || '{}');

    if (!userId || !username) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'userId and username are required' }),
      };
    }

    // Reject guest users
    if (userId.startsWith('guest_')) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ success: false, error: 'Sign in to set a username' }),
      };
    }

    const authorization = await authorizeUser(event, userId, headers);
    if (authorization.response) {
      return authorization.response;
    }

    const rateLimitError = await enforceRateLimit(event, headers, {
      scope: 'set-username',
      subject: userId,
      limit: 10,
      windowSeconds: 300,
    });
    if (rateLimitError) {
      return rateLimitError;
    }

    // Identity synchronization owns user-row creation. Calling this with signup
    // intent also keeps direct/older setUsername clients compatible.
    await syncIdentityRecord(authorization.user, 'signup');

    // Normalize for validation and storage
    const normalized = username.toLowerCase().trim();

    // Validate length
    if (normalized.length < MIN_LENGTH) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Username must be at least ${MIN_LENGTH} characters`,
        }),
      };
    }

    if (normalized.length > MAX_LENGTH) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Username must be at most ${MAX_LENGTH} characters`,
        }),
      };
    }

    // Validate format
    if (!USERNAME_REGEX.test(normalized)) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Only lowercase letters, numbers, and underscores (not at start/end)',
        }),
      };
    }

    // Check cooldown for existing users
    const user = await query<{
      username: string | null;
      username_last_changed_at: string | null;
    }>(
      'SELECT username, username_last_changed_at FROM users WHERE id = $1',
      [userId]
    );

    if (user.length > 0 && user[0].username_last_changed_at) {
      const lastChanged = new Date(user[0].username_last_changed_at);
      const cooldownEnd = new Date(lastChanged.getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
      const now = new Date();

      if (now < cooldownEnd) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: false,
            error: `Username can be changed again on ${cooldownEnd.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}`,
          }),
        };
      }
    }

    // Check if username is same as current (no-op)
    if (user.length > 0 && user[0].username?.toLowerCase() === normalized) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          username: user[0].username,
        }),
      };
    }

    // Atomic update with uniqueness check. Identity synchronization above
    // guarantees the user row exists.
    try {
      await query(
        `UPDATE users SET
           username = $2,
           username_normalized = $2,
           username_last_changed_at = NOW(),
           onboarding_status = 'complete'
         WHERE id = $1`,
        [userId, normalized]
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          username: normalized,
        }),
      };
    } catch (err: any) {
      // Unique constraint violation on username_normalized = username taken
      if (err.code === '23505' || err.message?.includes('duplicate key')) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Username is already taken',
          }),
        };
      }
      throw err;
    }
  } catch (error) {
    console.error('Error setting username:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
      }),
    };
  }
};
