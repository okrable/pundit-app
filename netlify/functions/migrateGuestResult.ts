import { withLambda, type LambdaHandler } from '@netlify/aws-lambda-compat';
import { queryWithClient, withTransaction } from './lib/db';
import { getQuizDate } from './lib/quizDate';
import type { PoolClient } from 'pg';
import { requireCompletedIdentity } from './lib/identity';
import { recomputeUserStreak } from './lib/streaks';
import type {
  AchievementSyncEnvelope,
  DailyQuizAchievementEvent,
} from '../../shared/achievements';
import {
  applyServerAchievementEvent,
  getServerAchievementSnapshotForUser,
} from './lib/achievements';

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
  achievementEvent?: DailyQuizAchievementEvent;
  achievementSync?: AchievementSyncEnvelope;
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

  const bestScore = results.reduce(
    (best, result) => Math.max(best, Number(result.score || 0)),
    0
  );
  const totalCorrect = results.reduce(
    (sum, result) => sum + countCorrectAnswers(result.answers),
    0
  );
  await queryWithClient(
    client,
    `UPDATE users
     SET
       best_score = $2,
       total_quizzes = $3,
       total_correct = $4
     WHERE id = $1`,
    [userId, bestScore, results.length, totalCorrect]
  );

  const streakStatus = await recomputeUserStreak(client, userId, getQuizDate());
  return { streak: streakStatus.current, bestScore };
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
    const body: MigrateGuestResultRequest = JSON.parse(event.body || '{}');
    const {
      userId,
      quizId,
      score,
      totalQuestions,
      answers,
      achievementEvent: proposedEvent,
      achievementSync,
    } = body;

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

    const identity = await requireCompletedIdentity(event, userId, headers);
    if (identity.response) {
      return identity.response;
    }

    const quizDate = quizId.replace('quiz-', '');

    const migration = await withTransaction(async (client) => {
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
      const canonicalAchievementEvent: DailyQuizAchievementEvent = {
        id: `daily:${quizId}`,
        kind: 'daily-quiz',
        occurredAt: new Date().toISOString(),
        quizDate,
        quizId,
        score,
        answersCorrect: answers,
        correctAtZero:
          proposedEvent?.quizId === quizId &&
          proposedEvent?.quizDate === quizDate &&
          proposedEvent.correctAtZero === true,
        allowCumulative: true,
      };
      const achievements = inserted.length > 0
        ? await applyServerAchievementEvent(
            client,
            userId,
            canonicalAchievementEvent,
            achievementSync
          )
        : {
            snapshot: await getServerAchievementSnapshotForUser(client, userId),
            newlyUnlocked: [],
            rejectedProposedIds: [],
          };
      return {
        migrated: inserted.length > 0,
        ...stats,
        achievements,
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
        achievementSnapshot: migration.achievements.snapshot,
        newlyUnlockedAchievements: migration.achievements.newlyUnlocked,
        rejectedAchievementIds: migration.achievements.rejectedProposedIds,
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

export default withLambda(handler);
