-- Additive: old writers remain supported; historical detail is deliberately unknown.
ALTER TABLE results ADD COLUMN IF NOT EXISTS answer_details JSONB;
