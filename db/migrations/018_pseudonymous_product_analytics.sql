-- Migration: 018_pseudonymous_product_analytics
-- Description: Add privacy-bounded installation cohorts and typed funnel dimensions
-- Database: CockroachDB (PostgreSQL-compatible)
-- Depends on: 011_anonymous_analytics

ALTER TABLE analytics_events
  ADD COLUMN IF NOT EXISTS analytics_id UUID,
  ADD COLUMN IF NOT EXISTS tracking_version INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quiz_date DATE,
  ADD COLUMN IF NOT EXISTS content_source STRING,
  ADD COLUMN IF NOT EXISTS duration_ms INT,
  ADD COLUMN IF NOT EXISTS question_number INT,
  ADD COLUMN IF NOT EXISTS total_questions INT,
  ADD COLUMN IF NOT EXISTS score INT,
  ADD COLUMN IF NOT EXISTS exit_reason STRING;

CREATE INDEX IF NOT EXISTS idx_analytics_events_install_time
  ON analytics_events (analytics_id, occurred_at DESC)
  WHERE analytics_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_events_quiz_funnel
  ON analytics_events (quiz_date, event_name, occurred_at DESC)
  WHERE quiz_date IS NOT NULL;
