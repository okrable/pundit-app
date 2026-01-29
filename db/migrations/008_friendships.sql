-- Migration: 008_friendships.sql
-- Description: Create friend_links and friendships tables for personal leaderboard
-- Database: CockroachDB (PostgreSQL-compatible)
-- Depends on: 001_users

-- =============================================================================
-- PART 1: Create friend_links table for shareable invite tokens
-- =============================================================================

CREATE TABLE IF NOT EXISTS friend_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code STRING(8) UNIQUE NOT NULL,           -- Shareable code (e.g., "ABCD1234")
  user_id STRING NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,          -- 7 days from creation
  used_by STRING REFERENCES users(id) ON DELETE SET NULL,  -- NULL until used
  used_at TIMESTAMPTZ                       -- When the link was used
);

-- Index for code lookups (accepting invites)
CREATE INDEX IF NOT EXISTS idx_friend_links_code ON friend_links(code);

-- Index for user's active links
CREATE INDEX IF NOT EXISTS idx_friend_links_user ON friend_links(user_id, created_at DESC);

-- =============================================================================
-- PART 2: Create friendships table for mutual relationships
-- =============================================================================

CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a STRING NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b STRING NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure user_a < user_b to prevent duplicate pairs (A,B) and (B,A)
  CONSTRAINT friendships_ordered CHECK (user_a < user_b),

  -- Unique constraint on the ordered pair
  UNIQUE(user_a, user_b)
);

-- Index for finding all friends of a user (need both directions)
CREATE INDEX IF NOT EXISTS idx_friendships_user_a ON friendships(user_a);
CREATE INDEX IF NOT EXISTS idx_friendships_user_b ON friendships(user_b);
