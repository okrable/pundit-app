-- Read-only audit to run after migration 012.
SELECT
  count(*) AS users_total,
  count(*) FILTER (WHERE username IS NULL) AS users_without_username,
  count(*) FILTER (
    WHERE onboarding_status = 'username_required'
  ) AS users_requiring_username,
  count(*) FILTER (
    WHERE onboarding_status = 'complete' AND username IS NULL
  ) AS invalid_complete_users,
  count(*) FILTER (
    WHERE username IS NOT NULL
      AND username_normalized != lower(username)
  ) AS invalid_normalized_usernames
FROM users;

SELECT
  username_normalized,
  count(*) AS duplicate_count
FROM users
WHERE username_normalized IS NOT NULL
GROUP BY username_normalized
HAVING count(*) > 1;
