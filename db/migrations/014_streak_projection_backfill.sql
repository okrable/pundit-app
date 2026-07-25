-- Migration: 014_streak_projection_backfill
-- Description: Rebuild streak and last_played projections from authoritative results
-- Database: CockroachDB (PostgreSQL-compatible)
-- Depends on: 002_results

WITH distinct_dates AS (
  SELECT DISTINCT user_id, quiz_date
  FROM results
),
ranked_dates AS (
  SELECT
    user_id,
    quiz_date,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY quiz_date DESC
    )::INT AS date_rank
  FROM distinct_dates
),
grouped_dates AS (
  SELECT
    user_id,
    quiz_date,
    date_rank,
    quiz_date + date_rank AS run_group
  FROM ranked_dates
),
latest_groups AS (
  SELECT user_id, run_group
  FROM grouped_dates
  WHERE date_rank = 1
),
latest_runs AS (
  SELECT grouped_dates.user_id, COUNT(*)::INT AS run_length
  FROM grouped_dates
  JOIN latest_groups
    ON latest_groups.user_id = grouped_dates.user_id
   AND latest_groups.run_group = grouped_dates.run_group
  GROUP BY grouped_dates.user_id
),
latest_dates AS (
  SELECT user_id, MAX(quiz_date) AS last_played
  FROM distinct_dates
  GROUP BY user_id
),
projections AS (
  SELECT
    users.id,
    COALESCE(latest_runs.run_length, 0) AS run_length,
    latest_dates.last_played
  FROM users
  LEFT JOIN latest_runs ON latest_runs.user_id = users.id
  LEFT JOIN latest_dates ON latest_dates.user_id = users.id
)
UPDATE users
SET
  streak = projections.run_length,
  last_played = projections.last_played
FROM projections
WHERE users.id = projections.id;
