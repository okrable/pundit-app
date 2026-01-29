import { Handler } from '@netlify/functions';
import { query } from './lib/db';

const COOLDOWN_DAYS = 30;

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
          displayName: null,
          createdAt: null,
          canChangeUsername: true,
          usernameChangeAvailableAt: null,
        }),
      };
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
      display_name: string | null;
      created_at: string;
      username_last_changed_at: string | null;
    }>(
      `SELECT
        streak,
        best_score,
        total_quizzes,
        COALESCE(challenge_wins, 0) as challenge_wins,
        COALESCE(challenge_losses, 0) as challenge_losses,
        COALESCE(challenge_draws, 0) as challenge_draws,
        username,
        display_name,
        created_at,
        username_last_changed_at
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
          displayName: null,
          createdAt: null,
          canChangeUsername: true,
          usernameChangeAvailableAt: null,
        }),
      };
    }

    const userStats = stats[0];

    // Calculate username change availability
    let canChangeUsername = true;
    let usernameChangeAvailableAt: string | null = null;

    if (userStats.username_last_changed_at) {
      const lastChanged = new Date(userStats.username_last_changed_at);
      const cooldownEnd = new Date(lastChanged.getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
      const now = new Date();

      if (now < cooldownEnd) {
        canChangeUsername = false;
        usernameChangeAvailableAt = cooldownEnd.toISOString();
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        streak: userStats.streak || 0,
        bestScore: userStats.best_score || 0,
        totalQuizzes: userStats.total_quizzes || 0,
        challengeWins: userStats.challenge_wins || 0,
        challengeLosses: userStats.challenge_losses || 0,
        challengeDraws: userStats.challenge_draws || 0,
        username: userStats.username,
        displayName: userStats.display_name,
        createdAt: userStats.created_at,
        canChangeUsername,
        usernameChangeAvailableAt,
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
