ALTER TABLE provisioning_jobs
  DROP CONSTRAINT IF EXISTS provisioning_jobs_job_type_check;

ALTER TABLE provisioning_jobs
  ADD CONSTRAINT provisioning_jobs_job_type_check
  CHECK (job_type IN (
    'provision_environment',
    'deploy_release',
    'issue_setup_token',
    'suspend_tenant',
    'resume_tenant',
    'decommission_tenant',
    'archive_tenant_data'
  ));

CREATE TABLE IF NOT EXISTS tenant_data_archives (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL REFERENCES tenants(id) ON DELETE SET NULL,
  tenant_environment_id TEXT NULL REFERENCES tenant_environments(id) ON DELETE SET NULL,
  provisioning_job_id TEXT NULL REFERENCES provisioning_jobs(id) ON DELETE SET NULL,
  archive_type TEXT NOT NULL DEFAULT 'internal' CHECK (archive_type IN ('internal')),
  status TEXT NOT NULL DEFAULT 'metadata_recorded' CHECK (status IN ('metadata_recorded', 'exported', 'failed')),
  database_host TEXT NULL,
  database_name TEXT NULL,
  database_schema TEXT NULL,
  artifact_path TEXT NULL,
  artifact_checksum TEXT NULL,
  notes TEXT NULL,
  created_by_operator_user_id TEXT NULL REFERENCES operator_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_data_archives_tenant_id
ON tenant_data_archives(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_data_archives_environment_id
ON tenant_data_archives(tenant_environment_id, created_at DESC);
