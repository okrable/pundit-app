#!/usr/bin/env node

require('dotenv').config();

const { Pool } = require('pg');

const userId = process.argv[2] || process.env.INSPECT_USER_ID;

if (!userId) {
  console.error('Usage: node scripts/inspect-user-stats.js <userId>');
  process.exit(1);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  const client = await pool.connect();
  try {
    const user = await client.query(
      `SELECT
        id,
        streak,
        best_score,
        total_quizzes,
        total_correct,
        last_played::TEXT as last_played,
        username,
        display_name,
        created_at::TEXT as created_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    const results = await client.query(
      `SELECT
        quiz_date::TEXT as quiz_date,
        quiz_id,
        score,
        total_questions,
        created_at::TEXT as created_at
       FROM results
       WHERE user_id = $1
       ORDER BY quiz_date DESC
       LIMIT 20`,
      [userId]
    );

    console.log(JSON.stringify({
      user: user.rows[0] ?? null,
      recentResults: results.rows,
    }, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
