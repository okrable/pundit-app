import type { Quiz } from '../app/types';

export const DAILY_QUIZ_ATTEMPT_SCHEMA_VERSION = 1;
export const DAILY_QUIZ_TIMER_MS = 20_000;
export const DAILY_QUIZ_REVEAL_DELAY_MS = 1_000;
export const DAILY_QUIZ_RESULT_HOLD_MS = 1_650;
export const DAILY_QUIZ_EXIT_DELAY_MS = 1_700;

export type DailyQuizAttemptPhase =
  | 'preparing'
  | 'answer_locked'
  | 'answering'
  | 'result_reveal'
  | 'exiting'
  | 'completing';

export interface DailyQuizAttempt {
  schemaVersion: typeof DAILY_QUIZ_ATTEMPT_SCHEMA_VERSION;
  userId: string;
  quizId: string;
  quizDate: string;
  contentSignature: string;
  questionIndex: number;
  answers: Record<string, number>;
  answerTimings: Record<string, number>;
  score: number;
  pendingPoints: number;
  phase: DailyQuizAttemptPhase;
  timerEndsAt: number | null;
  phaseEndsAt: number | null;
  startedAt: number;
  updatedAt: number;
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function getDailyQuizContentSignature(quiz: Quiz): string {
  return stableHash(
    JSON.stringify(
      quiz.questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        options: question.options,
        correctOptionIndex: question.correctOptionIndex,
      }))
    )
  );
}

export function createDailyQuizAttempt(
  userId: string,
  quiz: Quiz,
  now = Date.now()
): DailyQuizAttempt {
  return {
    schemaVersion: DAILY_QUIZ_ATTEMPT_SCHEMA_VERSION,
    userId,
    quizId: quiz.id,
    quizDate: quiz.date,
    contentSignature: getDailyQuizContentSignature(quiz),
    questionIndex: 0,
    answers: {},
    answerTimings: {},
    score: 0,
    pendingPoints: 0,
    phase: 'preparing',
    timerEndsAt: null,
    phaseEndsAt: null,
    startedAt: now,
    updatedAt: now,
  };
}

export function isDailyQuizAttempt(value: unknown): value is DailyQuizAttempt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const attempt = value as Partial<DailyQuizAttempt>;
  const validPhases: DailyQuizAttemptPhase[] = [
    'preparing',
    'answer_locked',
    'answering',
    'result_reveal',
    'exiting',
    'completing',
  ];
  const isIntegerRecord = (record: unknown): record is Record<string, number> =>
    Boolean(
      record &&
        typeof record === 'object' &&
        !Array.isArray(record) &&
        Object.values(record).every(
          (entry) => Number.isInteger(entry) && entry >= 0
        )
    );
  const isTimestamp = (timestamp: unknown): timestamp is number | null =>
    timestamp === null ||
    (typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp >= 0);
  return (
    attempt.schemaVersion === DAILY_QUIZ_ATTEMPT_SCHEMA_VERSION &&
    typeof attempt.userId === 'string' &&
    typeof attempt.quizId === 'string' &&
    typeof attempt.quizDate === 'string' &&
    typeof attempt.contentSignature === 'string' &&
    Number.isInteger(attempt.questionIndex) &&
    (attempt.questionIndex ?? -1) >= 0 &&
    isIntegerRecord(attempt.answers) &&
    isIntegerRecord(attempt.answerTimings) &&
    Number.isInteger(attempt.score) &&
    (attempt.score ?? -1) >= 0 &&
    Number.isInteger(attempt.pendingPoints) &&
    (attempt.pendingPoints ?? -1) >= 0 &&
    validPhases.includes(attempt.phase as DailyQuizAttemptPhase) &&
    isTimestamp(attempt.timerEndsAt) &&
    isTimestamp(attempt.phaseEndsAt) &&
    isTimestamp(attempt.startedAt) &&
    attempt.startedAt !== null &&
    isTimestamp(attempt.updatedAt) &&
    attempt.updatedAt !== null
  );
}

export function isDailyQuizAttemptCompatible(
  attempt: DailyQuizAttempt,
  userId: string,
  quiz: Quiz,
  quizDate: string
): boolean {
  return (
    attempt.userId === userId &&
    attempt.quizDate === quizDate &&
    attempt.quizId === quiz.id &&
    attempt.questionIndex < quiz.questions.length &&
    attempt.contentSignature === getDailyQuizContentSignature(quiz)
  );
}

export function getDailyQuizRemainingMs(
  attempt: DailyQuizAttempt,
  now = Date.now()
): number {
  if (attempt.phase !== 'answering' || attempt.timerEndsAt === null) return 0;
  return Math.max(attempt.timerEndsAt - now, 0);
}

export function getDailyQuizRemainingSeconds(
  attempt: DailyQuizAttempt,
  now = Date.now()
): number {
  return Math.ceil(getDailyQuizRemainingMs(attempt, now) / 1000);
}

export function normalizeDailyQuizAttempt(
  original: DailyQuizAttempt,
  totalQuestions: number,
  now = Date.now()
): DailyQuizAttempt {
  let attempt = { ...original };
  let safety = 0;

  while (
    attempt.phaseEndsAt !== null &&
    attempt.phaseEndsAt <= now &&
    safety < 8
  ) {
    safety += 1;
    if (attempt.phase === 'answer_locked') {
      const nextDeadline = attempt.phaseEndsAt + DAILY_QUIZ_RESULT_HOLD_MS;
      attempt = {
        ...attempt,
        score: attempt.score + attempt.pendingPoints,
        pendingPoints: 0,
        phase: 'result_reveal',
        phaseEndsAt: nextDeadline,
      };
      continue;
    }

    if (attempt.phase === 'result_reveal') {
      attempt = {
        ...attempt,
        phase: 'exiting',
        phaseEndsAt: attempt.phaseEndsAt + DAILY_QUIZ_EXIT_DELAY_MS,
      };
      continue;
    }

    if (attempt.phase === 'exiting') {
      const isLastQuestion = attempt.questionIndex >= totalQuestions - 1;
      attempt = {
        ...attempt,
        phase: isLastQuestion ? 'completing' : 'preparing',
        questionIndex: isLastQuestion
          ? attempt.questionIndex
          : attempt.questionIndex + 1,
        timerEndsAt: null,
        phaseEndsAt: null,
      };
      continue;
    }

    break;
  }

  return attempt.updatedAt === now ? attempt : { ...attempt, updatedAt: now };
}
