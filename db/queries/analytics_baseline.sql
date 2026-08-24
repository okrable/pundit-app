-- Seven-day Release 0 baseline. Run after migration 018 has collected a full
-- seven London quiz days in Production.

WITH recent AS (
  SELECT *
  FROM analytics_events
  WHERE app_environment = 'production'
    AND analytics_id IS NOT NULL
    AND occurred_at >= now() - INTERVAL '7 days'
)
SELECT
  count(DISTINCT analytics_id) FILTER (WHERE event_name = 'today_viewed') AS today_viewers,
  count(DISTINCT analytics_id) FILTER (WHERE event_name = 'quiz_start_requested') AS quiz_starters,
  count(DISTINCT analytics_id) FILTER (WHERE event_name = 'quiz_attempt_resumed') AS quiz_resumers,
  count(DISTINCT analytics_id) FILTER (WHERE event_name = 'quiz_completed') AS quiz_completers,
  count(DISTINCT analytics_id) FILTER (WHERE event_name = 'quiz_shared') AS quiz_sharers,
  round(
    100.0 * count(DISTINCT analytics_id) FILTER (WHERE event_name = 'quiz_completed') /
    nullif(count(DISTINCT analytics_id) FILTER (WHERE event_name = 'quiz_start_requested'), 0),
    1
  ) AS start_to_complete_percent
FROM recent;

SELECT
  platform,
  app_version,
  count(*) FILTER (WHERE event_name = 'quiz_attempt_resumed') AS resume_events,
  count(DISTINCT analytics_id) FILTER (WHERE event_name = 'quiz_attempt_resumed') AS resumed_players,
  count(DISTINCT analytics_id) FILTER (WHERE event_name = 'quiz_completed') AS completing_players
FROM analytics_events
WHERE app_environment = 'production'
  AND event_name IN ('quiz_attempt_resumed', 'quiz_completed')
  AND occurred_at >= now() - INTERVAL '7 days'
GROUP BY platform, app_version
ORDER BY app_version DESC, platform;

WITH activity AS (
  SELECT DISTINCT analytics_id, quiz_date
  FROM analytics_events
  WHERE app_environment = 'production'
    AND analytics_id IS NOT NULL
    AND quiz_date IS NOT NULL
    AND event_name = 'quiz_completed'
    AND occurred_at >= now() - INTERVAL '21 days'
), retention AS (
  SELECT
    first_day.analytics_id,
    first_day.quiz_date,
    EXISTS (
      SELECT 1 FROM activity next_day
      WHERE next_day.analytics_id = first_day.analytics_id
        AND next_day.quiz_date = first_day.quiz_date + 1
    ) AS returned_d1,
    EXISTS (
      SELECT 1 FROM activity seventh_day
      WHERE seventh_day.analytics_id = first_day.analytics_id
        AND seventh_day.quiz_date = first_day.quiz_date + 7
    ) AS returned_d7
  FROM activity first_day
  WHERE first_day.quiz_date <= current_date - 7
)
SELECT
  count(*) AS eligible_player_days,
  round(100.0 * count(*) FILTER (WHERE returned_d1) / nullif(count(*), 0), 1) AS d1_percent,
  round(100.0 * count(*) FILTER (WHERE returned_d7) / nullif(count(*), 0), 1) AS d7_percent
FROM retention;

SELECT
  event_name,
  actor_type,
  platform,
  app_version,
  percentile_disc(0.50) WITHIN GROUP (ORDER BY duration_ms) AS p50_duration_ms,
  percentile_disc(0.75) WITHIN GROUP (ORDER BY duration_ms) AS p75_duration_ms,
  count(*) AS samples
FROM analytics_events
WHERE app_environment = 'production'
  AND event_name IN ('app_shell_ready', 'app_ready')
  AND duration_ms IS NOT NULL
  AND occurred_at >= now() - INTERVAL '7 days'
GROUP BY event_name, actor_type, platform, app_version
ORDER BY app_version DESC, actor_type, platform, event_name;

SELECT
  event_name,
  platform,
  percentile_disc(0.75) WITHIN GROUP (ORDER BY duration_ms) AS p75_duration_ms,
  count(*) AS samples
FROM analytics_events
WHERE app_environment = 'production'
  AND duration_ms IS NOT NULL
  AND occurred_at >= now() - INTERVAL '7 days'
GROUP BY event_name, platform
ORDER BY event_name, platform;
