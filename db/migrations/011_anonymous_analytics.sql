-- Migration: 011_anonymous_analytics
-- Description: Anonymous aggregate product events without user identifiers
-- Database: CockroachDB (PostgreSQL-compatible)

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name STRING NOT NULL,
  actor_type STRING NOT NULL,
  platform STRING NOT NULL,
  app_version STRING NOT NULL,
  app_environment STRING NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_name_time
  ON analytics_events (event_name, occurred_at DESC);
