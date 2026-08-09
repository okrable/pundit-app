import { Handler } from '@netlify/functions';
import { query } from './lib/db';
import { getQuizDate } from './lib/quizDate';
import { createRequestId, logRequestEnd, logRequestError, logRequestStart } from './lib/observability';
import { getCareerGameForDate } from './lib/careerGame';
import {
  buildDailyQuizResponse,
  DailyQuizQuestionRow,
} from './lib/dailyQuizResponse';
import { getDailyQuizCacheControl } from '../../shared/dailyQuiz';

interface QuizQuestion extends DailyQuizQuestionRow {
  date: string | null;
  language: string | null;
  rank: number | null;
  player_id: string | null;
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

  const requestStartedAt = Date.now();
  const requestId = createRequestId();

  try {
    const { date, language = 'uk' } = event.queryStringParameters || {};

    logRequestStart({ endpoint: 'getDailyQuiz', requestId });
    const targetDate = date || getQuizDate();
    console.log('Quiz query params', { targetDate, language });

    const questions = await query<QuizQuestion>(
      `SELECT * FROM pu_player_ques
       WHERE date = $1 AND language = $2
       ORDER BY rank ASC
       LIMIT 5`,
      [targetDate, language]
    );
    console.log('Quiz rows', questions.length);

    if (questions.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: 'No quiz found for the specified date',
          date: targetDate,
        }),
      };
    }

    const careerGame = await getCareerGameForDate(targetDate, language);
    const formattedQuiz = buildDailyQuizResponse(
      targetDate,
      questions,
      careerGame
    );

    logRequestEnd({ endpoint: 'getDailyQuiz', requestId }, Date.now() - requestStartedAt, 200);
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Cache-Control': getDailyQuizCacheControl(Boolean(date)),
      },
      body: JSON.stringify(formattedQuiz),
    };
  } catch (error) {
    logRequestError({ endpoint: 'getDailyQuiz', requestId }, Date.now() - requestStartedAt, error);
    console.error('Error fetching quiz:', error);
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
