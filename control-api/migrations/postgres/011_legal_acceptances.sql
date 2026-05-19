CREATE TABLE IF NOT EXISTS legal_acceptances (
  id TEXT PRIMARY KEY,
  customer_account_id TEXT NULL REFERENCES customer_accounts(id) ON DELETE SET NULL,
  customer_subscription_id TEXT NULL REFERENCES customer_subscriptions(id) ON DELETE SET NULL,
  tenant_id TEXT NULL REFERENCES tenants(id) ON DELETE SET NULL,
  user_id TEXT NULL,
  email TEXT NOT NULL,
  organization_name TEXT NULL,
  terms_version TEXT NOT NULL,
  privacy_version TEXT NOT NULL,
  terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  privacy_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  accepted_at TIMESTAMPTZ NOT NULL,
  ip_address TEXT NULL,
  user_agent TEXT NULL,
  stripe_customer_id TEXT NULL,
  stripe_checkout_session_id TEXT NULL,
  stripe_subscription_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_legal_acceptances_customer_account_id
ON legal_acceptances(customer_account_id);

CREATE INDEX IF NOT EXISTS idx_legal_acceptances_customer_subscription_id
ON legal_acceptances(customer_subscription_id);

CREATE INDEX IF NOT EXISTS idx_legal_acceptances_email
ON legal_acceptances(email);

CREATE INDEX IF NOT EXISTS idx_legal_acceptances_stripe_checkout_session_id
ON legal_acceptances(stripe_checkout_session_id);

CREATE INDEX IF NOT EXISTS idx_legal_acceptances_stripe_subscription_id
ON legal_acceptances(stripe_subscription_id);
