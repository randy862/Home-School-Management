CREATE TABLE IF NOT EXISTS email_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_account_id TEXT NULL REFERENCES customer_accounts(id) ON DELETE SET NULL,
  customer_subscription_id TEXT NULL REFERENCES customer_subscriptions(id) ON DELETE SET NULL,
  provisioning_request_id TEXT NULL REFERENCES provisioning_requests(id) ON DELETE SET NULL,
  access_handoff_id TEXT NULL REFERENCES access_handoffs(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  provider_server_name TEXT NULL,
  message_template TEXT NOT NULL,
  message_tag TEXT NULL,
  delivery_mode TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'logged', 'skipped', 'failed')),
  provider_message_id TEXT NULL,
  error_code TEXT NULL,
  error_message TEXT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_email_deliveries_access_handoff_id
ON email_deliveries(access_handoff_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_deliveries_provisioning_request_id
ON email_deliveries(provisioning_request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_deliveries_status
ON email_deliveries(status, created_at DESC);
