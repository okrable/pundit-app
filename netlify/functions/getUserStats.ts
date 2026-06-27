import { Handler } from '@netlify/functions';
import { query } from './lib/db';
import { assertAuthorizedUser } from './lib/auth';
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
          challengeWins: 0,
          challengeLosses: 0,
          challengeDraws: 0,
          username: null,
          createdAt: null,
        }),
      };
    }

    const authError = await assertAuthorizedUser(event, userId, headers, { allowGuest: true });
    if (authError) {
      return authError;
    }

    // Auth0 users: query real stats from database
    const stats = await query<{
      streak: number;
      best_score: number;
      total_quizzes: number;
      challenge_wins: number;
      challenge_losses: number;
      challenge_draws: number;
      username: string | null;
      created_at: string;
      last_played: string | null;
    }>(
      `SELECT
        streak,
        best_score,
        total_quizzes,
        COALESCE(challenge_wins, 0) as challenge_wins,
        COALESCE(challenge_losses, 0) as challenge_losses,
        COALESCE(challenge_draws, 0) as challenge_draws,
        username,
        created_at,
        last_played::TEXT as last_played
      FROM users
      WHERE id = $1`,
      [userId]
    );

    // Return zeros if user doesn't exist
    if (stats.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          streak: 0,
          bestScore: 0,
          totalQuizzes: 0,
          challengeWins: 0,
          challengeLosses: 0,
          challengeDraws: 0,
          username: null,
          createdAt: null,
        }),
      };
    }

    const userStats = stats[0];
    const today = getQuizDate();
    const yesterday = getPreviousQuizDate(today);
    const currentStreak =
      userStats.last_played === today || userStats.last_played === yesterday
        ? Number(userStats.streak || 0)
        : 0;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        streak: currentStreak,
        bestScore: userStats.best_score || 0,
        totalQuizzes: userStats.total_quizzes || 0,
        challengeWins: userStats.challenge_wins || 0,
        challengeLosses: userStats.challenge_losses || 0,
        challengeDraws: userStats.challenge_draws || 0,
        username: userStats.username,
        createdAt: userStats.created_at,
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
