#!/usr/bin/env node

require('dotenv').config();

const { Pool } = require('pg');

const DEFAULT_TIMEZONE = 'Europe/London';

function getQuizDate(referenceDate = new Date()) {
  const timezone = process.env.QUIZ_TIMEZONE || process.env.EXPO_PUBLIC_QUIZ_TIMEZONE || DEFAULT_TIMEZONE;

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    return formatter.format(referenceDate);
  } catch (error) {
    console.warn(`Invalid quiz timezone "${timezone}". Falling back to UTC.`);
    return referenceDate.toISOString().split('T')[0];
  }
}

function shiftDate(date, offsetDays) {
  const [year, month, day] = date.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + offsetDays);
  return utcDate.toISOString().split('T')[0];
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const apply = process.argv.includes('--apply');
  const today = getQuizDate();
  const yesterday = shiftDate(today, -1);
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  const client = await pool.connect();
  try {
    const stale = await client.query(
      `SELECT
        id,
        streak,
        last_played::TEXT as last_played,
        total_quizzes
       FROM users
       WHERE streak > 0
         AND (last_played IS NULL OR last_played NOT IN ($1::DATE, $2::DATE))
       ORDER BY last_played DESC NULLS LAST, id ASC`,
      [today, yesterday]
    );

    console.log(JSON.stringify({
      mode: apply ? 'apply' : 'dry-run',
      today,
      yesterday,
      staleCount: stale.rowCount,
      staleUsers: stale.rows,
    }, null, 2));

    if (!apply || stale.rowCount === 0) {
      return;
    }

    const update = await client.query(
      `UPDATE users
       SET streak = 0
       WHERE streak > 0
         AND (last_played IS NULL OR last_played NOT IN ($1::DATE, $2::DATE))`,
      [today, yesterday]
    );

    console.log(`Reset stale streaks for ${update.rowCount} users.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
