import test from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { queryUsingPool } from '../netlify/functions/lib/db';

for (const rejects of [false, true]) {
  test(`pooled query releases once after ${rejects ? 'rejection' : 'resolution'}`, async () => {
    let settle!: () => void;
    let releases = 0;
    const query = new Promise<{ rows: number[] }>((resolve, reject) => {
      settle = () => rejects ? reject(new Error('query failed')) : resolve({ rows: [1] });
    });
    const pool = { connect: async () => ({ query: () => query, release: () => { releases++; } }) };
    const result = queryUsingPool(pool as unknown as Pool, 'SELECT 1');
    await Promise.resolve();
    assert.equal(releases, 0);
    settle();
    if (rejects) await assert.rejects(result, /query failed/);
    else assert.deepEqual(await result, [1]);
    assert.equal(releases, 1);
  });
}
