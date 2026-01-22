-- Migration: 002_results
-- Description: Create results table for game history tracking
-- Database: CockroachDB (PostgreSQL-compatible)
-- Depends on: 001_users

CREATE TABLE IF NOT EXISTS results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id STRING NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id STRING NOT NULL,                  -- Format: quiz-YYYY-MM-DD
  quiz_date DATE NOT NULL,                  -- For querying by date
  score INT NOT NULL,                       -- 0-5 for daily quiz
  total_questions INT NOT NULL,             -- Usually 5
  answers BOOL[] NOT NULL,                  -- Array of correct/incorrect booleans
  time_taken_seconds INT,                   -- Optional: how long to complete
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Prevent duplicate submissions for same quiz
  UNIQUE(user_id, quiz_id)
);

-- Index for user history queries (most recent first)
CREATE INDEX IF NOT EXISTS idx_results_user_date ON results(user_id, quiz_date DESC);

-- Index for daily leaderboard queries
CREATE INDEX IF NOT EXISTS idx_results_date_score ON results(quiz_date, score DESC);

-- Index for streak calculation (consecutive days)
CREATE INDEX IF NOT EXISTS idx_results_user_created ON results(user_id, created_at DESC);
