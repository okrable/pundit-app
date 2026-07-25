-- Migration: 010_api_rate_limits
-- Description: Shared fixed-window rate limits for serverless API instances
-- Database: CockroachDB (PostgreSQL-compatible)

CREATE TABLE IF NOT EXISTS api_rate_limits (
  rate_key STRING NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (rate_key, window_started_at)
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_expires_at
  ON api_rate_limits (expires_at);
