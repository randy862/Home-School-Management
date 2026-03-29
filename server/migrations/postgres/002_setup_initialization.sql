CREATE TABLE IF NOT EXISTS app_runtime_state (
  id TEXT PRIMARY KEY,
  setup_completed_at TIMESTAMPTZ NULL,
  initialized_by_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_runtime_state (id, setup_completed_at, initialized_by_user_id, updated_at)
VALUES (
  'singleton',
  CASE WHEN EXISTS (SELECT 1 FROM users WHERE role = 'admin') THEN NOW() ELSE NULL END,
  NULL,
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET
  setup_completed_at = COALESCE(app_runtime_state.setup_completed_at, EXCLUDED.setup_completed_at),
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS setup_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL DEFAULT 'initial_admin_setup',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_by TEXT NULL,
  notes TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_setup_tokens_expires_at ON setup_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_setup_tokens_used_at ON setup_tokens(used_at);
