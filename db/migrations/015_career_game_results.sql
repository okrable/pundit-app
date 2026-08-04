-- Migration: 015_career_game_results
-- Description: Persist completion for the independent daily career game
-- Database: CockroachDB (PostgreSQL-compatible)
-- Depends on: 001_users

CREATE TABLE IF NOT EXISTS career_game_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id STRING NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id STRING NOT NULL,
  game_date DATE NOT NULL,
  submitted_answer STRING NOT NULL,
  canonical_name STRING NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_career_game_results_user_date
  ON career_game_results(user_id, game_date DESC);
