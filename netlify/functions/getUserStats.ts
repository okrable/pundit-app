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
    const { userId } = event.queryStringParameters || {};

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'userId is required' }),
      };
    }

    // Guest users: return placeholder zeros
    if (userId.startsWith('guest_')) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          streak: 0,
          bestScore: 0,
          totalQuizzes: 0,
          averageScore: 0,
        }),
      };
    }

    // Auth0 users: query real stats from database
    const stats = await query<{
      streak: number;
      best_score: number;
      total_quizzes: number;
      total_correct: number;
      accuracy_pct: number;
    }>(
      `SELECT
        streak,
        best_score,
        total_quizzes,
        total_correct,
        CASE WHEN total_quizzes > 0
          THEN ROUND(total_correct::DECIMAL / (total_quizzes * 5) * 100, 1)
          ELSE 0
        END as accuracy_pct
      FROM users
      WHERE id = $1`,
      [userId]
    );

    // Return zeros if user doesn't exist
    const userStats = stats[0] || {
      streak: 0,
      best_score: 0,
      total_quizzes: 0,
      total_correct: 0,
      accuracy_pct: 0,
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        streak: userStats.streak,
        bestScore: userStats.best_score,
        totalQuizzes: userStats.total_quizzes,
        averageScore: userStats.accuracy_pct,
      }),
    };
  } catch (error) {
    console.error('Error fetching user stats:', error);
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
