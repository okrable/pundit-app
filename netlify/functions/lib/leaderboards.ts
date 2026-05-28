import { query } from './db';

export type LeaderboardPeriod = 'daily' | 'weekly';

export interface LeaderboardDateWindow {
  quizDate: string;
  weekStart: string;
  weekEnd: string;
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
  hasPlayedThisWeek?: boolean;
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
  has_played_this_week?: boolean;
}

export function parseLeaderboardPeriod(value: string | undefined): LeaderboardPeriod | null {
  if (!value || value === 'daily') return 'daily';
  if (value === 'weekly') return 'weekly';
  return null;
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
    hasPlayedThisWeek: Boolean(row.has_played_this_week),
  };
}

export async function getGlobalLeaderboardRows(
  period: LeaderboardPeriod,
  dates: LeaderboardDateWindow,
  limit: number
): Promise<LeaderboardEntry[]> {
  if (period === 'weekly') {
    const rows = await query<LeaderboardRow>(
      `WITH weekly_scores AS (
        SELECT
          r.user_id,
          SUM(r.score)::INT as score,
          COUNT(*)::INT as games_played,
          MIN(r.created_at) as first_result_at
        FROM results r
        WHERE r.quiz_date BETWEEN $1 AND $2
        GROUP BY r.user_id
      ),
      ranked AS (
        SELECT
          ws.user_id,
          u.display_name,
          u.username,
          ws.score,
          ws.games_played,
          CASE
            WHEN u.last_played IN ($3::DATE, $4::DATE) THEN u.streak
            ELSE 0
          END as streak,
          RANK() OVER (ORDER BY ws.score DESC) as rank,
          ws.first_result_at
        FROM weekly_scores ws
        JOIN users u ON u.id = ws.user_id
      )
      SELECT
        user_id,
        display_name,
        username,
        score,
        games_played,
        streak,
        rank
      FROM ranked
      ORDER BY rank ASC, games_played DESC, first_result_at ASC, user_id ASC
      LIMIT $5`,
      [dates.weekStart, dates.weekEnd, dates.quizDate, dates.previousQuizDate, limit]
    );

    return rows.map(mapLeaderboardRow);
  }

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
        RANK() OVER (ORDER BY r.score DESC) as rank,
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
      rank
    FROM ranked
    ORDER BY rank ASC, created_at ASC, user_id ASC
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
  if (period === 'weekly') {
    const rows = await query<LeaderboardRow>(
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
      [userId, dates.weekStart, dates.weekEnd, dates.quizDate, dates.previousQuizDate]
    );

    return rows.map(mapLeaderboardRow);
  }

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
        RANK() OVER (ORDER BY r.score DESC) as rank
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
      r.created_at ASC NULLS LAST,
      u.display_name ASC NULLS LAST,
      u.id ASC`,
    [userId, dates.quizDate, dates.previousQuizDate]
  );

  return rows.map(mapLeaderboardRow);
}
