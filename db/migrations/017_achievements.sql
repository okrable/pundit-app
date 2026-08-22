-- Migration: 017_achievements
-- Description: Add local-first achievement persistence and idempotent sync receipts
-- Database: CockroachDB (PostgreSQL-compatible)
-- Depends on: 001_users

CREATE TABLE IF NOT EXISTS user_achievement_progress (
  user_id STRING PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  daily_completions INT NOT NULL DEFAULT 0,
  daily_streak INT NOT NULL DEFAULT 0,
  last_daily_date DATE,
  avatar_change_date DATE,
  avatar_changes_today INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id STRING NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id STRING NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL,
  source_event_id STRING NOT NULL,
  celebrated_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_uncelebrated
  ON user_achievements (user_id, unlocked_at DESC)
  WHERE celebrated_at IS NULL;

CREATE TABLE IF NOT EXISTS achievement_sync_receipts (
  user_id STRING NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id STRING NOT NULL,
  event_kind STRING NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);
