CREATE INDEX IF NOT EXISTS idx_cancellation_export_requests_status_expires
ON cancellation_export_requests(status, artifact_expires_at)
WHERE artifact_expires_at IS NOT NULL;
