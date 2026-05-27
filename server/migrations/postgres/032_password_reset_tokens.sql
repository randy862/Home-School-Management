DO $$
DECLARE
  target_schema TEXT;
  target_owner TEXT;
BEGIN
  FOR target_schema, target_owner IN
    SELECT
      schemaname,
      tableowner
    FROM pg_tables
    WHERE tablename = 'users'
      AND schemaname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY schemaname
  LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I.password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL REFERENCES %I.users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ NULL,
        requested_ip TEXT NULL,
        requested_user_agent TEXT NULL
      )',
      target_schema,
      target_schema
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON %I.password_reset_tokens(user_id)',
      target_schema
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON %I.password_reset_tokens(expires_at)',
      target_schema
    );
    EXECUTE format(
      'ALTER TABLE %I.password_reset_tokens OWNER TO %I',
      target_schema,
      target_owner
    );
  END LOOP;
END $$;
