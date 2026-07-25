import { Handler } from '@netlify/functions';
import { queryWithClient, withTransaction } from './lib/db';
import { requireCompletedIdentity } from './lib/identity';
import { recomputeUserStreak } from './lib/streaks';

interface FinalizeStatsRequest {
  quizId: string;
  userId: string;
  userProfile?: {
    displayName?: string;
    email?: string;
    avatarUrl?: string;
  };
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

    const quizDate = quizId.replace('quiz-', '');

    const updated = await withTransaction(async (client) => {
      const resultRows = await queryWithClient<{
        score: number;
        answers: boolean[];
      }>(
        client,
        `SELECT score, answers
         FROM results
         WHERE user_id = $1 AND quiz_id = $2`,
        [userId, quizId]
      );

      if (resultRows.length === 0) {
        return null;
      }

      const correctCount = (resultRows[0].answers || []).filter(Boolean).length;

      const updatedUsers = await queryWithClient<{ best_score: number }>(
        client,
        `UPDATE users
         SET
           best_score = GREATEST(best_score, $3),
           total_quizzes = CASE
             WHEN last_played = $2::DATE THEN total_quizzes
             ELSE total_quizzes + 1
           END,
           total_correct = CASE
             WHEN last_played = $2::DATE THEN total_correct
             ELSE total_correct + $4
           END
         WHERE id = $1
         RETURNING best_score`,
        [userId, quizDate, resultRows[0].score, correctCount]
      );

      if (!updatedUsers[0]) {
        return null;
      }

      const streakStatus = await recomputeUserStreak(client, userId, quizDate);
      return {
        bestScore: updatedUsers[0].best_score,
        streak: streakStatus.current,
      };
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
