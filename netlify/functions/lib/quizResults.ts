import type { PoolClient } from 'pg';
import { queryWithClient, withTransaction } from './db';
import { recomputeUserStreak } from './streaks';
import { getQuizDate } from './quizDate';
import type { QuizAnswerDetail } from '../../../app/types';

export interface StoredQuizResult {
  quiz_date: string; quiz_id: string; score: number; total_questions: number;
  answers: boolean[]; answer_details: QuizAnswerDetail[] | null;
}

export function serializeQuizResult(row: StoredQuizResult) {
  const details = Array.isArray(row.answer_details) ? row.answer_details : [];
  return {
    date: row.quiz_date, quizId: row.quiz_id, score: Number(row.score),
    totalQuestions: Number(row.total_questions),
    // Never use the retry payload to fill historical gaps.
    answers: row.answers.map((isCorrect, index) => ({ ...details[index], isCorrect })),
    statsPending: false,
  };
}

export async function readQuizResult(client: PoolClient, userId: string, quizId: string) {
  const rows = await queryWithClient<StoredQuizResult>(client,
    `SELECT quiz_date::TEXT AS quiz_date, quiz_id, score, total_questions, answers, answer_details
     FROM results WHERE user_id=$1 AND quiz_id=$2`, [userId, quizId]);
  return rows[0] ?? null;
}

export async function withUserResultTransaction<T>(userId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await withTransaction(async (client) => {
        await queryWithClient(client, 'SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
        return fn(client);
      });
    } catch (error) {
      if ((error as { code?: string }).code !== '40001' || attempt >= 2) throw error;
    }
  }
}

export async function recomputeUserQuizStats(client: PoolClient, userId: string) {
  const rows = await queryWithClient<{ score: number; answers: boolean[] }>(client,
    'SELECT score, answers FROM results WHERE user_id=$1', [userId]);
  const bestScore = rows.reduce((best, row) => Math.max(best, Number(row.score)), 0);
  const totalCorrect = rows.reduce((sum, row) => sum + row.answers.filter(v => v === true).length, 0);
  await queryWithClient(client,
    'UPDATE users SET best_score=$2, total_quizzes=$3, total_correct=$4 WHERE id=$1',
    [userId, bestScore, rows.length, totalCorrect]);
  const streak = await recomputeUserStreak(client, userId, getQuizDate());
  return { streak: streak.current, bestScore };
}
