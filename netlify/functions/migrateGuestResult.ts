import { withLambda, type LambdaHandler } from '@netlify/aws-lambda-compat';
import { queryWithClient, withTransaction } from './lib/db';
import { getQuizDate } from './lib/quizDate';
import { recomputeUserQuizStats, withUserResultTransaction } from './lib/quizResults';
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

    const migration = await withUserResultTransaction(userId, async (client) => {
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
