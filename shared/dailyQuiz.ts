import { PERFECT_DAILY_SCORE } from './scoring';

export const DAILY_QUIZ_NUMBER_ONE_DATE = '2025-09-28';
const QUIZ_NUMBER_ONE_UTC = Date.UTC(2025, 8, 28);
const DAY_MS = 24 * 60 * 60 * 1000;

export const DATED_DAILY_QUIZ_CACHE_CONTROL =
  'public, max-age=300, stale-while-revalidate=21600';
export const UNDATED_DAILY_QUIZ_CACHE_CONTROL = 'no-store';

interface DateScopedQuiz {
  id: string;
  date: string;
}

interface DailyQuizShareInput {
  date: string;
  score: number;
  answers: boolean[];
}

function parseQuizDateUtc(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return timestamp;
}

export function isQuizForDate(
  quiz: DateScopedQuiz | null | undefined,
  targetDate: string
): boolean {
  return Boolean(
    quiz &&
      quiz.date === targetDate &&
      quiz.id === `quiz-${targetDate}`
  );
}

export function getDailyQuizCacheControl(hasExplicitDate: boolean): string {
  return hasExplicitDate
    ? DATED_DAILY_QUIZ_CACHE_CONTROL
    : UNDATED_DAILY_QUIZ_CACHE_CONTROL;
}

export function buildDailyQuizPath(date?: string): string {
  return date
    ? `/getDailyQuiz?date=${encodeURIComponent(date)}`
    : '/getDailyQuiz';
}

export function getDailyQuizNumber(date: string): number | null {
  const timestamp = parseQuizDateUtc(date);
  if (timestamp === null || timestamp < QUIZ_NUMBER_ONE_UTC) {
    return null;
  }

  return Math.floor((timestamp - QUIZ_NUMBER_ONE_UTC) / DAY_MS) + 1;
}

export function formatDailyQuizShare({
  date,
  score,
  answers,
}: DailyQuizShareInput): string {
  const quizNumber = getDailyQuizNumber(date);
  const heading = quizNumber === null
    ? 'Pundit Trivia'
    : `Pundit Trivia #${quizNumber}`;
  const answerEmojiRow = answers
    .map((isCorrect) => (isCorrect ? '⚽️' : '❌'))
    .join('');
  const isPerfect = score === PERFECT_DAILY_SCORE;

  return [
    heading,
    answerEmojiRow,
    '',
    `${isPerfect ? '🐐' : '🏆'} ${score}/${PERFECT_DAILY_SCORE}`,
    '',
    isPerfect ? 'I know football. Do you?' : 'Can you beat that?',
    '👉 https://pundittrivia.com/',
    '',
    '#ThinkYouKnowFootball?',
  ].join('\n');
}
