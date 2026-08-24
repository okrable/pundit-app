-- Migration: 020_friend_requests
-- Description: Add one pending approval-based friend request per player pair
-- Database: CockroachDB (PostgreSQL-compatible)
-- Depends on: 008_friendships, 012_identity_onboarding

CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a STRING NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b STRING NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id STRING NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT friend_requests_ordered CHECK (user_a < user_b),
  CONSTRAINT friend_requests_sender_in_pair CHECK (sender_id IN (user_a, user_b)),
  UNIQUE (user_a, user_b)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_sender
  ON friend_requests (sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_friend_requests_user_a
  ON friend_requests (user_a, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_friend_requests_user_b
  ON friend_requests (user_b, created_at DESC);
