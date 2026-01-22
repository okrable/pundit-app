-- Migration: 001_users
-- Description: Create users table for profile and stats tracking
-- Database: CockroachDB (PostgreSQL-compatible)

CREATE TABLE IF NOT EXISTS users (
  id STRING PRIMARY KEY,                    -- guest_xxx or auth0|xxx
  display_name STRING,                      -- Editable display name
  email STRING,                             -- From Auth0 (optional)
  avatar_url STRING,                        -- Profile picture URL
  streak INT DEFAULT 0,                     -- Current consecutive days
  best_score INT DEFAULT 0,                 -- Highest single quiz score (out of 5)
  total_quizzes INT DEFAULT 0,              -- Lifetime quizzes completed
  total_correct INT DEFAULT 0,              -- Lifetime correct answers
  created_at TIMESTAMPTZ DEFAULT now(),
  last_played DATE                          -- For streak calculation
);

-- Index for email lookups (Auth0 users)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

-- Index for leaderboard queries (streak ranking)
CREATE INDEX IF NOT EXISTS idx_users_streak ON users(streak DESC);
