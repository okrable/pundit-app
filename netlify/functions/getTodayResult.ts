import { withLambda, type LambdaHandler } from '@netlify/aws-lambda-compat';
import { query } from './lib/db';
import { assertAuthorizedUser } from './lib/auth';
import { getQuizDate } from './lib/quizDate';
import { buildStreakStatus } from '../../shared/streak';

interface DbResult {
  quiz_date: string;
  quiz_id: string;
  score: number;
  total_questions: number;
  answers: boolean[];
}

interface DbUser {
  streak: number;
  best_score: number;
  last_played: string | null;
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
    const { userId } = event.queryStringParameters || {};

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing userId parameter' }),
      };
    }

    // Guest users don't have database records
    if (userId.startsWith('guest_')) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ result: null }),
      };
    }

    const authError = await assertAuthorizedUser(event, userId, headers, { allowGuest: true });
    if (authError) {
      return authError;
    }

    const today = getQuizDate();

    // Check for existing result for today
    const results = await query<DbResult>(
      `SELECT quiz_date::TEXT as quiz_date, quiz_id, score, total_questions, answers
       FROM results
       WHERE user_id = $1 AND quiz_date = $2`,
      [userId, today]
    );

    if (results.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ result: null }),
      };
    }

    // Get user stats
    const userStats = await query<DbUser>(
      `SELECT streak, best_score, last_played::TEXT as last_played FROM users WHERE id = $1`,
      [userId]
    );

    const dbResult = results[0];
    const streakStatus = buildStreakStatus(
      {
        runLength: Number(userStats[0]?.streak || 0),
        lastPlayedDate: userStats[0]?.last_played ?? null,
      },
      today
    );
    const result = {
      date: dbResult.quiz_date,
      quizId: dbResult.quiz_id,
      score: dbResult.score,
      totalQuestions: dbResult.total_questions,
      answers: dbResult.answers ?? [],
      streak: streakStatus.current,
      bestScore: userStats[0]?.best_score || 0,
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ result }),
    };
  } catch (error) {
    console.error('Error fetching today result:', error);
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
