CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS operator_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NULL,
  password_algorithm TEXT NOT NULL DEFAULT 'pbkdf2_sha256',
  password_iterations INTEGER NULL,
  role TEXT NOT NULL CHECK (role IN ('platform_admin', 'support_operator')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS operator_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_user_id TEXT NOT NULL REFERENCES operator_users(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'provisioning', 'active', 'suspended', 'decommissioned')),
  plan_code TEXT NOT NULL DEFAULT 'standard',
  primary_contact_name TEXT NULL,
  primary_contact_email TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_domains (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  domain TEXT NOT NULL UNIQUE,
  domain_type TEXT NOT NULL CHECK (domain_type IN ('platform_subdomain', 'custom_domain')),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'failed')),
  verified_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_environments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  environment_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'provisioning', 'ready', 'degraded', 'archived')),
  app_base_url TEXT NULL,
  app_host TEXT NULL,
  web_host TEXT NULL,
  database_host TEXT NULL,
  database_name TEXT NULL,
  database_schema TEXT NULL,
  current_release_id TEXT NULL,
  setup_state TEXT NOT NULL DEFAULT 'uninitialized' CHECK (setup_state IN ('uninitialized', 'token_issued', 'initialized')),
  initialized_at TIMESTAMPTZ NULL,
  last_health_check_at TIMESTAMPTZ NULL,
  last_health_status TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_environment_unique UNIQUE (tenant_id, environment_key)
);

CREATE TABLE IF NOT EXISTS tenant_releases (
  id TEXT PRIMARY KEY,
  tenant_environment_id TEXT NOT NULL REFERENCES tenant_environments(id) ON DELETE CASCADE,
  release_version TEXT NOT NULL,
  app_commit_sha TEXT NULL,
  web_commit_sha TEXT NULL,
  deployed_by TEXT NULL REFERENCES operator_users(id) ON DELETE SET NULL,
  deployed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  release_notes TEXT NULL
);

ALTER TABLE tenant_environments
  DROP CONSTRAINT IF EXISTS tenant_environments_current_release_fk;

ALTER TABLE tenant_environments
  ADD CONSTRAINT tenant_environments_current_release_fk
  FOREIGN KEY (current_release_id)
  REFERENCES tenant_releases(id)
  ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS provisioning_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL REFERENCES tenants(id) ON DELETE SET NULL,
  tenant_environment_id TEXT NULL REFERENCES tenant_environments(id) ON DELETE SET NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('provision_environment', 'deploy_release', 'issue_setup_token', 'suspend_tenant', 'resume_tenant', 'decommission_tenant')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'canceled')),
  requested_by_operator_user_id TEXT NULL REFERENCES operator_users(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  error_code TEXT NULL,
  error_message TEXT NULL,
  idempotency_key TEXT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_provisioning_jobs_idempotency_key
ON provisioning_jobs(idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS provisioning_job_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provisioning_job_id TEXT NOT NULL REFERENCES provisioning_jobs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS setup_tokens_issued (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_environment_id TEXT NOT NULL REFERENCES tenant_environments(id) ON DELETE CASCADE,
  provisioning_job_id TEXT NULL REFERENCES provisioning_jobs(id) ON DELETE SET NULL,
  issued_by_operator_user_id TEXT NULL REFERENCES operator_users(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  delivered_via TEXT NULL,
  redeemed_at TIMESTAMPTZ NULL,
  notes TEXT NULL
);

CREATE TABLE IF NOT EXISTS operator_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_user_id TEXT NULL REFERENCES operator_users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NULL,
  tenant_id TEXT NULL REFERENCES tenants(id) ON DELETE SET NULL,
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operator_sessions_operator_user_id ON operator_sessions(operator_user_id);
CREATE INDEX IF NOT EXISTS idx_operator_sessions_expires_at ON operator_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_tenant_domains_tenant_id ON tenant_domains(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_environments_tenant_id ON tenant_environments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_releases_environment_id ON tenant_releases(tenant_environment_id);
CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_tenant_id ON provisioning_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_environment_id ON provisioning_jobs(tenant_environment_id);
CREATE INDEX IF NOT EXISTS idx_provisioning_job_events_job_id ON provisioning_job_events(provisioning_job_id);
CREATE INDEX IF NOT EXISTS idx_setup_tokens_issued_environment_id ON setup_tokens_issued(tenant_environment_id);
CREATE INDEX IF NOT EXISTS idx_operator_audit_log_tenant_id ON operator_audit_log(tenant_id);
