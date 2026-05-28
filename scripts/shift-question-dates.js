#!/usr/bin/env node

require('dotenv').config();

const { Pool } = require('pg');

const DEFAULT_TIMEZONE = 'Europe/London';

function parseArgs() {
  return {
    apply: process.argv.includes('--apply'),
  };
}

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

function diffDays(fromDate, toDate) {
  const [fromYear, fromMonth, fromDay] = fromDate.split('-').map(Number);
  const [toYear, toMonth, toDay] = toDate.split('-').map(Number);
  const fromUtc = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const toUtc = Date.UTC(toYear, toMonth - 1, toDay);
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const { apply } = parseArgs();
  const today = getQuizDate();
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  const client = await pool.connect();
  try {
    const summary = await client.query(
      `SELECT
        MIN(date)::TEXT as min_date,
        MAX(date)::TEXT as max_date,
        COUNT(*)::INT as row_count,
        COUNT(DISTINCT date)::INT as date_count
       FROM pu_player_ques
       WHERE date IS NOT NULL`
    );

    const row = summary.rows[0];
    if (!row?.min_date) {
      console.log('No dated rows found in pu_player_ques.');
      return;
    }

    const daysToShift = diffDays(row.min_date, today);
    console.log('Question date summary before shift:', {
      today,
      minDate: row.min_date,
      maxDate: row.max_date,
      rowCount: Number(row.row_count),
      dateCount: Number(row.date_count),
      daysToShift,
      mode: apply ? 'apply' : 'dry-run',
    });

    if (daysToShift === 0) {
      console.log('Oldest question date already lines up with today. No update needed.');
      return;
    }

    const preview = await client.query(
      `SELECT
        date::TEXT as old_date,
        (date + $1::INT)::TEXT as new_date,
        COUNT(*)::INT as question_count
       FROM pu_player_ques
       WHERE date IS NOT NULL
       GROUP BY date
       ORDER BY date ASC
       LIMIT 10`,
      [daysToShift]
    );
    console.table(preview.rows);

    if (!apply) {
      console.log('Dry run only. Re-run with --apply to update pu_player_ques.date.');
      return;
    }

    await client.query('BEGIN');
    const update = await client.query(
      `UPDATE pu_player_ques
       SET date = date + $1::INT
       WHERE date IS NOT NULL`,
      [daysToShift]
    );
    await client.query('COMMIT');

    const after = await client.query(
      `SELECT
        MIN(date)::TEXT as min_date,
        MAX(date)::TEXT as max_date,
        COUNT(*)::INT as row_count,
        COUNT(DISTINCT date)::INT as date_count
       FROM pu_player_ques
       WHERE date IS NOT NULL`
    );

    console.log('Question date shift applied:', {
      daysShifted: daysToShift,
      updatedRows: update.rowCount,
      after: {
        minDate: after.rows[0]?.min_date,
        maxDate: after.rows[0]?.max_date,
        rowCount: Number(after.rows[0]?.row_count ?? 0),
        dateCount: Number(after.rows[0]?.date_count ?? 0),
      },
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback failures when no transaction is active.
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
