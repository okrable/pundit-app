import { Handler } from '@netlify/functions';
import { assertAuthorizedUser } from './lib/auth';
import { query, queryWithClient, withTransaction } from './lib/db';
import { getPreviousQuizDate, getQuizDate } from './lib/quizDate';
import { createRequestId, logRequestEnd, logRequestError, logRequestStart } from './lib/observability';

interface SubmitQuizRequest {
  quizId: string;
  userId: string;
  answers: {
    questionId: string;
    selectedOptionIndex: number;
    timeRemainingMs?: number;
  }[];
  userProfile?: {
    displayName?: string;
    email?: string;
    avatarUrl?: string;
  };
}

interface CorrectAnswerRow {
  question_id: string;
  player_name: string;
  player_0: string;
  player_1: string;
  player_2: string;
  player_3: string;
}

interface InsertedResultRow {
  quiz_date: string;
  quiz_id: string;
  score: number;
  total_questions: number;
  answers: boolean[];
}

interface ExistingResultWithStatsRow {
  quiz_date: string;
  quiz_id: string;
  score: number;
  total_questions: number;
  answers: boolean[];
  streak: number | null;
  best_score: number | null;
}

interface UserStatsRow {
  streak: number;
  best_score: number;
  last_played: string | null;
}

// Calculate points based on time remaining (correct answers only)
// Max 100 points per question, 500 total
function calculatePoints(timeRemainingMs: number | undefined): number {
  if (timeRemainingMs === undefined) return 60;
  const seconds = timeRemainingMs / 1000;
  if (seconds >= 16) return 100;
  if (seconds >= 12) return 80;
  if (seconds >= 8) return 60;
  if (seconds >= 4) return 40;
  return 20;
}

function buildServerTimingHeader(metrics: Array<{ name: string; durationMs: number }>): string {
  return metrics.map((m) => `${m.name};dur=${m.durationMs}`).join(', ');
}

function cloneHeaders(baseHeaders: Record<string, string>, extra?: Record<string, string>) {
  return {
    ...baseHeaders,
    ...(extra || {}),
  };
}

