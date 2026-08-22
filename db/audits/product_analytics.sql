-- Product analytics migration audit (read-only)

SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'analytics_events'
ORDER BY ordinal_position;

SELECT
  count(*) AS total_events,
  count(*) FILTER (WHERE analytics_id IS NOT NULL) AS pseudonymous_events,
  count(*) FILTER (WHERE tracking_version = 1) AS version_1_events,
  min(occurred_at) AS oldest_event,
  max(occurred_at) AS newest_event
FROM analytics_events;

SELECT
  count(*) FILTER (WHERE duration_ms < 0 OR duration_ms > 600000) AS invalid_durations,
  count(*) FILTER (WHERE question_number < 0 OR question_number > 100) AS invalid_question_numbers,
  count(*) FILTER (WHERE total_questions < 0 OR total_questions > 100) AS invalid_question_totals,
  count(*) FILTER (WHERE score < 0 OR score > 100000) AS invalid_scores
FROM analytics_events;
