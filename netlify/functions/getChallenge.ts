import { Handler } from '@netlify/functions';
import { query } from './lib/db';

interface DbChallenge {
  id: string;
  code: string;
  quiz_id: string;
  quiz_date: string;
  creator_id: string;
  creator_display_name: string | null;
  creator_score: number | null;
  opponent_id: string | null;
  opponent_display_name: string | null;
  opponent_score: number | null;
  status: string;
  expires_at: string;
  completed_at: string | null;
  winner_id: string | null;
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
    const { code } = event.queryStringParameters || {};

    if (!code) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing code parameter' }),
      };
    }

    // Fetch challenge by code
    const challenges = await query<DbChallenge>(
      `SELECT * FROM challenges WHERE code = $1`,
      [code.toUpperCase()]
    );

    if (challenges.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Challenge not found' }),
      };
    }

    const challenge = challenges[0];

    // Check if expired (update status if needed)
    const now = new Date();
    const expiresAt = new Date(challenge.expires_at);
    const isExpired = now > expiresAt && challenge.status !== 'completed';

    if (isExpired && challenge.status !== 'expired') {
      // Mark as expired in DB
      await query(
        `UPDATE challenges SET status = 'expired' WHERE id = $1`,
        [challenge.id]
      );
      challenge.status = 'expired';
    }

    // Determine if challenge can be joined
    const canJoin =
      !isExpired &&
      challenge.status !== 'completed' &&
      challenge.status !== 'revoked' &&
      challenge.status !== 'expired' &&
      challenge.opponent_id === null;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        challengeId: challenge.id,
        code: challenge.code,
        status: challenge.status,
        creator: {
          userId: challenge.creator_id,
          displayName: challenge.creator_display_name,
        },
        opponent: challenge.opponent_id
          ? {
              userId: challenge.opponent_id,
              displayName: challenge.opponent_display_name,
            }
          : null,
        quizDate: challenge.quiz_date,
        expiresAt: challenge.expires_at,
        canJoin,
        // Include results if completed
        ...(challenge.status === 'completed' && {
          creatorScore: challenge.creator_score,
          opponentScore: challenge.opponent_score,
          winnerId: challenge.winner_id,
        }),
      }),
    };
  } catch (error) {
    console.error('Error fetching challenge:', error);
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
