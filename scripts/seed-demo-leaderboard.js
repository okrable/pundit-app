#!/usr/bin/env node

require('dotenv').config();

const { Pool } = require('pg');

const DEFAULT_TIMEZONE = 'Europe/London';
const DEFAULT_PLAYER_COUNT = 30;
const DEFAULT_HISTORY_DAYS = 7;

const adjectives = [
  'rapid',
  'clever',
  'tidy',
  'brave',
  'sharp',
  'prime',
  'loyal',
  'urban',
  'golden',
  'north',
  'south',
  'eastern',
  'western',
  'lucky',
  'calm',
  'bold',
  'quick',
  'rising',
  'steady',
  'local',
];

const nouns = [
  'striker',
  'keeper',
  'winger',
  'captain',
  'gaffer',
  'ultra',
  'sweeper',
  'playmaker',
  'finisher',
  'tactician',
  'scout',
  'pundit',
  'derby',
  'midfield',
  'fullback',
  'academy',
  'stadium',
  'corner',
  'fixture',
  'touchline',
];

function parseNumberArg(name, fallback) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  if (!arg) return fallback;

  const parsed = Number(arg.slice(prefix.length));
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${prefix}<number> must be a positive integer`);
  }

  return parsed;
}

function parseStringArg(name, fallback) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
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

function shiftDate(date, offsetDays) {
  const [year, month, day] = date.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + offsetDays);
  return utcDate.toISOString().split('T')[0];
}

function pseudoRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function buildPlayers(count) {
  const random = pseudoRandom(20260527);
  const seen = new Set();
  const players = [];

  while (players.length < count) {
    const adjective = adjectives[Math.floor(random() * adjectives.length)];
    const noun = nouns[Math.floor(random() * nouns.length)];
    const suffix = String(Math.floor(100 + random() * 900));
    const username = `demo_${adjective}_${noun}_${suffix}`.slice(0, 20);

    if (seen.has(username)) continue;
    seen.add(username);

    players.push({
      id: `demo|${username}`,
      username,
      displayName: `Demo ${username.replace(/^demo_/, '').replace(/_/g, ' ')}`,
    });
  }

  return players;
}

function buildAnswers(score) {
  const correctCount = Math.max(0, Math.min(5, Math.round(score / 100)));
  return Array.from({ length: 5 }, (_, index) => index < correctCount);
}

function buildScore(playerIndex, dayIndex, historyDays) {
  const base = 500 - ((playerIndex * 37 + dayIndex * 53) % 360);
  const dip = (playerIndex + dayIndex) % 7 === 0 ? 120 : 0;
  const score = Math.max(40, base - dip);
  return Math.round(score / 20) * 20;
}

function orderedFriendPair(userA, userB) {
  return [userA, userB].sort();
}

async function seed() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const playerCount = parseNumberArg('players', DEFAULT_PLAYER_COUNT);
  const historyDays = parseNumberArg('days', DEFAULT_HISTORY_DAYS);
  const friendOwnerId = parseStringArg('friend-user-id', process.env.DEMO_FRIEND_OWNER_ID || '');
  const today = getQuizDate();
  const players = buildPlayers(playerCount);
  const dates = Array.from({ length: historyDays }, (_, index) =>
    shiftDate(today, index - historyDays + 1)
  );

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (friendOwnerId) {
      const owner = await client.query('SELECT id FROM users WHERE id = $1', [friendOwnerId]);
      if (owner.rowCount === 0) {
        throw new Error(`Friend owner "${friendOwnerId}" does not exist in users`);
      }
    }

    await client.query(
      `DELETE FROM results
       WHERE user_id = ANY($1)`,
      [players.map((player) => player.id)]
    );

    for (const [playerIndex, player] of players.entries()) {
      const scores = dates.map((date, dayIndex) => ({
        date,
        score: buildScore(playerIndex, dayIndex, historyDays),
      }));
      const totalCorrect = scores.reduce(
        (sum, result) => sum + buildAnswers(result.score).filter(Boolean).length,
        0
      );
      const bestScore = Math.max(...scores.map((result) => result.score));

      await client.query(
        `INSERT INTO users (
          id,
          display_name,
          username,
          username_normalized,
          username_last_changed_at,
          streak,
          best_score,
          total_quizzes,
          total_correct,
          created_at,
          last_played
        )
        VALUES ($1, $2, $3, $3, now(), $4, $5, $6, $7, now(), $8)
        ON CONFLICT (id) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          username = EXCLUDED.username,
          username_normalized = EXCLUDED.username_normalized,
          streak = EXCLUDED.streak,
          best_score = EXCLUDED.best_score,
          total_quizzes = EXCLUDED.total_quizzes,
          total_correct = EXCLUDED.total_correct,
          last_played = EXCLUDED.last_played`,
        [
          player.id,
          player.displayName,
          player.username,
          historyDays,
          bestScore,
          historyDays,
          totalCorrect,
          today,
        ]
      );

      for (const [dayIndex, date] of dates.entries()) {
        const score = buildScore(playerIndex, dayIndex, historyDays);
        const answers = buildAnswers(score);

        await client.query(
          `INSERT INTO results (
            user_id,
            quiz_id,
            quiz_date,
            score,
            total_questions,
            answers,
            time_taken_seconds,
            created_at
          )
          VALUES ($1, $2, $3, $4, 5, $5, $6, now())
          ON CONFLICT (user_id, quiz_id) DO UPDATE SET
            score = EXCLUDED.score,
            total_questions = EXCLUDED.total_questions,
            answers = EXCLUDED.answers,
            time_taken_seconds = EXCLUDED.time_taken_seconds,
            created_at = EXCLUDED.created_at`,
          [
            player.id,
            `quiz-${date}`,
            date,
            score,
            answers,
            45 + ((playerIndex * 11 + dayIndex * 7) % 80),
          ]
        );
      }

      if (friendOwnerId) {
        const [userA, userB] = orderedFriendPair(friendOwnerId, player.id);
        await client.query(
          `INSERT INTO friendships (user_a, user_b, created_at)
           VALUES ($1, $2, now())
           ON CONFLICT (user_a, user_b) DO NOTHING`,
          [userA, userB]
        );
      }
    }

    await client.query('COMMIT');

    console.log(
      `Seeded ${players.length} demo leaderboard players with ${dates.length} result days through ${today}.`
    );
    if (friendOwnerId) {
      console.log(`Attached demo players to friends leaderboard for ${friendOwnerId}.`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
