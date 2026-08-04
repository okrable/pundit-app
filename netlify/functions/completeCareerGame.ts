import { Handler } from '@netlify/functions';
import { query } from './lib/db';
import { requireCompletedIdentity } from './lib/identity';
import { enforceRateLimit } from './lib/rateLimit';
import {
  getCareerGameForDate,
  getCurrentCareerGameDate,
} from './lib/careerGame';
import { getQuizDate } from './lib/quizDate';
import { matchesCareerAnswer } from '../../shared/careerAnswer';

interface CompleteCareerGameRequest {
  userId: string;
  gameId: string;
  submittedAnswer: string;
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
    const body = JSON.parse(event.body || '{}') as Partial<CompleteCareerGameRequest>;
    const { userId, gameId, submittedAnswer } = body;
    const gameDate = gameId
      ? getCurrentCareerGameDate(gameId, getQuizDate())
      : null;

    if (
      !userId ||
      userId.startsWith('guest_') ||
      !gameId ||
      !gameDate ||
      typeof submittedAnswer !== 'string' ||
      submittedAnswer.trim().length === 0 ||
      submittedAnswer.length > 120
    ) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid career game completion request' }),
      };
    }

    const identity = await requireCompletedIdentity(event, userId, headers);
    if (identity.response) {
      return identity.response;
    }

    const rateLimitError = await enforceRateLimit(event, headers, {
      scope: 'complete-career-game',
      subject: userId,
      limit: 12,
      windowSeconds: 300,
    });
    if (rateLimitError) {
      return rateLimitError;
    }

    const game = await getCareerGameForDate(gameDate);
    if (game.id !== gameId || !matchesCareerAnswer(submittedAnswer, game)) {
      return {
        statusCode: 422,
        headers,
        body: JSON.stringify({ error: 'That answer does not complete this game' }),
      };
    }

    await query(
      `INSERT INTO career_game_results (
         user_id,
         game_id,
         game_date,
         submitted_answer,
         canonical_name
       )
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, game_id) DO NOTHING`,
      [userId, gameId, gameDate, submittedAnswer.trim(), game.canonicalName]
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        result: {
          date: gameDate,
          gameId,
          completed: true,
          canonicalName: game.canonicalName,
          submittedAnswer: submittedAnswer.trim(),
          syncState: 'synced',
        },
      }),
    };
  } catch (error) {
    console.error('Error completing career game:', error);
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
