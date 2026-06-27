import { Handler } from '@netlify/functions';
import { query } from './lib/db';
import { assertAuthorizedUser } from './lib/auth';

// Username validation rules (same as checkUsername)
const USERNAME_REGEX = /^[a-z0-9][a-z0-9_]{1,18}[a-z0-9]$/;
const MIN_LENGTH = 3;
const MAX_LENGTH = 20;

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

    const authError = await assertAuthorizedUser(event, userId, headers, { allowGuest: false });
    if (authError) {
      return authError;
    }

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

    // Usernames are permanent after initial creation.
    const user = await query<{
      username: string | null;
    }>(
      'SELECT username FROM users WHERE id = $1',
      [userId]
    );

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

    if (user.length > 0 && user[0].username) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Usernames are permanent and cannot be changed.',
        }),
      };
    }

    // Atomic update with uniqueness check
    // Use upsert to handle both new and existing users
    try {
      await query(
        `INSERT INTO users (id, username, username_normalized)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET
           username = $2,
           username_normalized = $3`,
        [userId, username, normalized]
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          username: username,
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
