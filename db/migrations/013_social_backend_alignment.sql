-- Migration: 013_social_backend_alignment.sql
-- Description: Add reusable friend invites and backfill authenticated challenge usernames
-- Database: CockroachDB (PostgreSQL-compatible)
-- Depends on: 007_challenge_usernames, 008_friendships, 012_identity_onboarding

-- Existing links remain legacy single-use links. Only links created by the new
-- runtime set this flag, preserving the behavior of already-issued codes.
ALTER TABLE friend_links
  ADD COLUMN IF NOT EXISTS is_reusable BOOL NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_friend_links_active_reusable
  ON friend_links(user_id, expires_at DESC)
  WHERE is_reusable = true;

-- Keep snapshots for compatibility/history, while runtime reads resolve the
-- current username from users whenever the authenticated identity still exists.
UPDATE challenges AS c
SET creator_username = u.username
FROM users AS u
WHERE c.creator_id = u.id
  AND u.onboarding_status = 'complete'
  AND u.username IS NOT NULL
  AND c.creator_username IS NULL;

UPDATE challenges AS c
SET opponent_username = u.username
FROM users AS u
WHERE c.opponent_id = u.id
  AND u.onboarding_status = 'complete'
  AND u.username IS NOT NULL
  AND c.opponent_username IS NULL;
