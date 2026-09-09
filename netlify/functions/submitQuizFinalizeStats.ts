import { withLambda, type LambdaHandler } from '@netlify/aws-lambda-compat';
import { queryWithClient, withTransaction } from './lib/db';
import { requireCompletedIdentity } from './lib/identity';
import { recomputeUserQuizStats, withUserResultTransaction } from './lib/quizResults';

interface FinalizeStatsRequest {
  quizId: string;
  userId: string;
  userProfile?: {
    displayName?: string;
    email?: string;
    avatarUrl?: string;
  };
}

const handler: LambdaHandler = async (event) => {
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
    const body: FinalizeStatsRequest = JSON.parse(event.body || '{}');
    const { quizId, userId } = body;

    if (!quizId || !userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'quizId and userId are required' }),
      };
    }

    if (userId.startsWith('guest_')) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ finalized: false, skipped: true }),
      };
    }

    const identity = await requireCompletedIdentity(event, userId, headers);
    if (identity.response) {
      return identity.response;
    }

    if (!/^quiz-\d{4}-\d{2}-\d{2}$/.test(quizId)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid quizId' }) };
    }
    const updated = await withUserResultTransaction(userId, async (client) => {
      const rows = await queryWithClient(client,
        'SELECT id FROM results WHERE user_id=$1 AND quiz_id=$2', [userId, quizId]);
      return rows.length ? recomputeUserQuizStats(client, userId) : null;
    });

    if (!updated) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Result not found' }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        finalized: true,
        streak: updated.streak,
        bestScore: updated.bestScore,
      }),
    };
  } catch (error) {
    console.error('Error finalizing quiz stats:', error);
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
