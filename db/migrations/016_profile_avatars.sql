-- Migration: 016_profile_avatars
-- Description: Add persisted Pundit avatars and backfill established players
-- Database: CockroachDB (PostgreSQL-compatible)
-- Depends on: 001_users

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_id STRING;

WITH avatar_symbols AS (
  SELECT ARRAY[
    'symbol-classic-leather-football',
    'symbol-modern-panelled-football',
    'symbol-football-boot',
    'symbol-goalkeeper-glove',
    'symbol-football-shirt',
    'symbol-football-shirt-black-white-stripes',
    'symbol-football-shirt-all-white',
    'symbol-football-shirt-all-red',
    'symbol-football-shirt-blue-white-hoops',
    'symbol-supporter-scarf',
    'symbol-referee-whistle',
    'symbol-tactics-board',
    'symbol-trophy',
    'symbol-winners-medal',
    'symbol-corner-flag',
    'symbol-goal-and-net',
    'symbol-floodlights',
    'symbol-stadium',
    'symbol-referee-cards',
    'symbol-captains-armband',
    'symbol-match-stopwatch',
    'symbol-match-ticket',
    'symbol-turnstile',
    'symbol-pundit-microphone',
    'symbol-commentary-headphones',
    'symbol-match-day-pie',
    'symbol-away-day-coach',
    'symbol-football-programme',
    'symbol-manager-side-profile',
    'symbol-goalkeeper-diving',
    'symbol-dugout',
    'symbol-training-cone'
  ] AS ids
)
UPDATE users
SET avatar_id = avatar_symbols.ids[
  1 + floor(random() * array_length(avatar_symbols.ids, 1)::FLOAT)::INT
]
FROM avatar_symbols
WHERE users.avatar_id IS NULL;
