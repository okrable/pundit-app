#!/usr/bin/env node

require('dotenv').config();

const { Pool } = require('pg');

function countCorrectAnswers(answers) {
  if (Array.isArray(answers)) {
    return answers.filter(Boolean).length;
  }

  if (typeof answers === 'string') {
    try {
      const parsed = JSON.parse(answers);
      return Array.isArray(parsed) ? parsed.filter(Boolean).length : 0;
    } catch {
      return 0;
    }
  }

  return 0;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const apply = process.argv.includes('--apply');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  const client = await pool.connect();
  try {
    const [users, results] = await Promise.all([
      client.query(
        `SELECT id, total_correct
         FROM users
         ORDER BY id ASC`
      ),
      client.query(
        `SELECT user_id, answers
         FROM results
         ORDER BY user_id ASC, quiz_date ASC`
      ),
    ]);

    const correctByUserId = new Map();
    for (const result of results.rows) {
      const previous = correctByUserId.get(result.user_id) || 0;
      correctByUserId.set(result.user_id, previous + countCorrectAnswers(result.answers));
    }

    const mismatches = users.rows
      .map((user) => ({
        userId: user.id,
        storedTotalCorrect: Number(user.total_correct || 0),
        computedTotalCorrect: correctByUserId.get(user.id) || 0,
      }))
      .filter((user) => user.storedTotalCorrect !== user.computedTotalCorrect);

    console.log(JSON.stringify({
      mode: apply ? 'apply' : 'dry-run',
      checkedUsers: users.rowCount,
      checkedResults: results.rowCount,
      mismatchCount: mismatches.length,
      mismatches,
    }, null, 2));

    if (!apply || mismatches.length === 0) {
      return;
    }

    await client.query('BEGIN');
    try {
      for (const mismatch of mismatches) {
        await client.query(
          `UPDATE users
           SET total_correct = $2
           WHERE id = $1`,
          [mismatch.userId, mismatch.computedTotalCorrect]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    console.log(`Repaired total_correct for ${mismatches.length} users.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
