CREATE TABLE IF NOT EXISTS workspace_config (
  id TEXT PRIMARY KEY,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
