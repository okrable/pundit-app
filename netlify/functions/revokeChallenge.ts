import { Handler } from '@netlify/functions';
import { query } from './lib/db';

interface RevokeChallengeRequest {
  challengeId: string;
  userId: string;
}

interface DbChallenge {
  id: string;
  creator_id: string;
  opponent_id: string | null;
  status: string;
}

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body: RevokeChallengeRequest = JSON.parse(event.body || '{}');
    const { challengeId, userId } = body;

    if (!challengeId || !userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing challengeId or userId' }),
      };
    }

    // Fetch challenge
    const challenges = await query<DbChallenge>(
      `SELECT id, creator_id, opponent_id, status FROM challenges WHERE id = $1`,
      [challengeId]
    );

    if (challenges.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Challenge not found' }),
      };
    }

    const challenge = challenges[0];

    // Check if user is the creator
    if (challenge.creator_id !== userId) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Only the creator can revoke a challenge' }),
      };
    }

    // Check if opponent has already joined
    if (challenge.opponent_id !== null) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: 'Cannot revoke - opponent has already joined' }),
      };
    }

    // Check if already revoked/completed/expired
    if (challenge.status === 'revoked') {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: 'Challenge is already revoked' }),
      };
    }

    if (challenge.status === 'completed' || challenge.status === 'expired') {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: `Cannot revoke - challenge is ${challenge.status}` }),
      };
    }

    // Revoke the challenge
    await query(
      `UPDATE challenges SET status = 'revoked' WHERE id = $1`,
      [challengeId]
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error('Error revoking challenge:', error);
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
