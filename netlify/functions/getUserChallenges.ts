import { Handler } from '@netlify/functions';
import { query } from './lib/db';

interface DbChallenge {
  id: string;
  code: string;
  quiz_date: string;
  creator_id: string;
  creator_display_name: string | null;
  creator_score: number | null;
  opponent_id: string | null;
  opponent_display_name: string | null;
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
        body: JSON.stringify({ error: 'Missing userId parameter' }),
      };
    }

    // Guest users get empty response
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

    // Find active challenge (pending or active, not expired)
    const activeChallenges = await query<DbChallenge>(
      `SELECT * FROM challenges
       WHERE (creator_id = $1 OR opponent_id = $1)
       AND status IN ('pending', 'active')
       AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    // Find completed challenges (last 10)
    const completedChallenges = await query<DbChallenge>(
      `SELECT * FROM challenges
       WHERE (creator_id = $1 OR opponent_id = $1)
       AND status = 'completed'
       ORDER BY completed_at DESC
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
      active = {
        challengeId: c.id,
        code: c.code,
        status: c.status,
        creatorDisplayName: c.creator_display_name,
        opponentDisplayName: c.opponent_display_name,
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
      const opponentDisplayName = isCreator ? c.opponent_display_name : c.creator_display_name;

      let result: 'win' | 'loss' | 'draw' = 'draw';
      if (c.winner_id === userId) {
        result = 'win';
      } else if (c.winner_id !== null) {
        result = 'loss';
      }

      return {
        challengeId: c.id,
        opponentDisplayName,
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
