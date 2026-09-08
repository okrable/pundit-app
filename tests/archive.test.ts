import test from 'node:test';
import assert from 'node:assert/strict';
import {
  archiveShare,
  completeArchive,
  createArchiveRepository,
  emptyArchive,
  isArchiveDate,
  parseArchive,
  startArchive,
  validArchiveQuiz,
  type ArchiveQuiz,
} from '../shared/archive';
import {
  getDailyQuizContentSignature,
  normalizeDailyQuizAttempt,
} from '../shared/dailyQuizAttempt';
import { buildArchiveCatalog } from '../netlify/functions/lib/archiveContent';
import { createArchiveHandler } from '../netlify/functions/lib/archiveApi';
import { normalizeAnalyticsProperties } from '../shared/analytics';
import { searchPlayers } from '../shared/playerSearch';
const base = {
  id: 'archive-2026-09-07',
  date: '2026-09-07',
  questions: Array.from({ length: 5 }, (_, i) => ({
    id: `q${i}`,
    prompt: `Question ${i}`,
    options: ['A', 'B', 'C', 'D'],
    correctOptionIndex: 0,
  })),
};
const quiz: ArchiveQuiz = {
  ...base,
  contentVersion: getDailyQuizContentSignature(base),
  source: { system: 'bigquery', licensingStatus: 'unknown' },
};

