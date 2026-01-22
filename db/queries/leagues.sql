-- Queries: leagues
-- Common queries for leagues and memberships

-- Create a new league
INSERT INTO leagues (name, code, description, owner_id, is_public, max_members)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- Get league by code (for joining)
SELECT * FROM leagues WHERE code = $1;

-- Get league by ID
SELECT
  l.*,
  u.display_name as owner_name,
  (SELECT COUNT(*) FROM league_members WHERE league_id = l.id) as member_count
FROM leagues l
JOIN users u ON l.owner_id = u.id
WHERE l.id = $1;

-- Join a league
INSERT INTO league_members (league_id, user_id, role)
VALUES ($1, $2, 'member')
ON CONFLICT (league_id, user_id) DO NOTHING
RETURNING *;

-- Leave a league
DELETE FROM league_members
WHERE league_id = $1 AND user_id = $2 AND role != 'owner';

-- Get user's leagues
SELECT
  l.id,
  l.name,
  l.code,
  lm.role,
  lm.joined_at,
  (SELECT COUNT(*) FROM league_members WHERE league_id = l.id) as member_count
FROM leagues l
JOIN league_members lm ON l.id = lm.league_id
WHERE lm.user_id = $1
ORDER BY lm.joined_at DESC;

-- Get league members with stats
SELECT
  lm.user_id,
  u.display_name,
  u.avatar_url,
  u.streak,
  u.best_score,
  lm.role,
  lm.joined_at
FROM league_members lm
JOIN users u ON lm.user_id = u.id
WHERE lm.league_id = $1
ORDER BY u.streak DESC, u.best_score DESC;

-- League leaderboard (today's scores)
SELECT
  lm.user_id,
  u.display_name,
  u.avatar_url,
  r.score,
  u.streak,
  RANK() OVER (ORDER BY r.score DESC, r.time_taken_seconds ASC NULLS LAST) as rank
FROM league_members lm
JOIN users u ON lm.user_id = u.id
LEFT JOIN results r ON r.user_id = lm.user_id AND r.quiz_date = CURRENT_DATE
WHERE lm.league_id = $1
ORDER BY r.score DESC NULLS LAST, r.time_taken_seconds ASC NULLS LAST;

-- League weekly leaderboard
SELECT
  lm.user_id,
  u.display_name,
  COALESCE(SUM(r.score), 0) as total_score,
  COUNT(r.id) as games_played,
  u.streak
FROM league_members lm
JOIN users u ON lm.user_id = u.id
LEFT JOIN results r ON r.user_id = lm.user_id
  AND r.quiz_date >= CURRENT_DATE - INTERVAL '7 days'
WHERE lm.league_id = $1
GROUP BY lm.user_id, u.display_name, u.streak
ORDER BY total_score DESC, games_played DESC;

-- Check if user is member of league
SELECT EXISTS(
  SELECT 1 FROM league_members
  WHERE league_id = $1 AND user_id = $2
) as is_member;

-- Update member role
UPDATE league_members
SET role = $3
WHERE league_id = $1 AND user_id = $2;

-- Delete league (owner only)
DELETE FROM leagues WHERE id = $1 AND owner_id = $2;

-- Search public leagues
SELECT
  l.id,
  l.name,
  l.description,
  (SELECT COUNT(*) FROM league_members WHERE league_id = l.id) as member_count,
  l.max_members
FROM leagues l
WHERE l.is_public = true
  AND l.name ILIKE '%' || $1 || '%'
ORDER BY member_count DESC
LIMIT 20;
