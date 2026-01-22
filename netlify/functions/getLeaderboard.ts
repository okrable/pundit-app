import { Handler } from '@netlify/functions';
import { query } from './lib/db';

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
    // Get today's date in UTC
    const today = new Date().toISOString().split('T')[0];

    // Query daily leaderboard (Auth0 users only - guests have no results in DB)
    const leaderboard = await query<{
      user_id: string;
      display_name: string | null;
      score: number;
      streak: number;
      rank: number;
    }>(
      `SELECT
        r.user_id,
        u.display_name,
        r.score,
        u.streak,
        RANK() OVER (ORDER BY r.score DESC) as rank
      FROM results r
      JOIN users u ON r.user_id = u.id
      WHERE r.quiz_date = $1
      ORDER BY r.score DESC
      LIMIT 100`,
      [today]
    );

    // Transform to API response format
    const response = leaderboard.map((entry) => ({
      userId: entry.user_id,
      displayName: entry.display_name || 'Anonymous',
      score: entry.score,
      streak: entry.streak,
      rank: Number(entry.rank),
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
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
