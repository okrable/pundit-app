import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeQuizResult, recomputeUserQuizStats } from '../netlify/functions/lib/quizResults';
import { createSubmitQuizHandler } from '../netlify/functions/submitQuiz';
import type { StoredQuizResult } from '../netlify/functions/lib/quizResults';

const row: StoredQuizResult = { quiz_id: 'quiz-2026-09-08', quiz_date: '2026-09-08', score: 370,
  total_questions: 5, answers: [true, true, false, true, true], answer_details: null };
test('historical snapshots preserve correctness without invented answer detail', () => {
  assert.deepEqual(serializeQuizResult(row).answers, row.answers.map(isCorrect => ({ isCorrect })));
  assert.equal(serializeQuizResult(row).score, 370);
});
test('stored answer details and timings survive serialization', () => {
  const details = [{ questionId: 'q1', selectedOptionIndex: 2, correctOptionIndex: 2, timeRemainingMs: 17000, isCorrect: true }];
  assert.deepEqual(serializeQuizResult({ ...row, answers: [true], answer_details: details }).answers, details);
});
test('lost response retries return stored score without fetching keys or awarding again', async () => {
  let reads = 0, awards = 0;
  const handler = createSubmitQuizHandler({
    requireCompletedIdentity: async () => ({}), enforceRateLimit: async () => null,
    withUserResultTransaction: async (_id: string, fn: (c: unknown) => unknown) => fn({}),
    readQuizResult: async () => { reads++; return row; },
    getAnswerKeyRows: async () => { throw new Error('must not fetch changed/unavailable content'); },
    applyServerAchievementEvent: async () => { awards++; throw new Error('duplicate award'); },
    applyServerAchievementAcknowledgements: async () => undefined,
    getServerAchievementSnapshotForUser: async () => ({}),
    recomputeUserQuizStats: async () => ({ streak: 2, bestScore: 400 }),
  } as any);
  for (const selectedOptionIndex of [0, 3]) {
    const response = await handler({ httpMethod: 'POST', body: JSON.stringify({
      quizId: row.quiz_id, userId: 'auth0|a', answers: [{ questionId: 'changed', selectedOptionIndex, timeRemainingMs: 20000 }],
    }) } as any, {} as any) as any;
    assert.equal(response.statusCode, 200);
    const result = JSON.parse(response.body);
    assert.equal(result.score, 370);
    assert.deepEqual(result.answers, row.answers.map(isCorrect => ({ isCorrect })));
    assert.deepEqual(result.newlyUnlockedAchievements, []);
  }
  assert.equal(reads, 2); assert.equal(awards, 0);
});
test('stats are projections of all rows on every finalization', async () => {
  const updates: unknown[][] = [];
  const client = { query: async (sql: string, values: unknown[]) => {
    if (sql.startsWith('SELECT score')) return { rows: [{ score: 300, answers: [true, false] }, { score: 200, answers: [true, true] }] };
    if (sql.startsWith('SELECT DISTINCT')) return { rows: [{ quiz_date: '2026-09-07' }, { quiz_date: '2026-09-08' }] };
    if (sql.includes('total_quizzes')) updates.push(values);
    return { rows: [] };
  } };
  await recomputeUserQuizStats(client as any, 'a');
  await recomputeUserQuizStats(client as any, 'a');
  assert.deepEqual(updates, [['a', 300, 2, 3], ['a', 300, 2, 3]]);
});
