-- Queries: online_games
-- Common queries for real-time multiplayer games

-- Create a new game
INSERT INTO online_games (code, host_id, game_type, quiz_id, questions, max_players, round_time_seconds)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- Get game by code (for joining)
SELECT
  g.*,
  u.display_name as host_name,
  (SELECT COUNT(*) FROM online_game_players WHERE game_id = g.id) as player_count
FROM online_games g
JOIN users u ON g.host_id = u.id
WHERE g.code = $1;

-- Get game by ID
SELECT * FROM online_games WHERE id = $1;

-- Join a game
INSERT INTO online_game_players (game_id, user_id, display_name)
VALUES ($1, $2, $3)
ON CONFLICT (game_id, user_id) DO UPDATE SET
  is_connected = true
RETURNING *;

-- Leave a game (or disconnect)
UPDATE online_game_players
SET is_connected = false
WHERE game_id = $1 AND user_id = $2;

-- Set player ready status
UPDATE online_game_players
SET is_ready = $3
WHERE game_id = $1 AND user_id = $2;

-- Get game players (lobby)
SELECT
  ogp.user_id,
  ogp.display_name,
  ogp.is_ready,
  ogp.is_connected,
  ogp.score,
  ogp.joined_at
FROM online_game_players ogp
WHERE ogp.game_id = $1
  AND ogp.is_connected = true
ORDER BY ogp.joined_at ASC;

-- Start game
UPDATE online_games
SET status = 'in_progress', started_at = now()
WHERE id = $1 AND host_id = $2 AND status = 'waiting'
RETURNING *;

-- Submit answer for current question
UPDATE online_game_players
SET
  answers = COALESCE(answers, '[]'::JSONB) || $3::JSONB,
  score = score + $4
WHERE game_id = $1 AND user_id = $2;

-- Advance to next question
UPDATE online_games
SET current_question_index = current_question_index + 1
WHERE id = $1;

-- End game
UPDATE online_games
SET status = 'completed', ended_at = now()
WHERE id = $1
RETURNING *;

-- Get game leaderboard (during/after game)
SELECT
  ogp.user_id,
  ogp.display_name,
  ogp.score,
  ogp.finished_at,
  RANK() OVER (ORDER BY ogp.score DESC, ogp.finished_at ASC NULLS LAST) as rank
FROM online_game_players ogp
WHERE ogp.game_id = $1
ORDER BY ogp.score DESC, ogp.finished_at ASC NULLS LAST;

-- Mark player as finished
UPDATE online_game_players
SET finished_at = now()
WHERE game_id = $1 AND user_id = $2;

-- Check if all players finished current question
SELECT
  COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(answers, '[]'::JSONB)) > $2) as answered,
  COUNT(*) as total
FROM online_game_players
WHERE game_id = $1 AND is_connected = true;

-- Get waiting games (for game browser)
SELECT
  g.id,
  g.code,
  g.game_type,
  u.display_name as host_name,
  (SELECT COUNT(*) FROM online_game_players WHERE game_id = g.id AND is_connected = true) as player_count,
  g.max_players,
  g.created_at
FROM online_games g
JOIN users u ON g.host_id = u.id
WHERE g.status = 'waiting'
  AND g.created_at > now() - INTERVAL '1 hour'
ORDER BY g.created_at DESC
LIMIT 20;

-- Cancel game (host only)
UPDATE online_games
SET status = 'cancelled', ended_at = now()
WHERE id = $1 AND host_id = $2;

-- Clean up old waiting games (maintenance)
UPDATE online_games
SET status = 'cancelled', ended_at = now()
WHERE status = 'waiting'
  AND created_at < now() - INTERVAL '2 hours';

-- Get user's recent online games
SELECT
  g.id,
  g.code,
  g.game_type,
  g.status,
  ogp.score,
  (SELECT MAX(score) FROM online_game_players WHERE game_id = g.id) as winning_score,
  g.started_at,
  g.ended_at
FROM online_game_players ogp
JOIN online_games g ON ogp.game_id = g.id
WHERE ogp.user_id = $1
ORDER BY g.created_at DESC
LIMIT 10;
