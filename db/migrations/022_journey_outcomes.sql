-- Additive. Keep this default for legacy solve-only writers.
ALTER TABLE career_game_results
  ADD COLUMN IF NOT EXISTS outcome STRING NOT NULL DEFAULT 'solved'
  CHECK (outcome IN ('solved', 'given_up'));
