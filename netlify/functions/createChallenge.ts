import { Handler } from '@netlify/functions';
import { query } from './lib/db';
import { assertAuthorizedUser } from './lib/auth';
import { getQuizDate } from './lib/quizDate';
import { createRequestId, logRequestEnd, logRequestError, logRequestStart } from './lib/observability';

interface CreateChallengeRequest {
  userId: string;
  username?: string;
}

// Generate a 6-character alphanumeric code (uppercase, no ambiguous chars)
function generateChallengeCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No 0/O, 1/I/L
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
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

  const requestStartedAt = Date.now();
  const requestId = createRequestId();

  try {
    const body: CreateChallengeRequest = JSON.parse(event.body || '{}');
    const { userId, username } = body;

    logRequestStart({ endpoint: 'createChallenge', requestId, userId });

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing userId' }),
      };
    }

    // Guest users cannot create challenges
    if (userId.startsWith('guest_')) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Please sign in to create challenges' }),
      };
    }

    const authError = await assertAuthorizedUser(event, userId, headers, { allowGuest: false });
    if (authError) {
      return authError;
    }

    // Check if user already has an active challenge (pending or active, not expired)
    const existingChallenge = await query<{ id: string; status: string; expires_at: string }>(
      `SELECT id, status, expires_at FROM challenges
       WHERE creator_id = $1
       AND status IN ('pending', 'active')
       AND expires_at > NOW()`,
      [userId]
    );

    if (existingChallenge.length > 0) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          error: 'You already have an active challenge',
          existingChallengeId: existingChallenge[0].id,
        }),
      };
    }

    // Get today's quiz in configured quiz timezone
    const today = getQuizDate();
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
      [today]
    );

    if (questions.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'No quiz available for today' }),
      };
    }

    // Generate unique code (retry if collision)
    let code = generateChallengeCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await query<{ id: string }>(
        `SELECT id FROM challenges WHERE code = $1`,
        [code]
      );
      if (existing.length === 0) break;
      code = generateChallengeCode();
      attempts++;
    }

    if (attempts >= 10) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to generate unique code' }),
      };
    }

    // Create the challenge
    const quizId = `quiz-${today}`;
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours from now

    const result = await query<{ id: string }>(
      `INSERT INTO challenges (code, quiz_id, quiz_date, creator_id, creator_display_name, creator_username, expires_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING id`,
      [code, quizId, today, userId, null, username || null, expiresAt.toISOString()]
    );

    const challengeId = result[0].id;

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

    logRequestEnd({ endpoint: 'createChallenge', requestId, userId }, Date.now() - requestStartedAt, 201);
    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        challengeId,
        code,
        shareUrl: `https://pundit.app/c/${code}`,
        quizId,
        expiresAt: expiresAt.toISOString(),
        questions: formattedQuestions,
      }),
    };
  } catch (error) {
    logRequestError({ endpoint: 'createChallenge', requestId }, Date.now() - requestStartedAt, error);
    console.error('Error creating challenge:', error);
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
