-- Run after 013_social_backend_alignment.sql.

SELECT
  COUNT(*) AS total_friend_links,
  COUNT(*) FILTER (WHERE is_reusable) AS reusable_friend_links,
  COUNT(*) FILTER (WHERE NOT is_reusable) AS legacy_single_use_links
FROM friend_links;

SELECT
  COUNT(*) FILTER (
    WHERE c.creator_id NOT LIKE 'guest_%'
      AND u.id IS NOT NULL
      AND u.onboarding_status = 'complete'
      AND u.username IS NOT NULL
      AND c.creator_username IS NULL
  ) AS backfillable_creator_snapshots_missing,
  COUNT(*) FILTER (
    WHERE c.opponent_id IS NOT NULL
      AND c.opponent_id NOT LIKE 'guest_%'
      AND opponent.id IS NOT NULL
      AND opponent.onboarding_status = 'complete'
      AND opponent.username IS NOT NULL
      AND c.opponent_username IS NULL
  ) AS backfillable_opponent_snapshots_missing
FROM challenges c
LEFT JOIN users u ON u.id = c.creator_id
LEFT JOIN users opponent ON opponent.id = c.opponent_id;
