import { Handler } from '@netlify/functions';
import { queryWithClient, withTransaction } from './lib/db';
import { authorizeUser } from './lib/auth';
import { enforceRateLimit } from './lib/rateLimit';
import { syncIdentityRecord } from './lib/identity';
import { chooseUsernameAssignmentAction } from '../../shared/identityPolicy';

// Username validation rules (same as checkUsername)
const USERNAME_REGEX = /^[a-z0-9][a-z0-9_]{1,18}[a-z0-9]$/;
const MIN_LENGTH = 3;
const MAX_LENGTH = 20;

async function assignUsernameOnce(userId: string, normalized: string) {
  return withTransaction(async (client) => {
    const users = await queryWithClient<{
      username: string | null;
      onboarding_status: 'username_required' | 'complete';
    }>(
      client,
      `SELECT username, onboarding_status
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [userId]
    );
    const current = users[0];
    if (!current) {
      throw new Error('Identity synchronization did not create a user row');
    }

    const action = chooseUsernameAssignmentAction({
      currentUsername: current.username,
      requestedUsername: normalized,
      onboardingStatus: current.onboarding_status,
    });

    if (action !== 'assign') {
      return { action, username: current.username };
    }

    const updated = await queryWithClient<{ username: string }>(
      client,
      `UPDATE users
       SET
         username = $2,
         username_normalized = $2,
         onboarding_status = 'complete'
       WHERE id = $1
         AND username IS NULL
         AND onboarding_status = 'username_required'
       RETURNING username`,
      [userId, normalized]
    );

    if (!updated[0]) {
      throw new Error('Username assignment lost its identity lock');
    }
    return { action, username: updated[0].username };
  });
}

async function assignUsername(userId: string, normalized: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await assignUsernameOnce(userId, normalized);
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String(error.code)
          : '';
      if (code !== '40001' || attempt === 2) {
        throw error;
      }
    }
  }

  throw new Error('Username assignment did not complete');
}

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
    const syncedIdentity = await syncIdentityRecord(authorization.user, 'signup');

    // Normalize for validation and storage
    const normalized = username.toLowerCase().trim();

    if (syncedIdentity.username) {
      if (syncedIdentity.username.toLowerCase() === normalized) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            username: syncedIdentity.username,
          }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          code: 'USERNAME_IMMUTABLE',
          error: 'Usernames cannot be changed',
        }),
      };
    }

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

    try {
      const assignment = await assignUsername(userId, normalized);

      if (assignment.action === 'immutable') {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: false,
            code: 'USERNAME_IMMUTABLE',
            error: 'Usernames cannot be changed',
          }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          username: assignment.username,
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
