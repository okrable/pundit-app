-- Read-only audit to run immediately before migration 012.
SELECT
  count(*) AS users_total,
  count(*) FILTER (WHERE username IS NULL) AS users_without_username,
  count(*) FILTER (WHERE username IS NOT NULL) AS users_with_username,
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
),
candidate_counts AS (
  SELECT generated_username, count(*) AS candidate_count
  FROM legacy_identity
  GROUP BY generated_username
)
SELECT
  (SELECT count(*) FROM legacy_identity) AS generated_candidates,
  (
    SELECT count(*)
    FROM candidate_counts
    WHERE candidate_count > 1
  ) AS duplicate_generated_candidates,
  (
    SELECT count(*)
    FROM legacy_identity candidate
    JOIN users existing
      ON existing.username_normalized = candidate.generated_username
     AND existing.id != candidate.id
  ) AS conflicts_with_existing_usernames;
