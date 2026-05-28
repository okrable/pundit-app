import { Handler } from '@netlify/functions';
import { queryWithClient, withTransaction } from './lib/db';
import { assertAuthorizedUser } from './lib/auth';
import { getPreviousQuizDate, getQuizDate } from './lib/quizDate';
import type { PoolClient } from 'pg';

interface MigrateGuestResultRequest {
  userId: string; // Auth0 user ID
  quizId: string;
  score: number;
  totalQuestions: number;
  answers: boolean[]; // Boolean array from cached result
  userProfile?: {
    displayName?: string;
    email?: string;
    avatarUrl?: string;
  };
}

interface ResultStatsRow {
  quiz_date: string;
  score: number | string;
  answers: boolean[] | string;
}

function countCorrectAnswers(answers: boolean[] | string): number {
  if (Array.isArray(answers)) {
    return answers.filter(Boolean).length;
  }

  try {
    const parsed = JSON.parse(answers);
    return Array.isArray(parsed) ? parsed.filter(Boolean).length : 0;
  } catch {
    return 0;
  }
}

function calculateCurrentStreak(results: ResultStatsRow[]): number {
  if (results.length === 0) return 0;

  const today = getQuizDate();

  if (results[0].quiz_date !== today) {
    return 0;
  }

  let streak = 1;
  let expectedDate = today;

  for (let i = 1; i < results.length; i++) {
    expectedDate = getPreviousQuizDate(expectedDate);

    if (results[i].quiz_date === expectedDate) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

async function recomputeUserQuizStats(
  client: PoolClient,
  userId: string
): Promise<{ streak: number; bestScore: number }> {
  const results = await queryWithClient<ResultStatsRow>(
    client,
    `SELECT quiz_date::TEXT as quiz_date, score, answers
     FROM results
     WHERE user_id = $1
     ORDER BY quiz_date DESC`,
    [userId]
  );

  const streak = calculateCurrentStreak(results);
  const bestScore = results.reduce(
    (best, result) => Math.max(best, Number(result.score || 0)),
    0
  );
  const totalCorrect = results.reduce(
    (sum, result) => sum + countCorrectAnswers(result.answers),
    0
  );
  const lastPlayed = results[0]?.quiz_date ?? null;

  await queryWithClient(
    client,
    `UPDATE users
     SET
       streak = $2,
       best_score = $3,
       total_quizzes = $4,
       total_correct = $5,
       last_played = $6::DATE
     WHERE id = $1`,
    [userId, streak, bestScore, results.length, totalCorrect, lastPlayed]
  );

  return { streak, bestScore };
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
    const body: MigrateGuestResultRequest = JSON.parse(event.body || '{}');
    const { userId, quizId, score, totalQuestions, answers, userProfile } = body;

    // Validate request
    if (!userId || !quizId || score === undefined || !answers || answers.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    // Don't allow guest user IDs
    if (userId.startsWith('guest_')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Cannot migrate to a guest user' }),
      };
    }

    const authError = await assertAuthorizedUser(event, userId, headers, { allowGuest: false });
    if (authError) {
      return authError;
    }

    const quizDate = quizId.replace('quiz-', '');

    const migration = await withTransaction(async (client) => {
      // Upsert user record
      await queryWithClient(
        client,
        `INSERT INTO users (id, display_name, email, avatar_url, created_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (id) DO UPDATE SET
           email = COALESCE(EXCLUDED.email, users.email),
           avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url)`,
        [userId, userProfile?.displayName || null, userProfile?.email || null, userProfile?.avatarUrl || null]
      );

      // Insert result with boolean array. If it already exists, this is an idempotent retry.
      const inserted = await queryWithClient<{ id: string }>(
        client,
        `INSERT INTO results (user_id, quiz_id, quiz_date, score, total_questions, answers)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, quiz_id) DO NOTHING
         RETURNING id`,
        [userId, quizId, quizDate, score, totalQuestions, answers]
      );

      const stats = await recomputeUserQuizStats(client, userId);
      return {
        migrated: inserted.length > 0,
        ...stats,
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        migrated: migration.migrated,
        message: migration.migrated ? undefined : 'Result already exists for this quiz',
        streak: migration.streak,
        bestScore: migration.bestScore,
      }),
    };
  } catch (error) {
    console.error('Error migrating guest result:', error);
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
