import { Handler } from '@netlify/functions';
import { query } from './lib/db';
import { assertAuthorizedUser } from './lib/auth';
import { getQuizDate } from './lib/quizDate';

interface CareerResultRow {
  game_date: string;
  game_id: string;
  submitted_answer: string;
  canonical_name: string;
}

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

    if (userId.startsWith('guest_')) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ result: null }),
      };
    }

    const authError = await assertAuthorizedUser(event, userId, headers);
    if (authError) {
      return authError;
    }

    const rows = await query<CareerResultRow>(
      `SELECT
         game_date::TEXT as game_date,
         game_id,
         submitted_answer,
         canonical_name
       FROM career_game_results
       WHERE user_id = $1 AND game_date = $2
       ORDER BY completed_at DESC
       LIMIT 1`,
      [userId, getQuizDate()]
    );
    const row = rows[0];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        result: row
          ? {
              date: row.game_date,
              gameId: row.game_id,
              completed: true,
              canonicalName: row.canonical_name,
              submittedAnswer: row.submitted_answer,
              syncState: 'synced',
            }
          : null,
      }),
    };
  } catch (error) {
    console.error('Error fetching career game result:', error);
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
