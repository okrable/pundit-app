-- Migration: 006_usernames
-- Description: Add username support with uniqueness and change tracking
-- Database: CockroachDB (PostgreSQL-compatible)
-- Depends on: 001_users

-- =============================================================================
-- PART 1: Add username columns to users table
-- =============================================================================

-- Original casing chosen by user (e.g., "John_Doe")
ALTER TABLE users ADD COLUMN IF NOT EXISTS username STRING(20);

-- Lowercase version for case-insensitive uniqueness checks
ALTER TABLE users ADD COLUMN IF NOT EXISTS username_normalized STRING(20);

-- Tracks when username was last changed (for 30-day cooldown)
ALTER TABLE users ADD COLUMN IF NOT EXISTS username_last_changed_at TIMESTAMPTZ;

-- =============================================================================
-- PART 2: Indexes
-- =============================================================================

-- Unique constraint on normalized username (case-insensitive uniqueness)
-- Partial index allows NULL values (users who haven't set username yet)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_normalized
  ON users(username_normalized)
  WHERE username_normalized IS NOT NULL;

-- Index for username lookups (display purposes)
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
