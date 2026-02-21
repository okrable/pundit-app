import { Handler } from '@netlify/functions';
import { query } from './lib/db';
import { assertAuthorizedUser } from './lib/auth';

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const userId = event.queryStringParameters?.userId;

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing userId parameter' }),
      };
    }

    // Guest users don't have friends
    if (userId.startsWith('guest_')) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ friends: [] }),
      };
    }

    const authError = await assertAuthorizedUser(event, userId, headers, { allowGuest: false });
    if (authError) {
      return authError;
    }

    // Get all friends for this user
    // Since friendships are stored with user_a < user_b, we need to check both columns
    const friends = await query<{
      id: string;
      display_name: string | null;
      username: string | null;
      avatar_url: string | null;
      streak: number;
      friend_since: string;
    }>(
      `SELECT
        u.id,
        u.display_name,
        u.username,
        u.avatar_url,
        u.streak,
        f.created_at as friend_since
      FROM friendships f
      JOIN users u ON (
        CASE WHEN f.user_a = $1 THEN f.user_b ELSE f.user_a END = u.id
      )
      WHERE f.user_a = $1 OR f.user_b = $1
      ORDER BY u.username ASC NULLS LAST, u.display_name ASC NULLS LAST`,
      [userId]
    );

    // Format response
    const formattedFriends = friends.map((f) => ({
      id: f.id,
      displayName: f.display_name,
      username: f.username,
      avatarUrl: f.avatar_url,
      streak: f.streak,
      friendSince: f.friend_since,
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ friends: formattedFriends }),
    };
  } catch (error) {
    console.error('Error getting friends:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
