import { Handler } from '@netlify/functions';
import { query } from './lib/db';
import { assertAuthorizedUser } from './lib/auth';

const DISPLAY_NAME_MAX_LENGTH = 50;

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
    const { userId, displayName } = JSON.parse(event.body || '{}');

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'userId is required' }),
      };
    }

    // Reject guest users
    if (userId.startsWith('guest_')) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ success: false, error: 'Sign in to update profile' }),
      };
    }

    const authError = await assertAuthorizedUser(event, userId, headers, { allowGuest: false });
    if (authError) {
      return authError;
    }

    // Validate display name if provided
    if (displayName !== undefined) {
      if (typeof displayName !== 'string') {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: false, error: 'Invalid display name' }),
        };
      }

      const trimmedName = displayName.trim();
      if (trimmedName.length === 0) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: false, error: 'Display name cannot be empty' }),
        };
      }

      if (trimmedName.length > DISPLAY_NAME_MAX_LENGTH) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: false,
            error: `Display name must be at most ${DISPLAY_NAME_MAX_LENGTH} characters`,
          }),
        };
      }

      // Update display name
      await query(
        `UPDATE users SET display_name = $2 WHERE id = $1`,
        [userId, trimmedName]
      );

      // Fetch updated profile
      const updated = await query<{
        display_name: string | null;
        username: string | null;
      }>(
        'SELECT display_name, username FROM users WHERE id = $1',
        [userId]
      );

      if (updated.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ success: false, error: 'User not found' }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          profile: {
            displayName: updated[0].display_name,
            username: updated[0].username,
          },
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: false, error: 'No fields to update' }),
    };
  } catch (error) {
    console.error('Error updating profile:', error);
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