test('archive admits past real dates only', () => {
  for (const date of ['2026-09-08', '2026-09-09', '2026-02-30', 'nonsense'])
    assert.equal(isArchiveDate(date, '2026-09-08'), false);
  assert.equal(isArchiveDate('2026-03-29', '2026-03-30'), true);
});
test('restoration is identity and content scoped with wall-clock timer', () => {
  let r = startArchive(emptyArchive('guest_a'), structuredClone(quiz), 1000);
  r.active!.attempt.phase = 'answering';
  r.active!.attempt.timerEndsAt = 21000;
  assert.equal(
    parseArchive(JSON.stringify(r), 'guest_a').active?.attempt.timerEndsAt,
    21000,
  );
  assert.equal(parseArchive(JSON.stringify(r), 'auth_b').active, null);
  r.active!.quiz.questions[0].prompt = 'Corrected content';
  assert.equal(parseArchive(JSON.stringify(r), 'guest_a').active, null);
});
test('completion stores only latest local summary and supports deliberate replay', () => {
  const q = { ...quiz, questions: base.questions.map((q) => ({ ...q })) };
  q.contentVersion = getDailyQuizContentSignature(q);
  let r = startArchive(emptyArchive('a'), q, 1000);
  const a = r.active!.attempt;
  a.answers = Object.fromEntries(q.questions.map((q) => [q.id, 0]));
  a.questionIndex = 4;
  a.phase = 'answer_locked';
  a.phaseEndsAt = 2000;
  a.score = 400;
  a.pendingPoints = 100;
  a.answerTimings = Object.fromEntries(q.questions.map((q) => [q.id, 20000]));
  a.phase = normalizeDailyQuizAttempt(a, 5, 10000).phase;
  // Use the normalizer's entire result so pending points apply exactly once.
  r.active!.attempt = normalizeDailyQuizAttempt(
    { ...a, phase: 'answer_locked' },
    5,
    10000,
  );
  r = completeArchive(r, 10000);
  assert.equal(r.active, null);
  assert.equal(r.results[q.date].score, 500);
  assert.equal(Object.keys(r.results).length, 1);
  assert.match(archiveShare(r.results[q.date]), /Pundit Archive/);
  r = startArchive(r, q, 11000);
  assert.equal(r.active!.attempt.score, 0);
  assert.equal(r.results[q.date].score, 500);
});
test('storage serializes updates and does not acknowledge failed writes', async () => {
  const data = new Map<string, string>();
  let fail = false;
  const repo = createArchiveRepository({
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      if (fail) throw Error('disk full');
      data.set(k, v);
    },
  });
  await repo.update('a', (r) => startArchive(r, quiz));
  await Promise.all([
    repo.update('a', (r) => ({
      ...r,
      active: { ...r.active!, attempt: { ...r.active!.attempt, score: 100 } },
    })),
    repo.update('a', (r) => ({
      ...r,
      active: {
        ...r.active!,
        attempt: { ...r.active!.attempt, score: r.active!.attempt.score + 100 },
      },
    })),
  ]);
  assert.equal((await repo.read('a')).active!.attempt.score, 200);
  assert.equal((await repo.read('b')).active, null);
  fail = true;
  await assert.rejects(
    repo.update('a', (r) => ({ ...r, active: null })),
    /disk full/,
  );
  assert.notEqual((await repo.read('a')).active, null);
});
test('archive handlers paginate and reject current/future reads', async () => {
  const data = Array.from({ length: 25 }, (_, i) => ({
    ...quiz,
    date: `2026-08-${String(31 - i).padStart(2, '0')}`,
  }));
  const handler = createArchiveHandler(
    'catalog',
    async () => data,
    () => '2026-09-08',
  );
  const page = await (
    await handler(new Request('https://example.test/getArchiveCatalog'))
  ).json();
  assert.equal(page.quizzes.length, 20);
  assert.equal(page.nextCursor, '2026-08-12');
  const next = await (
    await handler(
      new Request(
        `https://example.test/getArchiveCatalog?before=${page.nextCursor}`,
      ),
    )
  ).json();
  assert.equal(next.quizzes.length, 5);
  assert.equal(next.nextCursor, null);
  const read = createArchiveHandler(
    'quiz',
    async () => data,
    () => '2026-09-08',
  );
  assert.equal(
    (
      await read(
        new Request('https://example.test/getArchiveQuiz?date=2026-09-08'),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await read(
        new Request('https://example.test/getArchiveQuiz?date=2026-08-01'),
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await handler(
        new Request('https://example.test/getArchiveCatalog', {
          method: 'POST',
        }),
      )
    ).status,
    405,
  );
});
test('catalogue rejects incomplete or invalid quizzes independently of Journey', () => {
  const old = process.env.BIGQUERY_CUTOVER_DATE;
  process.env.BIGQUERY_CUTOVER_DATE = '2026-07-01';
  try {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      date: '2026-09-07',
      rank: i + 1,
      question_id: `q${i}`,
      question: 'Prompt',
      player_id: 'p',
      player_name: 'A',
      player_0: 'A',
      player_1: 'B',
      player_2: 'C',
      player_3: 'D',
      correct_answer_position: 0,
    }));
    assert.equal(buildArchiveCatalog(rows, '2026-09-08', 'bigquery').length, 1);
    assert.equal(
      buildArchiveCatalog(rows.slice(1), '2026-09-08', 'bigquery').length,
      0,
    );
    assert.equal(
      buildArchiveCatalog([...rows, { ...rows[0] }], '2026-09-08', 'bigquery')
        .length,
      0,
    );
  } finally {
    if (old === undefined) delete process.env.BIGQUERY_CUTOVER_DATE;
    else process.env.BIGQUERY_CUTOVER_DATE = old;
  }
});
test('autocomplete keeps a stable broad catalogue, accent and approved alias matching', () => {
  const players = Array.from({ length: 12 }, (_, i) => ({
    id: `p${i}`,
    name: `João ${i}`,
    birthYear: '1980',
  }));
  assert.equal(searchPlayers(players, 'j').length, 0);
  assert.equal(searchPlayers(players, 'jo').length, 8);
  assert.equal(
    searchPlayers(
      [{ id: 'x', name: 'Edson Arantes', aliases: ['Pele'] }],
      'pel',
    )[0].name,
    'Edson Arantes',
  );
  assert.deepEqual(
    searchPlayers(players, 'jo'),
    searchPlayers([...players].reverse(), 'jo'),
  );
});
test('archive payload validation and analytics reject arbitrary content', () => {
  assert.equal(validArchiveQuiz(quiz), true);
  assert.equal(validArchiveQuiz({ ...quiz, id: 'quiz-2026-09-07' }), false);
  for (const key of ['guess', 'searchText', 'answer', 'query'])
    assert.equal(normalizeAnalyticsProperties({ [key]: 'secret' }), null);
});
