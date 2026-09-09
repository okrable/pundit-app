import test from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { databaseConnection, queryUsingPool } from '../netlify/functions/lib/db';

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

test('preview database access fails closed instead of falling back to production', () => {
  for (const CONTEXT of ['deploy-preview', 'branch-deploy']) {
    assert.throws(() => databaseConnection({CONTEXT,DATABASE_URL:'postgres://db/production'}), /separate/);
    assert.throws(() => databaseConnection({CONTEXT,DATABASE_URL:'postgres://db/production',PREVIEW_DATABASE_URL:'postgres://db/production'}), /separate/);
    assert.equal(databaseConnection({CONTEXT,DATABASE_URL:'postgres://db/production',PREVIEW_DATABASE_URL:'postgres://db/isolated'}), 'postgres://db/isolated');
  }
  assert.equal(databaseConnection({CONTEXT:'production',DATABASE_URL:'postgres://db/production',PREVIEW_DATABASE_URL:'postgres://db/isolated'},false), 'postgres://db/production');
});

test('build-time preview marker protects runtimes without CONTEXT', () => {
  assert.throws(() => databaseConnection({DATABASE_URL:'postgres://db/production'}, true), /separate/);
  assert.equal(databaseConnection({DATABASE_URL:'postgres://db/production',PREVIEW_DATABASE_URL:'postgres://db/isolated'},true),'postgres://db/isolated');
});

test('preview cannot disguise the production database with different credentials or parameters', () => {
  assert.throws(() => databaseConnection({CONTEXT:'deploy-preview',DATABASE_URL:'postgres://user:password@db/production',PREVIEW_DATABASE_URL:'postgres://other:password@db/production?sslmode=require'}), /separate database/);
});
