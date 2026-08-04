-- Run immediately after migration 016 and before players can manually choose letters.
SELECT
  COUNT(*) FILTER (WHERE avatar_id IS NULL) AS null_avatar_count,
  COUNT(*) FILTER (WHERE avatar_id LIKE 'letter-%') AS automatic_letter_count,
  COUNT(*) FILTER (
    WHERE avatar_id IS NOT NULL
      AND avatar_id NOT LIKE 'symbol-%'
      AND avatar_id NOT LIKE 'letter-%'
  ) AS malformed_avatar_count
FROM users;
