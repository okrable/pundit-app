-- Queries: results
-- Common queries for game history and leaderboards

-- Submit quiz result
INSERT INTO results (user_id, quiz_id, quiz_date, score, total_questions, answers, time_taken_seconds)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (user_id, quiz_id) DO NOTHING
RETURNING *;

-- Check if user already submitted today's quiz
SELECT EXISTS(
  SELECT 1 FROM results
  WHERE user_id = $1 AND quiz_id = $2
) as already_submitted;

-- Get user's quiz history (paginated)
SELECT
  quiz_id,
  quiz_date,
  score,
  total_questions,
  time_taken_seconds,
  created_at
FROM results
WHERE user_id = $1
ORDER BY quiz_date DESC
LIMIT $2 OFFSET $3;

-- Get user's result for a specific quiz
SELECT * FROM results
WHERE user_id = $1 AND quiz_id = $2;

-- Daily leaderboard (top scores for a specific date)
SELECT
  r.user_id,
  u.display_name,
  r.score,
  u.streak,
  r.time_taken_seconds,
  RANK() OVER (ORDER BY r.score DESC, r.time_taken_seconds ASC NULLS LAST) as rank
FROM results r
JOIN users u ON r.user_id = u.id
WHERE r.quiz_date = $1
ORDER BY r.score DESC, r.time_taken_seconds ASC NULLS LAST
LIMIT 100;

-- Get user's rank on daily leaderboard
WITH ranked AS (
  SELECT
    user_id,
    RANK() OVER (ORDER BY score DESC, time_taken_seconds ASC NULLS LAST) as rank
  FROM results
  WHERE quiz_date = $1
)
SELECT rank FROM ranked WHERE user_id = $2;

-- Weekly leaderboard (aggregate scores over last 7 days)
SELECT
  r.user_id,
  u.display_name,
  SUM(r.score) as total_score,
  COUNT(*) as games_played,
  u.streak
FROM results r
JOIN users u ON r.user_id = u.id
WHERE r.quiz_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY r.user_id, u.display_name, u.streak
ORDER BY total_score DESC, games_played DESC
LIMIT 100;

-- User's recent performance (last 7 quizzes)
SELECT
  quiz_date,
  score,
  total_questions
FROM results
WHERE user_id = $1
ORDER BY quiz_date DESC
LIMIT 7;

-- Count total results for a user
SELECT COUNT(*) as total_games FROM results WHERE user_id = $1;
