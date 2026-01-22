-- Queries: users
-- Common queries for user profile and stats

-- Get user by ID
SELECT * FROM users WHERE id = $1;

-- Get user by email (for Auth0 login matching)
SELECT * FROM users WHERE email = $1;

-- Create or update user on login (upsert)
INSERT INTO users (id, display_name, email, avatar_url, created_at)
VALUES ($1, $2, $3, $4, now())
ON CONFLICT (id) DO UPDATE SET
  display_name = COALESCE(EXCLUDED.display_name, users.display_name),
  email = COALESCE(EXCLUDED.email, users.email),
  avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url);

-- Update user stats after quiz submission
UPDATE users SET
  streak = $2,
  best_score = GREATEST(best_score, $3),
  total_quizzes = total_quizzes + 1,
  total_correct = total_correct + $4,
  last_played = $5
WHERE id = $1;

-- Get user stats
SELECT
  streak,
  best_score,
  total_quizzes,
  total_correct,
  CASE WHEN total_quizzes > 0
    THEN ROUND(total_correct::DECIMAL / (total_quizzes * 5) * 100, 1)
    ELSE 0
  END as accuracy_pct
FROM users
WHERE id = $1;

-- Get top users by streak (global leaderboard)
SELECT id, display_name, streak, best_score
FROM users
WHERE streak > 0
ORDER BY streak DESC, best_score DESC
LIMIT 100;

-- Calculate streak for a user (based on consecutive days)
-- Returns the count of consecutive days played ending today or yesterday
WITH consecutive_days AS (
  SELECT
    quiz_date,
    quiz_date - (ROW_NUMBER() OVER (ORDER BY quiz_date DESC))::INT AS grp
  FROM results
  WHERE user_id = $1
    AND quiz_date >= CURRENT_DATE - INTERVAL '365 days'
)
SELECT COUNT(*) as streak
FROM consecutive_days
WHERE grp = (
  SELECT grp FROM consecutive_days
  WHERE quiz_date IN (CURRENT_DATE, CURRENT_DATE - 1)
  LIMIT 1
);
