import { Handler } from '@netlify/functions';
import { assertAuthorizedUser } from './lib/auth';
import { queryWithClient, withTransaction } from './lib/db';
import { getPreviousQuizDate } from './lib/quizDate';

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
    const { quizId, userId, userProfile } = body;

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

    const authError = await assertAuthorizedUser(event, userId, headers, { allowGuest: true });
    if (authError) {
      return authError;
    }

    const quizDate = quizId.replace('quiz-', '');
    const previousQuizDate = getPreviousQuizDate(quizDate);

    const updated = await withTransaction(async (client) => {
      await queryWithClient(
        client,
        `INSERT INTO users (id, display_name, email, avatar_url, created_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (id) DO UPDATE SET
           email = COALESCE(EXCLUDED.email, users.email),
           avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url)`,
        [userId, userProfile?.displayName || null, userProfile?.email || null, userProfile?.avatarUrl || null]
      );

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

      const updatedUsers = await queryWithClient<{ streak: number; best_score: number }>(
        client,
        `UPDATE users
         SET
           streak = CASE
             WHEN last_played = $2::DATE THEN streak
             WHEN last_played = $3::DATE THEN streak + 1
             ELSE 1
           END,
           best_score = GREATEST(best_score, $4),
           total_quizzes = CASE
             WHEN last_played = $2::DATE THEN total_quizzes
             ELSE total_quizzes + 1
           END,
           total_correct = CASE
             WHEN last_played = $2::DATE THEN total_correct
             ELSE total_correct + $5
           END,
           last_played = CASE
             WHEN last_played = $2::DATE THEN last_played
             ELSE $2::DATE
           END
         WHERE id = $1
         RETURNING streak, best_score`,
        [userId, quizDate, previousQuizDate, resultRows[0].score, correctCount]
      );

      return updatedUsers[0] || null;
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
        bestScore: updated.best_score,
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
