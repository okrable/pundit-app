-- Migration: 005_challenges
-- Description: Add challenge mode for async 1v1 matches
-- Database: CockroachDB (PostgreSQL-compatible)
-- Depends on: 001_users

-- =============================================================================
-- PART 1: Extend users table with challenge stats
-- =============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS challenge_wins INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS challenge_losses INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS challenge_draws INT DEFAULT 0;

-- =============================================================================
-- PART 2: Create challenges table
-- =============================================================================

CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code STRING(6) UNIQUE NOT NULL,             -- Shareable code (e.g., "ABC123")

  -- Quiz reference (uses daily quiz)
  quiz_id STRING NOT NULL,                    -- e.g., "quiz-2026-01-27"
  quiz_date DATE NOT NULL,

  -- Creator (no FK - allows guests)
  creator_id STRING NOT NULL,                 -- auth0|xxx or guest_xxx
  creator_display_name STRING,
  creator_score INT,                          -- NULL until creator completes
  creator_answers JSONB,                      -- [{questionId, selectedIndex, isCorrect}]

  -- Opponent (no FK - allows guests)
  opponent_id STRING,                         -- NULL until someone joins
  opponent_display_name STRING,
  opponent_score INT,                         -- NULL until opponent completes
  opponent_answers JSONB,

  -- Status: pending -> active -> completed (or expired/revoked)
  -- pending: created, waiting for creator to play
  -- active: creator played, waiting for opponent to join and play
  -- completed: both played, results available
  -- expired: 48h passed without completion
  -- revoked: creator cancelled before opponent joined
  status STRING NOT NULL DEFAULT 'pending',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,            -- created_at + 48 hours
  completed_at TIMESTAMPTZ,

  -- Result (set when both complete)
  winner_id STRING                            -- NULL = draw, otherwise winner's user_id
);

-- =============================================================================
-- PART 3: Indexes
-- =============================================================================

-- Code lookups (join flow)
CREATE INDEX IF NOT EXISTS idx_challenges_code ON challenges(code);

-- Find user's active challenge (1 per user constraint)
CREATE INDEX IF NOT EXISTS idx_challenges_creator_status ON challenges(creator_id, status);

-- Find challenges where user is opponent
CREATE INDEX IF NOT EXISTS idx_challenges_opponent ON challenges(opponent_id);

-- History queries (completed challenges)
CREATE INDEX IF NOT EXISTS idx_challenges_completed ON challenges(status, completed_at DESC)
  WHERE status = 'completed';
