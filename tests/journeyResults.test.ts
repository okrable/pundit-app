import test from 'node:test';
import assert from 'node:assert/strict';
import { persistJourneyOutcome, JourneyResultError, type JourneyRow } from '../netlify/functions/lib/journeyResults';
import { journeyShare } from '../shared/journeyOutcome';

function fixture() {
  let row: JourneyRow | null = null;
  let tail: Promise<unknown> = Promise.resolve();
  let reads = 0;
  const deps = {
    transaction: (_id: string, fn: (client: unknown) => unknown) => {
      const pending = tail.then(() => fn({})); tail = pending.catch(() => undefined); return pending;
    },
    read: async () => row,
    query: async (_client: unknown, _sql: string, args: string[]) => {
      if(!row) row = {game_id:args[1],game_date:args[2],submitted_answer:args[3],canonical_name:args[4],outcome:args[5] as any};
      return [];
    },
    game: async () => { reads++; return {canonicalName:'Alan Shearer',acceptedSurnames:['Shearer']}; },
    today: () => '2026-09-08',
  };
  return {deps:deps as any,get:() => row,reads:() => reads};
}
for (const first of ['solved','given_up'] as const) {
  test(`first ${first} outcome wins concurrent conflicting requests and retries`, async () => {
    const f = fixture();
    const values = await Promise.all([
      persistJourneyOutcome('a','career-2026-09-08',first,'Shearer',2,f.deps),
      persistJourneyOutcome('a','career-2026-09-08',first === 'solved' ? 'given_up' : 'solved','changed',2,f.deps),
    ]);
    assert.deepEqual(values[0],values[1]);
    assert.equal(values[0].outcome,first);
    assert.equal(f.reads(),1);
    if(first === 'given_up') assert.equal(values[0].submittedAnswer,'');
    const retried = await persistJourneyOutcome('a','career-2026-09-08','solved','wrong',2,{...f.deps,game:async()=>{throw Error('offline');}});
    assert.deepEqual(retried,values[0]);
  });
}
test('legacy clients cannot receive a given-up completion as solved', async () => {
  const f=fixture();
  await persistJourneyOutcome('a','career-2026-09-08','given_up','',2,f.deps);
  await assert.rejects(persistJourneyOutcome('a','career-2026-09-08','solved','Shearer',1,f.deps),
    e => e instanceof JourneyResultError && e.status === 409);
});
test('incorrect solves and expired first completions do not write outcomes', async () => {
  const f=fixture();
  await assert.rejects(persistJourneyOutcome('a','career-2026-09-08','solved','Wrong',2,f.deps));
  await assert.rejects(persistJourneyOutcome('a','career-2026-09-07','given_up','',2,f.deps));
  assert.equal(f.get(),null);
});
test('shares distinguish outcomes without including player names', () => {
  assert.match(journeyShare('2026-09-08','solved'),/Player found/);
  assert.match(journeyShare('2026-09-08','given_up'),/Answer revealed/);
  assert.doesNotMatch(journeyShare('2026-09-08','given_up'),/Shearer/);
});
