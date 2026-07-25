-- Run immediately before 013_social_backend_alignment.sql.

SELECT
  COUNT(*) AS total_friend_links,
  COUNT(*) FILTER (WHERE expires_at > NOW()) AS active_friend_links,
  COUNT(*) FILTER (WHERE used_by IS NOT NULL) AS used_legacy_links
FROM friend_links;

SELECT
  COUNT(*) FILTER (
    WHERE creator_id NOT LIKE 'guest_%' AND creator_username IS NULL
  ) AS authenticated_creators_missing_snapshot,
  COUNT(*) FILTER (
    WHERE opponent_id IS NOT NULL
      AND opponent_id NOT LIKE 'guest_%'
      AND opponent_username IS NULL
  ) AS authenticated_opponents_missing_snapshot,
  COUNT(*) FILTER (WHERE creator_id LIKE 'guest_%') AS legacy_guest_creators,
  COUNT(*) FILTER (WHERE opponent_id LIKE 'guest_%') AS legacy_guest_opponents
FROM challenges;
