-- Migration: 003_leagues
-- Description: Create leagues and league_members tables for private leagues
-- Database: CockroachDB (PostgreSQL-compatible)
-- Depends on: 001_users

-- League definitions
CREATE TABLE IF NOT EXISTS leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name STRING NOT NULL,
  code STRING NOT NULL,                     -- Join code (e.g., "ABC123")
  description STRING,
  owner_id STRING NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT false,          -- Discoverable vs invite-only
  max_members INT DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(code)
);

-- Index for code lookups (joining a league)
CREATE INDEX IF NOT EXISTS idx_leagues_code ON leagues(code);

-- Index for owner's leagues
CREATE INDEX IF NOT EXISTS idx_leagues_owner ON leagues(owner_id);

-- Index for public league discovery
CREATE INDEX IF NOT EXISTS idx_leagues_public ON leagues(is_public) WHERE is_public = true;


-- League memberships (many-to-many between users and leagues)
CREATE TABLE IF NOT EXISTS league_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id STRING NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role STRING DEFAULT 'member',             -- 'owner', 'admin', 'member'
  joined_at TIMESTAMPTZ DEFAULT now(),

  -- One membership per user per league
  UNIQUE(league_id, user_id)
);

-- Index for user's leagues
CREATE INDEX IF NOT EXISTS idx_league_members_user ON league_members(user_id);

-- Index for league roster
CREATE INDEX IF NOT EXISTS idx_league_members_league ON league_members(league_id);
