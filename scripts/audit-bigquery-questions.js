#!/usr/bin/env node

require('dotenv').config({ quiet: true });

const { BigQuery } = require('@google-cloud/bigquery');

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--from' || arg === '--to') {
      values[arg.slice(2)] = argv[index + 1];
      index += 1;
    }
  }

  const from = values.from;
  const to = values.to || from;
  if (!isDate(from) || !isDate(to) || from > to) {
    throw new Error(
      'Usage: npm run audit:bigquery-questions -- --from YYYY-MM-DD [--to YYYY-MM-DD]'
    );
  }
  if (differenceInDays(from, to) > 370) {
    throw new Error('Audit ranges are limited to 371 days');
  }
  return { from, to };
}

function isDate(value) {
  if (!ISO_DATE_PATTERN.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function differenceInDays(from, to) {
  return Math.round(
    (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) /
      86_400_000
  );
}

function enumerateDates(from, to) {
  const dates = [];
  for (
    let timestamp = Date.parse(`${from}T00:00:00.000Z`);
    timestamp <= Date.parse(`${to}T00:00:00.000Z`);
    timestamp += 86_400_000
  ) {
    dates.push(new Date(timestamp).toISOString().slice(0, 10));
  }
  return dates;
}

function normalizeDate(value) {
  return typeof value === 'string' ? value : value?.value;
}

function createClient(projectId) {
  const options = { projectId };
  if (process.env.BIGQUERY_SERVICE_ACCOUNT_JSON) {
    options.credentials = JSON.parse(process.env.BIGQUERY_SERVICE_ACCOUNT_JSON);
  }
  return new BigQuery(options);
}

function auditQuestionSet(date, rows) {
  const errors = [];
  const byRank = new Map();
  const questionIds = new Set();

  for (const row of rows) {
    const rank = Number(row.rank);
    if (!Number.isInteger(rank) || rank < 1 || rank > 6 || byRank.has(rank)) {
      errors.push(`rank ${row.rank}: duplicate or outside 1-6`);
      continue;
    }
    byRank.set(rank, row);

    const questionId = row.question_id?.trim();
    if (!questionId || questionIds.has(questionId)) {
      errors.push(`rank ${rank}: missing or duplicate question_id`);
    } else {
      questionIds.add(questionId);
    }

    const options = [row.player_0, row.player_1, row.player_2, row.player_3]
      .map((option) => option?.trim() || '')
      .filter(Boolean);
    if (options.length !== 4 || new Set(options).size !== 4) {
      errors.push(`rank ${rank}: options must contain four distinct values`);
    }
    const correctIndex = options.findIndex(
      (option) => option === row.player_name?.trim()
    );
    if (correctIndex < 0) {
      errors.push(`rank ${rank}: player_name is not in the options`);
    } else if (Number(row.correct_answer_position) !== correctIndex) {
      errors.push(`rank ${rank}: correct_answer_position mismatch`);
    }
    if (!row.question?.trim() || !row.player_id?.trim() || !row.player_name?.trim()) {
      errors.push(`rank ${rank}: missing question/player fields`);
    }
  }

  for (let rank = 1; rank <= 6; rank += 1) {
    if (!byRank.has(rank)) errors.push(`missing rank ${rank}`);
  }
  if (rows.length !== 6) errors.push(`expected 6 rows, found ${rows.length}`);

  return {
    date,
    rows: rows.length,
    careerPlayerId: byRank.get(6)?.player_id || null,
    errors,
  };
}

function auditCareerRows(playerId, rows) {
  const errors = [];
  const keys = new Set();
  for (const row of rows) {
    const category = row.category?.trim();
    const rank = Number(row.rank);
    const key = `${category}:${rank}`;
    if (
      !category ||
      !row.years?.trim() ||
      !row.team?.trim() ||
      !Number.isInteger(rank) ||
      rank < 1 ||
      !Number.isInteger(Number(row.appearances)) ||
      Number(row.appearances) < 0 ||
      !Number.isInteger(Number(row.goals)) ||
      Number(row.goals) < 0
    ) {
      errors.push('invalid years/team/category/rank/apps/goals');
    }
    if (keys.has(key)) errors.push(`duplicate career key ${key}`);
    keys.add(key);
  }
  if (rows.length === 0) errors.push('no career rows');
  return { playerId, rows: rows.length, errors: [...new Set(errors)] };
}

async function main() {
  const { from, to } = parseArgs(process.argv.slice(2));
  const projectId = process.env.BIGQUERY_PROJECT_ID || 'pundit-498720';
  const dataset = process.env.BIGQUERY_DATASET || 'pundit';
  const cutoverDate = process.env.BIGQUERY_CUTOVER_DATE || null;
  if (cutoverDate && !isDate(cutoverDate)) {
    throw new Error('BIGQUERY_CUTOVER_DATE must use YYYY-MM-DD');
  }
  const client = createClient(projectId);
  const location = process.env.BIGQUERY_LOCATION?.trim() || undefined;

  const [questionRows] = await client.query({
    query: `SELECT
      date,
      rank,
      question_id,
      question,
      player_id,
      player_name,
      player_0,
      player_1,
      player_2,
      player_3,
      correct_answer_position
    FROM \`${projectId}.${dataset}.questions\`
    WHERE date BETWEEN @from AND @to
      AND LOWER(country) = 'uk'
      AND LOWER(language) = 'english'
      AND generation_status = 'ok'
      AND rank BETWEEN 1 AND 6
    ORDER BY date, rank`,
    params: {
      from: BigQuery.date(from),
      to: BigQuery.date(to),
    },
    types: { from: 'DATE', to: 'DATE' },
    ...(location ? { location } : {}),
  });

  const questionsByDate = new Map();
  for (const row of questionRows) {
    const date = normalizeDate(row.date);
    if (!questionsByDate.has(date)) questionsByDate.set(date, []);
    questionsByDate.get(date).push(row);
  }

  const questionAudits = enumerateDates(from, to).map((date) =>
    auditQuestionSet(date, questionsByDate.get(date) || [])
  );
  const careerPlayerIds = [
    ...new Set(questionAudits.map((audit) => audit.careerPlayerId).filter(Boolean)),
  ];
  let careerRows = [];
  if (careerPlayerIds.length > 0) {
    [careerRows] = await client.query({
      query: `SELECT
        player_id,
        Years AS years,
        Team AS team,
        Apps AS appearances,
        Gls AS goals,
        DomNat AS category,
        Rank AS rank
      FROM \`${projectId}.${dataset}.player_stats\`
      WHERE player_id IN UNNEST(@playerIds)
      ORDER BY player_id, category, rank`,
      params: { playerIds: careerPlayerIds },
      types: { playerIds: ['STRING'] },
      ...(location ? { location } : {}),
    });
  }

  const careerByPlayer = new Map();
  for (const row of careerRows) {
    if (!careerByPlayer.has(row.player_id)) careerByPlayer.set(row.player_id, []);
    careerByPlayer.get(row.player_id).push(row);
  }
  const careerAudits = careerPlayerIds.map((playerId) =>
    auditCareerRows(playerId, careerByPlayer.get(playerId) || [])
  );
  const careerAuditByPlayer = new Map(
    careerAudits.map((audit) => [audit.playerId, audit])
  );

  const summary = questionAudits.map((audit) => {
    const careerAudit = audit.careerPlayerId
      ? careerAuditByPlayer.get(audit.careerPlayerId)
      : null;
    const errors = [
      ...audit.errors,
      ...(careerAudit?.errors.map((error) => `career: ${error}`) || []),
    ];
    return {
      date: audit.date,
      liveAtCutover: cutoverDate ? audit.date >= cutoverDate : false,
      questionRows: audit.rows,
      careerRows: careerAudit?.rows || 0,
      status: errors.length === 0 ? 'OK' : 'ERROR',
      errors: errors.join('; '),
    };
  });

  console.table(summary);
  const failures = summary.filter((row) => row.status === 'ERROR');
  console.log('BigQuery question audit', {
    projectId,
    dataset,
    from,
    to,
    dates: summary.length,
    failures: failures.length,
    cutoverDate,
  });
  if (failures.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('BigQuery question audit failed:', error.message || error);
  process.exit(1);
});
