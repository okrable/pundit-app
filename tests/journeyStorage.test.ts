import test from 'node:test';
import assert from 'node:assert/strict';
import { createJourneyRepository } from '../shared/journeyStorage';
import type { CareerGameResult } from '../app/types';
const result: CareerGameResult = {
  date: '2026-09-08',
  gameId: 'career-2026-09-08',
  completed: true,
  canonicalName: 'Alan Shearer',
  submittedAnswer: '',
  outcome: 'given_up',
  syncState: 'pending',
};
function fixture() {
  const data = new Map<string, string>();
  let fail = false;
  const storage = {
    getItem: async (k: string) => data.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      if (fail) throw Error('disk full');
      data.set(k, v);
    },
    multiRemove: async (keys: string[]) => {
      keys.forEach((k) => data.delete(k));
    },
  };
  return {
    data,
    repo: createJourneyRepository(storage),
    fail: () => {
      fail = true;
    },
  };
}
test('Journey outbox and outcome are stored together and isolated by account', async () => {
  const f = fixture();
  await f.repo.save(result, 'a');
  await f.repo.save({ ...result, outcome: 'solved' }, 'b');
  assert.equal((await f.repo.read('a'))?.outcome, 'given_up');
  assert.equal((await f.repo.read('a'))?.syncState, 'pending');
  assert.equal((await f.repo.read('b'))?.outcome, 'solved');
  assert.equal(await f.repo.read(), null);
});
test('Journey failed storage does not claim durable completion', async () => {
  const f = fixture();
  f.fail();
  await assert.rejects(f.repo.save(result, 'a'));
  assert.equal(await f.repo.read('a'), null);
});
test('canonical outcome supersedes provisional; stale writes cannot erase it or the next day', async () => {
  const f = fixture();
  await f.repo.save(result, 'a');
  await f.repo.save({ ...result, outcome: 'solved' }, 'a', 'synced');
  await f.repo.save(result, 'a');
  assert.equal((await f.repo.read('a'))?.outcome, 'solved');
  await f.repo.save(
    { ...result, date: '2026-09-09', gameId: 'career-2026-09-09' },
    'a',
  );
  await f.repo.save(result, 'a', 'synced');
  assert.equal((await f.repo.read('a'))?.date, '2026-09-09');
});
test('legacy solves remain readable and guest adoption is durably bound before removal', async () => {
  const f = fixture();
  f.data.set(
    '@pundit_daily_career_result_guest',
    JSON.stringify({ ...result, outcome: undefined }),
  );
  const guest = await f.repo.read();
  assert.equal(guest?.outcome, 'solved');
  await f.repo.save(guest!, 'a', 'pending');
  await f.repo.clearGuest();
  assert.equal(await f.repo.read(), null);
  assert.equal((await f.repo.read('a'))?.syncState, 'pending');
  assert.equal(await f.repo.read('b'), null);
});
