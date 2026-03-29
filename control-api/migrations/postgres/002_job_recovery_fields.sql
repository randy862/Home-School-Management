ALTER TABLE provisioning_jobs
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS retry_of_job_id TEXT NULL;

ALTER TABLE provisioning_jobs
  DROP CONSTRAINT IF EXISTS provisioning_jobs_max_attempts_check;

ALTER TABLE provisioning_jobs
  ADD CONSTRAINT provisioning_jobs_max_attempts_check
  CHECK (max_attempts >= 1 AND max_attempts <= 10);

ALTER TABLE provisioning_jobs
  DROP CONSTRAINT IF EXISTS provisioning_jobs_retry_of_job_fk;

ALTER TABLE provisioning_jobs
  ADD CONSTRAINT provisioning_jobs_retry_of_job_fk
  FOREIGN KEY (retry_of_job_id)
  REFERENCES provisioning_jobs(id)
  ON DELETE SET NULL;

UPDATE provisioning_jobs
SET next_attempt_at = COALESCE(next_attempt_at, requested_at, NOW())
WHERE next_attempt_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_next_attempt_at
ON provisioning_jobs(status, next_attempt_at);
