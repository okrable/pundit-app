import { withLambda, type LambdaHandler } from '@netlify/aws-lambda-compat';
import { query } from './lib/db';
import {
  getCompatibilityPlayerName,
  resolveChallengeIdentity,
} from './lib/challengeIdentity';

interface DbChallenge {
  id: string;
  code: string;
  quiz_id: string;
  quiz_date: string;
  creator_id: string;
  creator_username: string | null;
  creator_current_username: string | null;
  creator_score: number | null;
  opponent_id: string | null;
  opponent_username: string | null;
  opponent_current_username: string | null;
  opponent_score: number | null;
  status: string;
  expires_at: string;
  completed_at: string | null;
  winner_id: string | null;
}

const handler: LambdaHandler = async (event) => {
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
      `SELECT
         c.id,
         c.code,
         c.quiz_id,
         c.quiz_date,
         c.creator_id,
         c.creator_username,
         creator.username AS creator_current_username,
         c.creator_score,
         c.opponent_id,
         c.opponent_username,
         opponent.username AS opponent_current_username,
         c.opponent_score,
         c.status,
         c.expires_at,
         c.completed_at,
         c.winner_id
       FROM challenges c
       LEFT JOIN users creator
         ON creator.id = c.creator_id
        AND creator.onboarding_status = 'complete'
       LEFT JOIN users opponent
         ON opponent.id = c.opponent_id
        AND opponent.onboarding_status = 'complete'
       WHERE c.code = $1`,
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
    const creatorIdentity = resolveChallengeIdentity(
      challenge.creator_id,
      challenge.creator_current_username,
      challenge.creator_username
    );
    const opponentIdentity = resolveChallengeIdentity(
      challenge.opponent_id,
      challenge.opponent_current_username,
      challenge.opponent_username
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        challengeId: challenge.id,
        code: challenge.code,
        status: challenge.status,
        creator: {
          userId: challenge.creator_id,
          username: creatorIdentity?.username || null,
          legacyLabel: creatorIdentity?.legacyLabel || null,
          isLegacyGuest: creatorIdentity?.isLegacyGuest || false,
          // Deprecated compatibility field for installed clients.
          displayName: getCompatibilityPlayerName(creatorIdentity),
        },
        opponent: challenge.opponent_id
          ? {
              userId: challenge.opponent_id,
              username: opponentIdentity?.username || null,
              legacyLabel: opponentIdentity?.legacyLabel || null,
              isLegacyGuest: opponentIdentity?.isLegacyGuest || false,
              // Deprecated compatibility field for installed clients.
              displayName: getCompatibilityPlayerName(opponentIdentity),
            }
          : null,
        creatorUsername: creatorIdentity?.username || null,
        opponentUsername: opponentIdentity?.username || null,
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

export default withLambda(handler);
