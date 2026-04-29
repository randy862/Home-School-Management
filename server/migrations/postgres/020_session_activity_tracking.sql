ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NULL;

UPDATE user_sessions
SET last_seen_at = COALESCE(last_seen_at, created_at, NOW())
WHERE last_seen_at IS NULL;

ALTER TABLE user_sessions
  ALTER COLUMN last_seen_at SET DEFAULT NOW(),
  ALTER COLUMN last_seen_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_last_seen_at ON user_sessions(last_seen_at);
