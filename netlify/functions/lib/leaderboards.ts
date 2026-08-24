import { query } from './db';
import type { LeaderboardDateWindow, LeaderboardPeriod } from '../../../shared/leaderboard';
export { parseLeaderboardPeriod } from '../../../shared/leaderboard';

export interface LeaderboardEntry {
  userId: string;
  /** @deprecated Installed-client compatibility; contains the username. */
  displayName: string | null;
  username: string;
  score: number;
  gamesPlayed: number;
  streak: number;
  rank: number | null;
  hasPlayedToday?: boolean;
  hasPlayedPeriod: boolean;
  avatarId: string | null;
}

interface LeaderboardRow {
  user_id: string;
  username: string;
  score: number | string | null;
  games_played: number | string | null;
  streak: number;
  rank: number | string | null;
  has_played_today?: boolean;
  has_played_period?: boolean;
  avatar_id: string | null;
}

export function parseLeaderboardLimit(value: string | undefined): number {
  const requested = Number(value);
  if (!Number.isInteger(requested)) return 100;
  return Math.min(Math.max(requested, 1), 100);
}

function mapLeaderboardRow(row: LeaderboardRow): LeaderboardEntry {
  return {
    userId: row.user_id,
    // Older clients still render this field, so keep it aligned to username.
    displayName: row.username,
    username: row.username,
    score: Number(row.score ?? 0),
    gamesPlayed: Number(row.games_played ?? 0),
    streak: row.streak,
    rank: row.rank === null ? null : Number(row.rank),
    hasPlayedToday: Boolean(row.has_played_today),
    hasPlayedPeriod: Boolean(row.has_played_period ?? row.has_played_today),
    avatarId: row.avatar_id,
  };
}

export async function getGlobalLeaderboardRows(
  period: LeaderboardPeriod,
  dates: LeaderboardDateWindow,
  limit: number
): Promise<LeaderboardEntry[]> {
  if (period === 'weekly') {
    const rows = await query<LeaderboardRow>(
      `WITH aggregated AS (
        SELECT
          r.user_id,
          u.username,
          u.avatar_id,
          SUM(r.score)::INT as score,
          COUNT(r.id)::INT as games_played,
          MAX(r.created_at) as final_submitted_at,
          SUM(CASE WHEN r.quiz_date = $3::DATE THEN 1 ELSE 0 END) > 0 as has_played_today,
          CASE
            WHEN u.last_played IN ($3::DATE, $4::DATE) THEN u.streak
            ELSE 0
          END as streak
        FROM results r
        JOIN users u ON u.id = r.user_id
        WHERE r.quiz_date BETWEEN $1::DATE AND LEAST($2::DATE, $3::DATE)
          AND u.onboarding_status = 'complete'
          AND u.username IS NOT NULL
        GROUP BY r.user_id, u.username, u.avatar_id, u.last_played, u.streak
      ), ranked AS (
        SELECT
          *,
          ROW_NUMBER() OVER (
            ORDER BY score DESC, games_played DESC, final_submitted_at ASC, user_id ASC
          ) as rank
        FROM aggregated
      )
      SELECT
        user_id,
        username,
        avatar_id,
        score,
        games_played,
        streak,
        rank,
        true as has_played_period,
        has_played_today
      FROM ranked
      ORDER BY rank ASC
      LIMIT $5`,
      [dates.periodStart, dates.periodEnd, dates.quizDate, dates.previousQuizDate, limit]
    );
    return rows.map(mapLeaderboardRow);
  }

  const rows = await query<LeaderboardRow>(
    `WITH ranked AS (
      SELECT
        r.user_id,
        u.username,
        u.avatar_id,
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
        AND u.onboarding_status = 'complete'
        AND u.username IS NOT NULL
    )
    SELECT
      user_id,
      username,
      avatar_id,
      score,
      games_played,
      streak,
      rank,
      true as has_played_today,
      true as has_played_period
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
  if (period === 'weekly') {
    const rows = await query<LeaderboardRow>(
      `WITH friend_ids AS (
        SELECT CASE WHEN f.user_a = $1 THEN f.user_b ELSE f.user_a END as friend_id
        FROM friendships f
        WHERE f.user_a = $1 OR f.user_b = $1
        UNION ALL
        SELECT $1 as friend_id
      ), aggregated AS (
        SELECT
          r.user_id,
          SUM(r.score)::INT as score,
          COUNT(r.id)::INT as games_played,
          MAX(r.created_at) as final_submitted_at,
          SUM(CASE WHEN r.quiz_date = $3::DATE THEN 1 ELSE 0 END) > 0 as has_played_today
        FROM results r
        WHERE r.quiz_date BETWEEN $2::DATE AND $3::DATE
          AND r.user_id IN (SELECT friend_id FROM friend_ids)
        GROUP BY r.user_id
      ), ranked AS (
        SELECT
          user_id,
          ROW_NUMBER() OVER (
            ORDER BY score DESC, games_played DESC, final_submitted_at ASC, user_id ASC
          ) as rank
        FROM aggregated
      )
      SELECT
        u.id as user_id,
        u.username,
        u.avatar_id,
        COALESCE(a.score, 0)::INT as score,
        COALESCE(a.games_played, 0)::INT as games_played,
        CASE
          WHEN u.last_played IN ($3::DATE, $4::DATE) THEN u.streak
          ELSE 0
        END as streak,
        ranked.rank,
        COALESCE(a.has_played_today, false) as has_played_today,
        a.user_id IS NOT NULL as has_played_period
      FROM friend_ids fi
      JOIN users u ON u.id = fi.friend_id
      LEFT JOIN aggregated a ON a.user_id = u.id
      LEFT JOIN ranked ON ranked.user_id = u.id
      WHERE u.onboarding_status = 'complete'
        AND u.username IS NOT NULL
      ORDER BY
        CASE WHEN a.user_id IS NULL THEN 1 ELSE 0 END,
        ranked.rank ASC NULLS LAST,
        u.username ASC,
        u.id ASC`,
      [userId, dates.periodStart, dates.quizDate, dates.previousQuizDate]
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
        ROW_NUMBER() OVER (ORDER BY r.score DESC, r.created_at ASC, r.user_id ASC) as rank
      FROM results r
      JOIN users ranked_user ON ranked_user.id = r.user_id
      WHERE r.quiz_date = $2
        AND r.user_id IN (SELECT friend_id FROM friend_ids)
        AND ranked_user.onboarding_status = 'complete'
        AND ranked_user.username IS NOT NULL
    )
    SELECT
      u.id as user_id,
      u.username,
      u.avatar_id,
      r.score,
      CASE WHEN r.score IS NULL THEN 0 ELSE 1 END as games_played,
      CASE
        WHEN u.last_played IN ($2::DATE, $3::DATE) THEN u.streak
        ELSE 0
      END as streak,
      ranked.rank,
      r.score IS NOT NULL as has_played_today,
      r.score IS NOT NULL as has_played_period
    FROM friend_ids fi
    JOIN users u ON u.id = fi.friend_id
    LEFT JOIN results r ON r.user_id = u.id AND r.quiz_date = $2
    LEFT JOIN ranked ON ranked.user_id = u.id
    WHERE u.onboarding_status = 'complete'
      AND u.username IS NOT NULL
    ORDER BY
      CASE WHEN r.score IS NULL THEN 1 ELSE 0 END,
      ranked.rank ASC NULLS LAST,
      u.username ASC,
      u.id ASC`,
    [userId, dates.quizDate, dates.previousQuizDate]
  );

  return rows.map(mapLeaderboardRow);
}
