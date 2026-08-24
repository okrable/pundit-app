ALTER TABLE analytics_events
  ADD COLUMN IF NOT EXISTS leaderboard_scope STRING,
  ADD COLUMN IF NOT EXISTS leaderboard_period STRING;

CREATE INDEX IF NOT EXISTS analytics_events_leaderboard_usage_idx
  ON analytics_events (event_name, leaderboard_scope, leaderboard_period, occurred_at DESC)
  WHERE event_name IN ('leaderboard_viewed', 'leaderboard_filter_changed');
