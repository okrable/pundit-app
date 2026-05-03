import { Handler } from '@netlify/functions';
import { query } from './lib/db';
import { getQuizDate } from './lib/quizDate';

export const handler: Handler = async (event) => {
  const startedAt = Date.now();
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
    const today = getQuizDate();
    console.log('getLeaderboard.start', { today });

    // Query daily leaderboard (Auth0 users only - guests have no results in DB)
    const leaderboard = await query<{
      user_id: string;
      display_name: string | null;
      username: string | null;
      score: number;
      streak: number;
      rank: number;
    }>(
      `SELECT
        r.user_id,
        u.display_name,
        u.username,
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
      username: entry.username,
      score: entry.score,
      streak: entry.streak,
      rank: Number(entry.rank),
    }));

    console.log('getLeaderboard.success', {
      today,
      count: response.length,
      durationMs: Date.now() - startedAt,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error fetching leaderboard:', {
      durationMs: Date.now() - startedAt,
      error,
    });
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
