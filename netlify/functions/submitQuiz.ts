import { Handler } from '@netlify/functions';
import { query, queryWithClient, withTransaction } from './lib/db';
import { createRequestId, logRequestEnd, logRequestError, logRequestStart } from './lib/observability';
import { calculateQuizPoints } from '../../shared/scoring';
import { validateSubmittedAnswers } from '../../shared/submissionValidation';
import { enforceRateLimit } from './lib/rateLimit';
import { requireCompletedIdentity } from './lib/identity';
import { recomputeUserStreak } from './lib/streaks';
import { getAnswerKeyRows, QuestionSourceError } from './lib/questionSource';

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
  best_score: number | null;
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
    const { quizId, userId, answers } = body;
    logRequestStart({ endpoint: 'submitQuiz', requestId, userId });

    if (!quizId || !userId) {
      return {
        statusCode: 400,
        headers: baseHeaders,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    const validationError = validateSubmittedAnswers(answers);
    if (validationError) {
      return {
        statusCode: 400,
        headers: baseHeaders,
        body: JSON.stringify({ error: validationError }),
      };
    }
    mark('validate');

    if (!userId.startsWith('guest_')) {
      const identity = await requireCompletedIdentity(
        event,
        userId,
        baseHeaders
      );
      if (identity.response) {
        return identity.response;
      }
    }
    mark('auth');

    const rateLimitError = await enforceRateLimit(event, baseHeaders, {
      scope: 'submit-quiz',
      subject: userId,
      limit: 8,
      windowSeconds: 300,
    });
    if (rateLimitError) {
      return rateLimitError;
    }
    mark('rate_limit');

    const quizDateMatch = /^quiz-(\d{4}-\d{2}-\d{2})$/.exec(quizId);
    if (!quizDateMatch) {
      return {
        statusCode: 400,
        headers: baseHeaders,
        body: JSON.stringify({ error: 'Invalid quizId' }),
      };
    }
    const quizDate = quizDateMatch[1];
    const questionIds = answers.map((a) => a.questionId);
    const correctAnswers = await getAnswerKeyRows(quizDate, 'uk', questionIds);
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
        score += calculateQuizPoints(userAnswer.timeRemainingMs);
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

    const correctCount = answersCorrect.filter(Boolean).length;

    const dbResult = await withTransaction(async (client) => {
      const dbTimings: Record<string, number> = {};
      const dbMark = (name: string, startedAt: number) => {
        dbTimings[name] = (dbTimings[name] || 0) + (Date.now() - startedAt);
      };

      let t = Date.now();
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
             u.best_score
           FROM results r
           LEFT JOIN users u ON u.id = r.user_id
           WHERE r.user_id = $1 AND r.quiz_id = $2`,
          [userId, quizId]
        );
        dbMark('existing_fetch', t);
        t = Date.now();
        const streakStatus = await recomputeUserStreak(client, userId, quizDate);
        dbMark('streak_recompute', t);

        return {
          kind: 'existing' as const,
          row: existing[0],
          streakStatus,
          timings: dbTimings,
        };
      }

      t = Date.now();
      const updatedUser = await queryWithClient<{ best_score: number }>(
        client,
        `UPDATE users
         SET
           best_score = GREATEST(best_score, $2),
           total_quizzes = total_quizzes + 1,
           total_correct = total_correct + $3
         WHERE id = $1
         RETURNING best_score`,
        [userId, score, correctCount]
      );
      dbMark('stats_update', t);
      t = Date.now();
      const streakStatus = await recomputeUserStreak(client, userId, quizDate);
      dbMark('streak_recompute', t);

      return {
        kind: 'inserted_sync' as const,
        row: inserted[0],
        userStats: updatedUser[0],
        streakStatus,
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
        streak: dbResult.streakStatus.current,
        bestScore: dbResult.row?.best_score ?? 0,
        statsPending: false,
      };
    } else {
      responseBody = {
        date: quizDate,
        quizId,
        score,
        totalQuestions: answers.length,
        answers: detailedAnswers,
        streak: dbResult.streakStatus.current,
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
      statusCode: error instanceof QuestionSourceError ? 503 : 500,
      headers: baseHeaders,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
