import { query } from './db';

export type LeaderboardPeriod = 'daily' | 'weekly';

export interface LeaderboardDateWindow {
  quizDate: string;
  previousQuizDate: string;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string | null;
  username: string | null;
  score: number;
  gamesPlayed: number;
  streak: number;
  rank: number | null;
  hasPlayedToday?: boolean;
}

interface LeaderboardRow {
  user_id: string;
  display_name: string | null;
  username: string | null;
  score: number | string | null;
  games_played: number | string | null;
  streak: number;
  rank: number | string | null;
  has_played_today?: boolean;
}

export function parseLeaderboardPeriod(value: string | undefined): LeaderboardPeriod {
  // Weekly leaderboards are temporarily removed from the product surface. Treat
  // legacy weekly requests as daily so older clients degrade safely.
  if (!value || value === 'daily' || value === 'weekly') return 'daily';
  return 'daily';
}

export function parseLeaderboardLimit(value: string | undefined): number {
  const requested = Number(value);
  if (!Number.isInteger(requested)) return 100;
  return Math.min(Math.max(requested, 1), 100);
}

function mapLeaderboardRow(row: LeaderboardRow): LeaderboardEntry {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    username: row.username,
    score: Number(row.score ?? 0),
    gamesPlayed: Number(row.games_played ?? 0),
    streak: row.streak,
    rank: row.rank === null ? null : Number(row.rank),
    hasPlayedToday: Boolean(row.has_played_today),
  };
}

export async function getGlobalLeaderboardRows(
  period: LeaderboardPeriod,
  dates: LeaderboardDateWindow,
  limit: number
): Promise<LeaderboardEntry[]> {
  const rows = await query<LeaderboardRow>(
    `WITH ranked AS (
      SELECT
        r.user_id,
        u.display_name,
        u.username,
        r.score,
        1::INT as games_played,
        CASE
          WHEN u.last_played IN ($1::DATE, $2::DATE) THEN u.streak
          ELSE 0
        END as streak,
        ROW_NUMBER() OVER (ORDER BY r.score DESC, r.created_at ASC, r.user_id ASC) as rank,
        r.created_at
      FROM results r
      JOIN users u ON r.user_id = u.id
      WHERE r.quiz_date = $1
    )
    SELECT
      user_id,
      display_name,
      username,
      score,
      games_played,
      streak,
      rank,
      true as has_played_today
    FROM ranked
    ORDER BY rank ASC
    LIMIT $3`,
    [dates.quizDate, dates.previousQuizDate, limit]
  );

  return rows.map(mapLeaderboardRow);
}

export async function getFriendsLeaderboardRows(
  userId: string,
  period: LeaderboardPeriod,
  dates: LeaderboardDateWindow
): Promise<LeaderboardEntry[]> {
  const rows = await query<LeaderboardRow>(
    `WITH friend_ids AS (
      SELECT CASE WHEN f.user_a = $1 THEN f.user_b ELSE f.user_a END as friend_id
      FROM friendships f
      WHERE f.user_a = $1 OR f.user_b = $1
      UNION ALL
      SELECT $1 as friend_id
    ),
    ranked AS (
      SELECT
        r.user_id,
        ROW_NUMBER() OVER (ORDER BY r.score DESC, r.created_at ASC, r.user_id ASC) as rank
      FROM results r
      WHERE r.quiz_date = $2
        AND r.user_id IN (SELECT friend_id FROM friend_ids)
    )
    SELECT
      u.id as user_id,
      u.display_name,
      u.username,
      r.score,
      CASE WHEN r.score IS NULL THEN 0 ELSE 1 END as games_played,
      CASE
        WHEN u.last_played IN ($2::DATE, $3::DATE) THEN u.streak
        ELSE 0
      END as streak,
      ranked.rank,
      r.score IS NOT NULL as has_played_today
    FROM friend_ids fi
    JOIN users u ON u.id = fi.friend_id
    LEFT JOIN results r ON r.user_id = u.id AND r.quiz_date = $2
    LEFT JOIN ranked ON ranked.user_id = u.id
    ORDER BY
      CASE WHEN r.score IS NULL THEN 1 ELSE 0 END,
      ranked.rank ASC NULLS LAST,
      u.display_name ASC NULLS LAST,
      u.id ASC`,
    [userId, dates.quizDate, dates.previousQuizDate]
  );

  return rows.map(mapLeaderboardRow);
}
