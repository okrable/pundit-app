-- Migration: 004_online_games
-- Description: Create tables for real-time multiplayer games
-- Database: CockroachDB (PostgreSQL-compatible)
-- Depends on: 001_users

-- Online game sessions
CREATE TABLE IF NOT EXISTS online_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code STRING NOT NULL,                     -- Game join code (e.g., "GAME42")
  host_id STRING NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status STRING DEFAULT 'waiting',          -- waiting, in_progress, completed, cancelled
  game_type STRING DEFAULT 'standard',      -- standard, speed, survival, etc.
  quiz_id STRING,                           -- Links to daily quiz if applicable
  questions JSONB,                          -- Custom questions for the game
  max_players INT DEFAULT 10,
  round_time_seconds INT DEFAULT 30,        -- Time allowed per question
  current_question_index INT DEFAULT 0,     -- Track game progress
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(code)
);

-- Index for finding joinable games
CREATE INDEX IF NOT EXISTS idx_online_games_status ON online_games(status) WHERE status = 'waiting';

-- Index for code lookups
CREATE INDEX IF NOT EXISTS idx_online_games_code ON online_games(code);

-- Index for host's games
CREATE INDEX IF NOT EXISTS idx_online_games_host ON online_games(host_id);


-- Players participating in online games
CREATE TABLE IF NOT EXISTS online_game_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES online_games(id) ON DELETE CASCADE,
  user_id STRING NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name STRING,                      -- Snapshot of name at join time
  score INT DEFAULT 0,                      -- Running score in game
  answers JSONB,                            -- Their submitted answers
  is_ready BOOLEAN DEFAULT false,           -- Ready to start
  is_connected BOOLEAN DEFAULT true,        -- Connection status
  joined_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,

  -- One entry per player per game
  UNIQUE(game_id, user_id)
);

-- Index for game roster
CREATE INDEX IF NOT EXISTS idx_online_game_players_game ON online_game_players(game_id);

-- Index for user's game history
CREATE INDEX IF NOT EXISTS idx_online_game_players_user ON online_game_players(user_id);

-- Index for game leaderboard
CREATE INDEX IF NOT EXISTS idx_online_game_players_score ON online_game_players(game_id, score DESC);
