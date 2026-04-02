CREATE TABLE IF NOT EXISTS commercial_plans (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NULL,
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('month', 'year')),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  stripe_product_id TEXT NULL,
  stripe_price_id TEXT NULL,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  feature_summary_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  limits_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commercial_plans_public_active_sort
ON commercial_plans(is_public, is_active, sort_order);

CREATE TABLE IF NOT EXISTS customer_accounts (
  id TEXT PRIMARY KEY,
  account_name TEXT NOT NULL,
  account_slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('lead', 'checkout_started', 'active', 'past_due', 'suspended', 'canceled')),
  owner_first_name TEXT NOT NULL,
  owner_last_name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  owner_phone TEXT NULL,
  billing_email TEXT NULL,
  stripe_customer_id TEXT NULL UNIQUE,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_accounts_owner_email
ON customer_accounts(owner_email);

CREATE INDEX IF NOT EXISTS idx_customer_accounts_status
ON customer_accounts(status);

CREATE TABLE IF NOT EXISTS customer_subscriptions (
  id TEXT PRIMARY KEY,
  customer_account_id TEXT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  commercial_plan_id TEXT NOT NULL REFERENCES commercial_plans(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('incomplete', 'trialing', 'active', 'past_due', 'unpaid', 'canceled')),
  stripe_subscription_id TEXT NULL UNIQUE,
  stripe_checkout_session_id TEXT NULL,
  current_period_start TIMESTAMPTZ NULL,
  current_period_end TIMESTAMPTZ NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  canceled_at TIMESTAMPTZ NULL,
  trial_ends_at TIMESTAMPTZ NULL,
  grace_period_ends_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_account_id
ON customer_subscriptions(customer_account_id);

CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_status
ON customer_subscriptions(status);

CREATE TABLE IF NOT EXISTS billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_account_id TEXT NULL REFERENCES customer_accounts(id) ON DELETE SET NULL,
  customer_subscription_id TEXT NULL REFERENCES customer_subscriptions(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_source TEXT NOT NULL DEFAULT 'stripe',
  stripe_event_id TEXT NOT NULL UNIQUE,
  stripe_object_id TEXT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ NULL,
  processing_status TEXT NOT NULL DEFAULT 'received' CHECK (processing_status IN ('received', 'processed', 'ignored', 'failed')),
  processing_error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_account_id
ON billing_events(customer_account_id);

CREATE INDEX IF NOT EXISTS idx_billing_events_subscription_id
ON billing_events(customer_subscription_id);

CREATE INDEX IF NOT EXISTS idx_billing_events_processing_status
ON billing_events(processing_status);

CREATE TABLE IF NOT EXISTS checkout_sessions (
  id TEXT PRIMARY KEY,
  customer_account_id TEXT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  commercial_plan_id TEXT NOT NULL REFERENCES commercial_plans(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('created', 'completed', 'expired', 'failed')),
  stripe_checkout_session_id TEXT NOT NULL UNIQUE,
  stripe_checkout_url TEXT NULL,
  requested_subdomain_label TEXT NULL,
  success_token TEXT NOT NULL UNIQUE,
  cancel_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS provisioning_requests (
  id TEXT PRIMARY KEY,
  customer_account_id TEXT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  customer_subscription_id TEXT NOT NULL REFERENCES customer_subscriptions(id) ON DELETE CASCADE,
  commercial_plan_id TEXT NOT NULL REFERENCES commercial_plans(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('pending_billing_confirmation', 'queued', 'provisioning', 'awaiting_customer_setup', 'ready', 'failed', 'canceled')),
  trigger_source TEXT NOT NULL,
  requested_subdomain_label TEXT NULL,
  tenant_id TEXT NULL REFERENCES tenants(id) ON DELETE SET NULL,
  tenant_environment_id TEXT NULL REFERENCES tenant_environments(id) ON DELETE SET NULL,
  provisioning_job_id TEXT NULL REFERENCES provisioning_jobs(id) ON DELETE SET NULL,
  result_access_url TEXT NULL,
  result_setup_token_issued BOOLEAN NOT NULL DEFAULT FALSE,
  failure_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  CONSTRAINT provisioning_requests_subscription_unique UNIQUE (customer_subscription_id)
);

CREATE INDEX IF NOT EXISTS idx_provisioning_requests_status
ON provisioning_requests(status);

CREATE INDEX IF NOT EXISTS idx_provisioning_requests_tenant_id
ON provisioning_requests(tenant_id);

CREATE INDEX IF NOT EXISTS idx_provisioning_requests_environment_id
ON provisioning_requests(tenant_environment_id);

CREATE TABLE IF NOT EXISTS access_handoffs (
  id TEXT PRIMARY KEY,
  customer_account_id TEXT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  customer_subscription_id TEXT NOT NULL REFERENCES customer_subscriptions(id) ON DELETE CASCADE,
  provisioning_request_id TEXT NOT NULL REFERENCES provisioning_requests(id) ON DELETE CASCADE,
  signup_status_token TEXT NOT NULL UNIQUE,
  tenant_url TEXT NULL,
  admin_setup_mode TEXT NOT NULL CHECK (admin_setup_mode IN ('setup_token', 'admin_invite', 'pending')),
  setup_token TEXT NULL,
  setup_token_expires_at TIMESTAMPTZ NULL,
  delivery_channel TEXT NULL,
  delivered_at TIMESTAMPTZ NULL,
  last_viewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_handoffs_provisioning_request_id
ON access_handoffs(provisioning_request_id);

INSERT INTO commercial_plans (
  id,
  code,
  name,
  description,
  billing_interval,
  price_cents,
  currency,
  is_public,
  is_active,
  sort_order,
  feature_summary_json,
  limits_json
)
VALUES
  (
    'plan-starter-monthly',
    'starter_monthly',
    'Starter',
    'Hosted access for a family using the full platform without extra operational overhead.',
    'month',
    1900,
    'usd',
    TRUE,
    TRUE,
    10,
    '["Hosted scheduling and curriculum tools","Attendance, grades, and reports","Standard automated provisioning","Email-based access handoff"]'::jsonb,
    '{}'::jsonb
  ),
  (
    'plan-growth-monthly',
    'growth_monthly',
    'Growth',
    'Hosted access for families or small learning groups that want more operating room and smoother support.',
    'month',
    3900,
    'usd',
    TRUE,
    TRUE,
    20,
    '["Everything in Starter","Expanded support expectations","Priority provisioning review if setup issues appear","Better fit for multi-student operational reporting"]'::jsonb,
    '{}'::jsonb
  ),
  (
    'plan-support-plus-monthly',
    'support_plus_monthly',
    'Support Plus',
    'Higher-touch onboarding and support for customers who want a more guided hosted rollout.',
    'month',
    7900,
    'usd',
    TRUE,
    TRUE,
    30,
    '["Everything in Growth","Higher-touch onboarding expectations","Operational follow-up for provisioning and account setup","Best fit when guided rollout matters more than lowest price"]'::jsonb,
    '{}'::jsonb
  )
ON CONFLICT (id) DO UPDATE
SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  billing_interval = EXCLUDED.billing_interval,
  price_cents = EXCLUDED.price_cents,
  currency = EXCLUDED.currency,
  is_public = EXCLUDED.is_public,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  feature_summary_json = EXCLUDED.feature_summary_json,
  limits_json = EXCLUDED.limits_json,
  updated_at = NOW();
