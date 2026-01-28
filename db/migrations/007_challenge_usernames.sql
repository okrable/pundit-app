-- Migration: 007_challenge_usernames
-- Description: Add username columns to challenges table
-- Database: CockroachDB (PostgreSQL-compatible)
-- Depends on: 005_challenges, 006_usernames

-- Add username columns to challenges table
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS creator_username STRING(20);
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS opponent_username STRING(20);
