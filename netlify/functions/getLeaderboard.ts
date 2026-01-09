import { Handler } from '@netlify/functions';
import { query } from './lib/db';

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
    // TODO: This requires a leaderboard/results table
    // Placeholder response for now
    const leaderboard = [
      {
        userId: 'user1',
        displayName: 'Guest User 1',
        score: 5,
        streak: 3,
      },
      {
        userId: 'user2',
        displayName: 'Guest User 2',
        score: 4,
        streak: 2,
      },
      {
        userId: 'user3',
        displayName: 'Guest User 3',
        score: 3,
        streak: 1,
      },
    ];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(leaderboard),
    };
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
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
