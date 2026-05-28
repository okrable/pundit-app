-- Migration: 009_leaderboard_indexes
-- Description: Add covering indexes for daily and weekly leaderboard queries
-- Database: CockroachDB (PostgreSQL-compatible)
-- Depends on: 002_results, 008_friendships

CREATE INDEX IF NOT EXISTS idx_results_leaderboard_week_global
ON results (quiz_date, user_id)
STORING (score, created_at);

CREATE INDEX IF NOT EXISTS idx_results_leaderboard_week_user
ON results (user_id, quiz_date)
STORING (score, created_at);
