#!/usr/bin/env node

require('dotenv').config();

const { Pool } = require('pg');

const userId = process.argv[2] || process.env.INSPECT_USER_ID;

if (!userId) {
  console.error('Usage: node scripts/inspect-leaderboard-performance.js <userId>');
  process.exit(1);
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function getQuizDate(referenceDate = new Date()) {
  const timezone = process.env.QUIZ_TIMEZONE || process.env.EXPO_PUBLIC_QUIZ_TIMEZONE || 'Europe/London';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(referenceDate);
  } catch {
    return formatDate(referenceDate);
  }
}

function shiftDate(date, offsetDays) {
  const [year, month, day] = date.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + offsetDays);
  return formatDate(utcDate);
}

function getWeekBounds(quizDate) {
  const [year, month, day] = quizDate.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  const daysSinceMonday = (utcDate.getUTCDay() + 6) % 7;
  const weekStart = new Date(utcDate);
  weekStart.setUTCDate(utcDate.getUTCDate() - daysSinceMonday);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  return { weekStart: formatDate(weekStart), weekEnd: formatDate(weekEnd) };
}

async function timed(client, name, sql, params) {
  const startedAt = Date.now();
  const result = await client.query(sql, params);
  console.log(JSON.stringify({
    name,
    rowCount: result.rowCount,
    durationMs: Date.now() - startedAt,
    sample: result.rows.slice(0, 3),
  }, null, 2));
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const quizDate = getQuizDate();
  const previousQuizDate = shiftDate(quizDate, -1);
  const { weekStart, weekEnd } = getWeekBounds(quizDate);
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  const client = await pool.connect();
  try {
    console.log(JSON.stringify({ userId, quizDate, previousQuizDate, weekStart, weekEnd }, null, 2));

    await timed(
      client,
      'friend_count',
      `SELECT COUNT(*)::INT as count
       FROM friendships
       WHERE user_a = $1 OR user_b = $1`,
      [userId]
    );

    await timed(
      client,
      'friends_weekly',
      `WITH friend_ids AS (
        SELECT CASE WHEN f.user_a = $1 THEN f.user_b ELSE f.user_a END as friend_id
        FROM friendships f
        WHERE f.user_a = $1 OR f.user_b = $1
        UNION ALL
        SELECT $1 as friend_id
      ),
      weekly_scores AS (
        SELECT
          r.user_id,
          SUM(r.score)::INT as score,
          COUNT(*)::INT as games_played,
          MIN(r.created_at) as first_result_at
        FROM results r
        WHERE r.quiz_date BETWEEN $2 AND $3
          AND r.user_id IN (SELECT friend_id FROM friend_ids)
        GROUP BY r.user_id
      ),
      ranked AS (
        SELECT
          ws.user_id,
          RANK() OVER (ORDER BY ws.score DESC) as rank
        FROM weekly_scores ws
      )
      SELECT
        u.id as user_id,
        u.display_name,
        u.username,
        ws.score,
        COALESCE(ws.games_played, 0)::INT as games_played,
        CASE
          WHEN u.last_played IN ($4::DATE, $5::DATE) THEN u.streak
          ELSE 0
        END as streak,
        ranked.rank,
        COALESCE(ws.games_played, 0) > 0 as has_played_this_week
      FROM friend_ids fi
      JOIN users u ON u.id = fi.friend_id
      LEFT JOIN weekly_scores ws ON ws.user_id = u.id
      LEFT JOIN ranked ON ranked.user_id = u.id
      ORDER BY
        CASE WHEN ws.score IS NULL THEN 1 ELSE 0 END,
        ranked.rank ASC NULLS LAST,
        ws.games_played DESC NULLS LAST,
        ws.first_result_at ASC NULLS LAST,
        u.display_name ASC NULLS LAST,
        u.id ASC`,
      [userId, weekStart, weekEnd, quizDate, previousQuizDate]
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
