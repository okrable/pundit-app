import { Handler } from '@netlify/functions';
import { query } from './lib/db';

interface QuizQuestion {
  date: string | null;
  language: string | null;
  rank: number | null;
  question_id: string;
  question: string | null;
  player_id: string | null;
  player_name: string | null;
  player_0: string | null;
  player_1: string | null;
  player_2: string | null;
  player_3: string | null;
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
    const { date, language = 'uk' } = event.queryStringParameters || {};
    // Uses UTC date; mismatch with local-date data can return no rows.
    const targetDate = date || new Date().toISOString().split('T')[0];
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

    const formattedQuiz = {
      id: `quiz-${targetDate}`,
      date: targetDate,
      questions: questions.map((q) => {
        const options = [q.player_0, q.player_1, q.player_2, q.player_3].filter(Boolean);
        const correctIndex = options.findIndex((opt) => opt === q.player_name);

        return {
          id: q.question_id,
          prompt: q.question || '',
          options,
          correctOptionIndex: correctIndex >= 0 ? correctIndex : undefined,
        };
      }),
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(formattedQuiz),
    };
  } catch (error) {
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
