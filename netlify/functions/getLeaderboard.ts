import { Handler } from '@netlify/functions';
import { getPreviousQuizDate, getQuizDate } from './lib/quizDate';
import {
  getGlobalLeaderboardRows,
  parseLeaderboardLimit,
  parseLeaderboardPeriod,
} from './lib/leaderboards';

export const handler: Handler = async (event) => {
  const startedAt = Date.now();
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
    const now = new Date();
    const today = getQuizDate(now);
    const previousQuizDate = getPreviousQuizDate(today);
    const period = parseLeaderboardPeriod(event.queryStringParameters?.period);
    const limit = parseLeaderboardLimit(event.queryStringParameters?.limit);

    console.log('getLeaderboard.start', { today, period, limit });

    // Auth0 users only in persisted rankings; guests can view but do not persist rows.
    const leaderboard = await getGlobalLeaderboardRows(
      period,
      { quizDate: today, previousQuizDate },
      limit
    );

    const response = {
      period,
      quizDate: today,
      leaderboard,
    };

    console.log('getLeaderboard.success', {
      today,
      period,
      count: leaderboard.length,
      durationMs: Date.now() - startedAt,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error fetching leaderboard:', {
      durationMs: Date.now() - startedAt,
      error,
    });
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