export const handler: Handler = async (event) => {
  const baseHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: baseHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: baseHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const requestStartedAt = Date.now();
  const requestId = createRequestId();
  const timings: Array<{ name: string; durationMs: number }> = [];
  let phaseStartedAt = requestStartedAt;
  const mark = (name: string) => {
    const now = Date.now();
    timings.push({ name, durationMs: now - phaseStartedAt });
    phaseStartedAt = now;
  };

  try {
    const body: SubmitQuizRequest = JSON.parse(event.body || '{}');
    const { quizId, userId, answers, userProfile } = body;
    logRequestStart({ endpoint: 'submitQuiz', requestId, userId });

    if (!quizId || !userId || !answers || answers.length === 0) {
      return {
        statusCode: 400,
        headers: baseHeaders,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    if (!Array.isArray(answers)) {
      return {
        statusCode: 400,
        headers: baseHeaders,
        body: JSON.stringify({ error: 'answers must be an array' }),
      };
    }

    if (answers.length > 5) {
      return {
        statusCode: 400,
        headers: baseHeaders,
        body: JSON.stringify({ error: 'Too many answers submitted' }),
      };
    }

    const seenQuestionIds = new Set<string>();
    for (const answer of answers) {
      if (!answer?.questionId || typeof answer.selectedOptionIndex !== 'number') {
        return {
          statusCode: 400,
          headers: baseHeaders,
          body: JSON.stringify({ error: 'Each answer must include questionId and selectedOptionIndex' }),
        };
      }

      if (!Number.isInteger(answer.selectedOptionIndex) || answer.selectedOptionIndex < 0 || answer.selectedOptionIndex > 3) {
        return {
          statusCode: 400,
          headers: baseHeaders,
          body: JSON.stringify({ error: 'selectedOptionIndex must be an integer between 0 and 3' }),
        };
      }

      if (
        answer.timeRemainingMs !== undefined &&
        (!Number.isFinite(answer.timeRemainingMs) || answer.timeRemainingMs < 0 || answer.timeRemainingMs > 20_000)
      ) {
        return {
          statusCode: 400,
          headers: baseHeaders,
          body: JSON.stringify({ error: 'timeRemainingMs must be between 0 and 20000' }),
        };
      }

      if (seenQuestionIds.has(answer.questionId)) {
        return {
          statusCode: 400,
          headers: baseHeaders,
          body: JSON.stringify({ error: 'Duplicate questionId in answers' }),
        };
      }

      seenQuestionIds.add(answer.questionId);
    }
    mark('validate');

    const questionIds = answers.map((a) => a.questionId);
    const correctAnswers = await query<CorrectAnswerRow>(
      `SELECT question_id, player_name, player_0, player_1, player_2, player_3
       FROM public.pu_player_ques
       WHERE question_id = ANY($1)`,
      [questionIds]
    );
    const correctAnswersById = new Map(correctAnswers.map((row) => [row.question_id, row]));
    mark('answer_key_fetch');

    let score = 0;
    const detailedAnswers: {
      questionId: string;
      selectedOptionIndex: number;
      correctOptionIndex: number;
      isCorrect: boolean;
    }[] = [];
    const answersCorrect: boolean[] = [];

    for (const userAnswer of answers) {
      const correct = correctAnswersById.get(userAnswer.questionId);
      if (!correct) {
        detailedAnswers.push({
          questionId: userAnswer.questionId,
          selectedOptionIndex: userAnswer.selectedOptionIndex,
          correctOptionIndex: 0,
          isCorrect: false,
        });
        answersCorrect.push(false);
        continue;
      }

      const options = [correct.player_0, correct.player_1, correct.player_2, correct.player_3].filter(Boolean);
      if (userAnswer.selectedOptionIndex >= options.length) {
        return {
          statusCode: 400,
          headers: baseHeaders,
          body: JSON.stringify({ error: `selectedOptionIndex out of bounds for question ${userAnswer.questionId}` }),
        };
      }

      const correctIndex = options.findIndex((opt) => opt === correct.player_name);
      const isCorrect = userAnswer.selectedOptionIndex === correctIndex;
      if (isCorrect) {
        score += calculatePoints(userAnswer.timeRemainingMs);
      }

      detailedAnswers.push({
        questionId: userAnswer.questionId,
        selectedOptionIndex: userAnswer.selectedOptionIndex,
        correctOptionIndex: correctIndex,
        isCorrect,
      });
      answersCorrect.push(isCorrect);
    }
    mark('score');

    const quizDate = quizId.replace('quiz-', '');

    const authError = await assertAuthorizedUser(event, userId, baseHeaders, { allowGuest: true });
    if (authError) {
      return authError;
    }
    mark('auth');

    if (userId.startsWith('guest_')) {
      const responseBody = {
        date: quizDate,
        quizId,
        score,
        totalQuestions: answers.length,
        answers: detailedAnswers,
        streak: 1,
        bestScore: score,
        statsPending: false,
      };

      mark('response_build');
      timings.push({ name: 'total', durationMs: Date.now() - requestStartedAt });
      const headers = cloneHeaders(baseHeaders, { 'Server-Timing': buildServerTimingHeader(timings) });
      logRequestEnd({ endpoint: 'submitQuiz', requestId, userId }, Date.now() - requestStartedAt, 200);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(responseBody),
      };
    }

    const asyncStatsEnabled = process.env.SUBMITQUIZ_ASYNC_STATS_ENABLED === 'true' && quizDate === getQuizDate();
    const correctCount = answersCorrect.filter(Boolean).length;

    const dbResult = await withTransaction(async (client) => {
      const dbTimings: Record<string, number> = {};
      const dbMark = (name: string, startedAt: number) => {
        dbTimings[name] = (dbTimings[name] || 0) + (Date.now() - startedAt);
      };

      // Required for FK on results.user_id and keeps profile fields fresh.
      let t = Date.now();
      await queryWithClient(
        client,
        `INSERT INTO users (id, display_name, email, avatar_url, created_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (id) DO UPDATE SET
           email = COALESCE(EXCLUDED.email, users.email),
           avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url)`,
        [userId, userProfile?.displayName || null, userProfile?.email || null, userProfile?.avatarUrl || null]
      );
      dbMark('user_upsert', t);

      t = Date.now();
      const inserted = await queryWithClient<InsertedResultRow>(
        client,
        `INSERT INTO results (user_id, quiz_id, quiz_date, score, total_questions, answers)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, quiz_id) DO NOTHING
         RETURNING quiz_date::TEXT as quiz_date, quiz_id, score, total_questions, answers`,
        [userId, quizId, quizDate, score, answers.length, answersCorrect]
      );
      dbMark('result_insert', t);

      if (inserted.length === 0) {
        t = Date.now();
        const existing = await queryWithClient<ExistingResultWithStatsRow>(
          client,
          `SELECT
             r.quiz_date::TEXT as quiz_date,
             r.quiz_id,
             r.score,
             r.total_questions,
             r.answers,
             u.streak,
             u.best_score
           FROM results r
           LEFT JOIN users u ON u.id = r.user_id
           WHERE r.user_id = $1 AND r.quiz_id = $2`,
          [userId, quizId]
        );
        dbMark('existing_fetch', t);

        return {
          kind: 'existing' as const,
          row: existing[0],
          timings: dbTimings,
        };
      }

      if (asyncStatsEnabled) {
        t = Date.now();
        const currentStats = await queryWithClient<UserStatsRow>(
          client,
          `SELECT streak, best_score, last_played::TEXT as last_played FROM users WHERE id = $1`,
          [userId]
        );
        dbMark('stats_read', t);

        return {
          kind: 'inserted_async' as const,
          row: inserted[0],
          currentStats: currentStats[0] || null,
          timings: dbTimings,
        };
      }

      const previousQuizDate = getPreviousQuizDate(quizDate);
      t = Date.now();
      const updatedUser = await queryWithClient<{ streak: number; best_score: number }>(
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
        [userId, quizDate, previousQuizDate, score, correctCount]
      );
      dbMark('stats_update', t);

      return {
        kind: 'inserted_sync' as const,
        row: inserted[0],
        userStats: updatedUser[0],
        timings: dbTimings,
      };
    });
    mark('db');

    for (const [name, durationMs] of Object.entries(dbResult.timings)) {
      timings.push({ name, durationMs });
    }

    let responseBody: Record<string, unknown>;
    if (dbResult.kind === 'existing') {
      responseBody = {
        date: dbResult.row?.quiz_date ?? quizDate,
        quizId: dbResult.row?.quiz_id ?? quizId,
        score: dbResult.row?.score ?? score,
        totalQuestions: dbResult.row?.total_questions ?? answers.length,
        answers: dbResult.row?.answers ?? detailedAnswers,
        streak: dbResult.row?.streak ?? 0,
        bestScore: dbResult.row?.best_score ?? 0,
        statsPending: false,
      };
    } else if (dbResult.kind === 'inserted_async') {
      const lastKnownStreak = dbResult.currentStats?.streak ?? 0;
      const lastKnownBestScore = dbResult.currentStats?.best_score ?? 0;
      responseBody = {
        date: quizDate,
        quizId,
        score,
        totalQuestions: answers.length,
        answers: detailedAnswers,
        streak: lastKnownStreak,
        bestScore: Math.max(lastKnownBestScore, score),
        statsPending: true,
        statsRefreshAfterMs: 800,
      };
    } else {
      responseBody = {
        date: quizDate,
        quizId,
        score,
        totalQuestions: answers.length,
        answers: detailedAnswers,
        streak: dbResult.userStats?.streak ?? 0,
        bestScore: dbResult.userStats?.best_score ?? score,
        statsPending: false,
      };
    }
    mark('response_build');

    timings.push({ name: 'total', durationMs: Date.now() - requestStartedAt });
    const headers = cloneHeaders(baseHeaders, {
      'Server-Timing': buildServerTimingHeader(timings),
    });

    logRequestEnd({ endpoint: 'submitQuiz', requestId, userId }, Date.now() - requestStartedAt, 200);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(responseBody),
    };
  } catch (error) {
    logRequestError({ endpoint: 'submitQuiz', requestId }, Date.now() - requestStartedAt, error);
    console.error('Error submitting quiz:', error);
    return {
      statusCode: 500,
      headers: baseHeaders,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
