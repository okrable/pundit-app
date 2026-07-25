-- Migration: 012_identity_onboarding
-- Description: Persist username onboarding and backfill legacy public identities
-- Database: CockroachDB (PostgreSQL-compatible)
-- Depends on: 006_usernames

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_status STRING NOT NULL DEFAULT 'complete';

ALTER TABLE users
  ADD CONSTRAINT IF NOT EXISTS users_onboarding_status_valid
  CHECK (onboarding_status IN ('username_required', 'complete'));

-- Existing accounts are established players. Generate a deterministic username
-- only where one is missing, using the email prefix first and the user id hash
-- for case-insensitive uniqueness. Leave username_last_changed_at NULL so the
-- backfill does not start the existing change cooldown.
WITH legacy_identity AS (
  SELECT
    id,
    CASE
      WHEN length(
        trim(
          BOTH '_' FROM regexp_replace(
            lower(split_part(COALESCE(email, ''), '@', 1)),
            '[^a-z0-9_]+',
            '_',
            'g'
          )
        )
      ) >= 3
      THEN left(
        trim(
          BOTH '_' FROM regexp_replace(
            lower(split_part(COALESCE(email, ''), '@', 1)),
            '[^a-z0-9_]+',
            '_',
            'g'
          )
        ),
        11
      )
      ELSE 'player'
    END || '_' || substr(md5(id), 1, 8) AS generated_username
  FROM users
  WHERE username IS NULL
)
UPDATE users
SET
  username = legacy_identity.generated_username,
  username_normalized = legacy_identity.generated_username,
  username_last_changed_at = NULL,
  onboarding_status = 'complete'
FROM legacy_identity
WHERE users.id = legacy_identity.id;

UPDATE users
SET onboarding_status = 'complete'
WHERE username IS NOT NULL;
