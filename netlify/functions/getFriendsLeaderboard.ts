import { Handler } from '@netlify/functions';
import { requireCompletedIdentity } from './lib/identity';
import { getPreviousQuizDate, getQuizDate } from './lib/quizDate';
import {
  getFriendsLeaderboardRows,
  parseLeaderboardPeriod,
} from './lib/leaderboards';

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
    const userId = event.queryStringParameters?.userId;
    const period = parseLeaderboardPeriod(event.queryStringParameters?.period);

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing userId parameter' }),
      };
    }

    const now = new Date();
    const today = getQuizDate(now);
    const previousQuizDate = getPreviousQuizDate(today);

    // Guest users don't have friends
    if (userId.startsWith('guest_')) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          period,
          quizDate: today,
          leaderboard: [],
          totalFriends: 0,
          friendsPlayedToday: 0,
        }),
      };
    }

    const identity = await requireCompletedIdentity(event, userId, headers);
    if (identity.response) {
      return identity.response;
    }

    const leaderboard = await getFriendsLeaderboardRows(
      userId,
      period,
      { quizDate: today, previousQuizDate }
    );

    const totalFriends = leaderboard.length - 1; // Exclude self
    const friendsPlayedToday = leaderboard.filter(
      (entry) => entry.hasPlayedToday && entry.userId !== userId
    ).length;
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        period,
        quizDate: today,
        leaderboard,
        totalFriends,
        friendsPlayedToday,
      }),
    };
  } catch (error) {
    console.error('Error fetching friends leaderboard:', error);
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
