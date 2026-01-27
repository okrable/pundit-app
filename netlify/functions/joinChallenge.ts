import { Handler } from '@netlify/functions';
import { query } from './lib/db';

interface JoinChallengeRequest {
  code: string;
  userId: string;
  displayName?: string;
}

interface DbChallenge {
  id: string;
  code: string;
  quiz_id: string;
  quiz_date: string;
  creator_id: string;
  creator_display_name: string | null;
  opponent_id: string | null;
  status: string;
  expires_at: string;
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
    const body: JoinChallengeRequest = JSON.parse(event.body || '{}');
    const { code, userId, displayName } = body;

    if (!code || !userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing code or userId' }),
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

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(challenge.expires_at);
    if (now > expiresAt) {
      return {
        statusCode: 410,
        headers,
        body: JSON.stringify({ error: 'Challenge has expired' }),
      };
    }

    // Check if already has an opponent
    if (challenge.opponent_id !== null) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: 'Challenge already has an opponent' }),
      };
    }

    // Check if trying to join own challenge
    if (challenge.creator_id === userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Cannot join your own challenge' }),
      };
    }

    // Check if challenge is in valid state
    if (challenge.status === 'revoked' || challenge.status === 'expired' || challenge.status === 'completed') {
      return {
        statusCode: 410,
        headers,
        body: JSON.stringify({ error: `Challenge is ${challenge.status}` }),
      };
    }

    // Update challenge with opponent
    await query(
      `UPDATE challenges SET opponent_id = $1, opponent_display_name = $2 WHERE id = $3`,
      [userId, displayName || null, challenge.id]
    );

    // Fetch quiz questions
    const questions = await query<{
      question_id: string;
      question: string;
      player_name: string;
      player_0: string;
      player_1: string;
      player_2: string;
      player_3: string;
    }>(
      `SELECT question_id, question, player_name, player_0, player_1, player_2, player_3
       FROM pu_player_ques
       WHERE date = $1 AND language = 'uk'
       ORDER BY rank ASC
       LIMIT 5`,
      [challenge.quiz_date]
    );

    // Format questions for response
    const formattedQuestions = questions.map((q) => {
      const options = [q.player_0, q.player_1, q.player_2, q.player_3].filter(Boolean);
      const correctIndex = options.findIndex((opt) => opt === q.player_name);
      return {
        id: q.question_id,
        prompt: q.question,
        options,
        correctOptionIndex: correctIndex >= 0 ? correctIndex : 0,
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        challengeId: challenge.id,
        creator: {
          displayName: challenge.creator_display_name,
        },
        questions: formattedQuestions,
      }),
    };
  } catch (error) {
    console.error('Error joining challenge:', error);
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
