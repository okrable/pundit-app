-- Run before and after migration 014. After migration, mismatch_count must be 0.

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
expected AS (
  SELECT
    users.id,
    COALESCE(latest_runs.run_length, 0) AS expected_run_length,
    MAX(distinct_dates.quiz_date) AS expected_last_played
  FROM users
  LEFT JOIN latest_runs ON latest_runs.user_id = users.id
  LEFT JOIN distinct_dates ON distinct_dates.user_id = users.id
  GROUP BY users.id, latest_runs.run_length
),
comparison AS (
  SELECT
    users.id,
    users.streak AS stored_run_length,
    expected.expected_run_length,
    users.last_played AS stored_last_played,
    expected.expected_last_played
  FROM users
  JOIN expected ON expected.id = users.id
)
SELECT
  COUNT(*) FILTER (
    WHERE stored_run_length != expected_run_length
       OR stored_last_played IS DISTINCT FROM expected_last_played
  ) AS mismatch_count,
  COUNT(*) FILTER (
    WHERE expected_last_played = current_date
  ) AS active_today_count,
  COUNT(*) FILTER (
    WHERE expected_last_played = current_date - 1
  ) AS at_risk_count,
  COUNT(*) FILTER (
    WHERE expected_last_played < current_date - 1
  ) AS inactive_count
FROM comparison;

WITH recent_players AS (
  SELECT
    users.id,
    users.streak AS projected_run_length,
    users.last_played,
    CASE
      WHEN users.last_played = current_date THEN 'active_today'
      WHEN users.last_played = current_date - 1 THEN 'at_risk'
      WHEN users.last_played IS NULL THEN 'not_started'
      ELSE 'inactive'
    END AS streak_state
  FROM users
)
SELECT *
FROM recent_players
ORDER BY last_played DESC NULLS LAST, id
LIMIT 25;
