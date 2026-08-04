import { Handler } from '@netlify/functions';
import { query } from './lib/db';
import { requireCompletedIdentity } from './lib/identity';
import { getPreviousQuizDate, getQuizDate } from './lib/quizDate';

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

    const identity = await requireCompletedIdentity(event, userId, headers);
    if (identity.response) {
      return identity.response;
    }

    const today = getQuizDate();
    const previousQuizDate = getPreviousQuizDate(today);

    // Get all friends for this user
    // Since friendships are stored with user_a < user_b, we need to check both columns
    const friends = await query<{
      id: string;
      username: string;
      avatar_url: string | null;
      avatar_id: string | null;
      streak: number;
      friend_since: string;
    }>(
      `SELECT
        u.id,
        u.username,
        u.avatar_url,
        u.avatar_id,
        CASE
          WHEN u.last_played IN ($2::DATE, $3::DATE) THEN u.streak
          ELSE 0
        END as streak,
        f.created_at as friend_since
      FROM friendships f
      JOIN users u ON (
        CASE WHEN f.user_a = $1 THEN f.user_b ELSE f.user_a END = u.id
      )
      WHERE (f.user_a = $1 OR f.user_b = $1)
        AND u.onboarding_status = 'complete'
        AND u.username IS NOT NULL
      ORDER BY u.username ASC`,
      [userId, today, previousQuizDate]
    );

    // Format response
    const formattedFriends = friends.map((f) => ({
      userId: f.id,
      id: f.id,
      username: f.username,
      avatarUrl: f.avatar_url,
      avatarId: f.avatar_id,
      streak: f.streak,
      friendSince: f.friend_since,
      // Deprecated compatibility field for installed clients.
      displayName: f.username,
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
