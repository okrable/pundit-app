import type { Quiz } from '../app/types';
import {
  createDailyQuizAttempt,
  getDailyQuizContentSignature,
  isDailyQuizAttempt,
  isDailyQuizAttemptCompatible,
  normalizeDailyQuizAttempt,
  type DailyQuizAttempt,
} from './dailyQuizAttempt';
export interface ArchiveQuiz extends Quiz {
  contentVersion: string;
  source: {
    system: 'bigquery' | 'cockroach';
    licensingStatus: 'unknown';
    generatedAt?: string;
    questions?: {questionId:string;playerId:string|null}[];
  };
}
export interface ArchiveSummary {
  date: string;
  score: number;
  answers: boolean[];
  contentVersion: string;
  completedAt: string;
}
export interface ArchiveRecord {
  schemaVersion: 1;
  userId: string;
  active: { quiz: ArchiveQuiz; attempt: DailyQuizAttempt } | null;
  results: Record<string, ArchiveSummary>;
}
export const canAccessArchive = () => true; // Free in v2.14; all archive endpoints enforce this policy.
export function isArchiveDate(date: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date >= today) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
}
export function emptyArchive(userId: string): ArchiveRecord {
  return { schemaVersion: 1, userId, active: null, results: {} };
}
export function validArchiveQuiz(quiz: ArchiveQuiz): boolean {
  return Boolean(
    quiz &&
      quiz.id === `archive-${quiz.date}` &&
      Array.isArray(quiz.questions) &&
      quiz.questions.length === 5 &&
      new Set(quiz.questions.map((q) => q.id)).size === 5 &&
      quiz.questions.every(
        (q) =>
          typeof q.id === 'string' &&
          q.id &&
          typeof q.prompt === 'string' &&
          q.prompt.trim() &&
          Array.isArray(q.options) &&
          q.options.length === 4 &&
          q.options.every((o) => typeof o === 'string' && o.trim()) &&
          new Set(q.options).size === 4 &&
          Number.isInteger(q.correctOptionIndex) &&
          (q.correctOptionIndex ?? -1) >= 0 &&
          (q.correctOptionIndex ?? 4) < 4,
      ) &&
      quiz.contentVersion === getDailyQuizContentSignature(quiz),
  );
}
export function parseArchive(
  raw: string | null,
  userId: string,
): ArchiveRecord {
  if (!raw) return emptyArchive(userId);
  try {
    const r = JSON.parse(raw) as ArchiveRecord;
    if (
      r.schemaVersion !== 1 ||
      r.userId !== userId ||
      !r.results ||
      typeof r.results !== 'object' ||
      Array.isArray(r.results)
    )
      return emptyArchive(userId);
    const results: Record<string, ArchiveSummary> = {};
    for (const [date, s] of Object.entries(r.results)) {
      if (
        s &&
        s.date === date &&
        Number.isInteger(s.score) &&
        s.score >= 0 &&
        s.score <= 500 &&
        Array.isArray(s.answers) &&
        s.answers.length === 5 &&
        s.answers.every((a) => typeof a === 'boolean') &&
        typeof s.contentVersion === 'string' &&
        typeof s.completedAt === 'string'
      )
        results[date] = s;
    }
    const active =
      r.active &&
      validArchiveQuiz(r.active.quiz) &&
      isDailyQuizAttempt(r.active.attempt) &&
      isDailyQuizAttemptCompatible(
        r.active.attempt,
        userId,
        r.active.quiz,
        r.active.quiz.date,
      )
        ? r.active
        : null;
    return { ...r, results, active };
  } catch {
    return emptyArchive(userId);
  }
}
export function startArchive(
  record: ArchiveRecord,
  quiz: ArchiveQuiz,
  now = Date.now(),
): ArchiveRecord {
  if (!validArchiveQuiz(quiz)) throw Error('Invalid archive content');
  return {
    ...record,
    active: { quiz, attempt: createDailyQuizAttempt(record.userId, quiz, now) },
  };
}
export function completeArchive(
  record: ArchiveRecord,
  now = Date.now(),
): ArchiveRecord {
  if (!record.active) return record;
  const { quiz } = record.active;
  const a = normalizeDailyQuizAttempt(record.active.attempt, 5, now);
  if (
    a.phase !== 'completing' ||
    quiz.questions.some((q) => a.answers[q.id] === undefined)
  )
    throw Error('Archive round incomplete');
  return {
    ...record,
    active: null,
    results: {
      ...record.results,
      [quiz.date]: {
        date: quiz.date,
        score: a.score,
        answers: quiz.questions.map(
          (q) => a.answers[q.id] === q.correctOptionIndex,
        ),
        contentVersion: quiz.contentVersion,
        completedAt: new Date(now).toISOString(),
      },
    },
  };
}
export function archiveShare(summary: ArchiveSummary) {
  return `Pundit Archive — ${summary.date}\n${summary.score}/500\n${summary.answers.map((a) => (a ? '⚽️' : '❌')).join('')}\nhttps://pundittrivia.com/`;
}
export interface ArchiveStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
}
export function createArchiveRepository(storage: ArchiveStorage) {
  const queues = new Map<string, Promise<unknown>>();
  const key = (id: string) => `@pundit_archive_v1_${id}`;
  return {
    async read(id: string) {
      await queues.get(id);
      return parseArchive(await storage.getItem(key(id)), id);
    },
    update(
      id: string,
      change: (r: ArchiveRecord) => ArchiveRecord,
    ): Promise<ArchiveRecord> {
      const work = (queues.get(id) ?? Promise.resolve())
        .catch(() => {})
        .then(async () => {
          const next = change(parseArchive(await storage.getItem(key(id)), id));
          if (next.userId !== id) throw Error('Archive identity mismatch');
          await storage.setItem(key(id), JSON.stringify(next));
          return next;
        });
      queues.set(
        id,
        work.catch(() => {}),
      );
      return work;
    },
  };
}
