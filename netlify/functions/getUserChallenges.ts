import { withLambda, type LambdaHandler } from '@netlify/aws-lambda-compat';
import { query } from './lib/db';
import { requireCompletedIdentity } from './lib/identity';
import {
  getCompatibilityPlayerName,
  resolveChallengeIdentity,
} from './lib/challengeIdentity';
import { getChallengeUnavailableResponse } from './lib/challengeAvailability';

interface DbChallenge {
  id: string;
  code: string;
  quiz_date: string;
  creator_id: string;
  creator_display_name: string | null;
  creator_username: string | null;
  creator_current_username: string | null;
  creator_score: number | null;
  opponent_id: string | null;
  opponent_display_name: string | null;
  opponent_username: string | null;
  opponent_current_username: string | null;
  opponent_score: number | null;
  status: string;
  created_at: string;
  expires_at: string;
  completed_at: string | null;
  winner_id: string | null;
}

interface DbUserStats {
  challenge_wins: number;
  challenge_losses: number;
  challenge_draws: number;
}

const handler: LambdaHandler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  const unavailable = getChallengeUnavailableResponse(headers);
  if (unavailable) return unavailable;

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
        body: JSON.stringify({ error: 'Missing userId parameter' }),
      };
    }

    // Guest users cannot use challenges
    if (userId.startsWith('guest_')) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          active: null,
          history: [],
          stats: { wins: 0, losses: 0, draws: 0 },
        }),
      };
    }

    const identity = await requireCompletedIdentity(event, userId, headers);
    if (identity.response) {
      return identity.response;
    }

    // Find active challenge (pending or active, not expired)
    const activeChallenges = await query<DbChallenge>(
      `SELECT
         c.*,
         creator.username AS creator_current_username,
         opponent.username AS opponent_current_username
       FROM challenges c
       LEFT JOIN users creator
         ON creator.id = c.creator_id
        AND creator.onboarding_status = 'complete'
       LEFT JOIN users opponent
         ON opponent.id = c.opponent_id
        AND opponent.onboarding_status = 'complete'
       WHERE (c.creator_id = $1 OR c.opponent_id = $1)
       AND c.status IN ('pending', 'active')
       AND c.expires_at > NOW()
       ORDER BY c.created_at DESC
       LIMIT 1`,
      [userId]
    );

    // Find completed challenges (last 10)
    const completedChallenges = await query<DbChallenge>(
      `SELECT
         c.*,
         creator.username AS creator_current_username,
         opponent.username AS opponent_current_username
       FROM challenges c
       LEFT JOIN users creator
         ON creator.id = c.creator_id
        AND creator.onboarding_status = 'complete'
       LEFT JOIN users opponent
         ON opponent.id = c.opponent_id
        AND opponent.onboarding_status = 'complete'
       WHERE (c.creator_id = $1 OR c.opponent_id = $1)
       AND c.status = 'completed'
       ORDER BY c.completed_at DESC
       LIMIT 10`,
      [userId]
    );

    // Get user stats
    const userStats = await query<DbUserStats>(
      `SELECT challenge_wins, challenge_losses, challenge_draws FROM users WHERE id = $1`,
      [userId]
    );

    // Format active challenge
    let active = null;
    if (activeChallenges.length > 0) {
      const c = activeChallenges[0];
      const isCreator = c.creator_id === userId;
      const creatorIdentity = resolveChallengeIdentity(
        c.creator_id,
        c.creator_current_username,
        c.creator_username
      );
      const opponentIdentity = resolveChallengeIdentity(
        c.opponent_id,
        c.opponent_current_username,
        c.opponent_username
      );
      active = {
        challengeId: c.id,
        code: c.code,
        status: c.status,
        creatorUsername: creatorIdentity?.username || null,
        opponentUsername: opponentIdentity?.username || null,
        creatorLegacyLabel: creatorIdentity?.legacyLabel || null,
        opponentLegacyLabel: opponentIdentity?.legacyLabel || null,
        creatorIsLegacyGuest: creatorIdentity?.isLegacyGuest || false,
        opponentIsLegacyGuest: opponentIdentity?.isLegacyGuest || false,
        // Deprecated compatibility fields for installed clients.
        creatorDisplayName: getCompatibilityPlayerName(creatorIdentity),
        opponentDisplayName: getCompatibilityPlayerName(opponentIdentity),
        isCreator,
        createdAt: c.created_at,
        expiresAt: c.expires_at,
        // Include scores if available (for checking status)
        hasCreatorPlayed: c.creator_score !== null,
        hasOpponentPlayed: c.opponent_score !== null,
      };
    }

    // Format history
    const history = completedChallenges.map((c) => {
      const isCreator = c.creator_id === userId;
      const yourScore = isCreator ? c.creator_score : c.opponent_score;
      const opponentScore = isCreator ? c.opponent_score : c.creator_score;
      const opponentIdentity = isCreator
        ? resolveChallengeIdentity(
            c.opponent_id,
            c.opponent_current_username,
            c.opponent_username
          )
        : resolveChallengeIdentity(
            c.creator_id,
            c.creator_current_username,
            c.creator_username
          );

      let result: 'win' | 'loss' | 'draw' = 'draw';
      if (c.winner_id === userId) {
        result = 'win';
      } else if (c.winner_id !== null) {
        result = 'loss';
      }

      return {
        challengeId: c.id,
        opponentUsername: opponentIdentity?.username || null,
        opponentLegacyLabel: opponentIdentity?.legacyLabel || null,
        opponentIsLegacyGuest: opponentIdentity?.isLegacyGuest || false,
        // Deprecated compatibility field for installed clients.
        opponentDisplayName: getCompatibilityPlayerName(opponentIdentity),
        yourScore,
        opponentScore,
        result,
        completedAt: c.completed_at,
      };
    });

    // Format stats
    const stats = {
      wins: userStats[0]?.challenge_wins || 0,
      losses: userStats[0]?.challenge_losses || 0,
      draws: userStats[0]?.challenge_draws || 0,
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        active,
        history,
        stats,
      }),
    };
  } catch (error) {
    console.error('Error fetching user challenges:', error);
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
