ALTER TABLE customer_subscriptions
  ADD COLUMN IF NOT EXISTS dormant_status TEXT NOT NULL DEFAULT 'active'
    CHECK (dormant_status IN ('active', 'pending_dormant', 'dormant', 'pending_reactivation')),
  ADD COLUMN IF NOT EXISTS base_price_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS included_billable_students INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS per_student_overage_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_billable_student_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_overage_student_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_billable_count_calculated_at TIMESTAMPTZ NULL;

CREATE TABLE IF NOT EXISTS billable_student_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_subscription_id TEXT NOT NULL REFERENCES customer_subscriptions(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  billing_period_start TIMESTAMPTZ NOT NULL,
  billing_period_end TIMESTAMPTZ NOT NULL,
  student_id TEXT NOT NULL,
  first_reason TEXT NOT NULL,
  counted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT billable_student_periods_unique UNIQUE (
    customer_subscription_id,
    billing_period_start,
    billing_period_end,
    student_id
  )
);

CREATE INDEX IF NOT EXISTS idx_billable_student_periods_tenant_period
ON billable_student_periods(tenant_id, billing_period_start, billing_period_end);

CREATE TABLE IF NOT EXISTS billable_student_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_subscription_id TEXT NOT NULL REFERENCES customer_subscriptions(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  billing_period_start TIMESTAMPTZ NOT NULL,
  billing_period_end TIMESTAMPTZ NOT NULL,
  event_type TEXT NOT NULL,
  event_source TEXT NOT NULL,
  source_record_id TEXT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billable_student_events_subscription_period
ON billable_student_events(customer_subscription_id, billing_period_start, billing_period_end);

CREATE TABLE IF NOT EXISTS cancellation_export_requests (
  id TEXT PRIMARY KEY,
  customer_account_id TEXT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  customer_subscription_id TEXT NOT NULL REFERENCES customer_subscriptions(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending_payment', 'paid', 'queued', 'processing', 'ready', 'failed', 'expired')),
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  requested_by_email TEXT NULL,
  payment_reference TEXT NULL,
  export_job_id TEXT NULL REFERENCES provisioning_jobs(id) ON DELETE SET NULL,
  artifact_path TEXT NULL,
  artifact_expires_at TIMESTAMPTZ NULL,
  failure_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cancellation_export_requests_subscription
ON cancellation_export_requests(customer_subscription_id, created_at DESC);

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
  limits_json,
  created_at,
  updated_at
)
VALUES
  (
    'plan-starter-monthly',
    'starter_monthly',
    'Starter',
    'Hosted access for families with up to three billable students in the current billing period.',
    'month',
    999,
    'usd',
    TRUE,
    TRUE,
    10,
    '["1-3 students","Grades, attendance, and reports","Scheduling and planning tools","Historical records preserved","Secure online access"]'::jsonb,
    '{"includedBillableStudents":3,"perStudentOverageCents":0,"allowsOverage":false,"dormantBasePricePercentage":25}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'plan-growth-monthly',
    'growth_monthly',
    'Growth',
    'Hosted access for larger families and small learning groups with up to ten billable students in the current billing period.',
    'month',
    1499,
    'usd',
    TRUE,
    TRUE,
    20,
    '["4-10 students","Everything in Starter","More room to grow","Great for multi-child households","Ideal for pods and shared teaching groups"]'::jsonb,
    '{"includedBillableStudents":10,"perStudentOverageCents":0,"allowsOverage":false,"dormantBasePricePercentage":25}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'plan-support-plus-monthly',
    'large_monthly',
    'Co-op Pro',
    'Hosted access for co-ops and larger programs with a monthly base plus per-student overage after eleven billable students.',
    'month',
    1599,
    'usd',
    TRUE,
    TRUE,
    30,
    '["11 students included","Add students as needed","Full grades, attendance, and reports","Great for organized group instruction","Historical records preserved"]'::jsonb,
    '{"includedBillableStudents":11,"perStudentOverageCents":99,"allowsOverage":true,"dormantBasePricePercentage":25}'::jsonb,
    NOW(),
    NOW()
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

UPDATE customer_subscriptions sub
SET
  base_price_cents = COALESCE(NULLIF(sub.base_price_cents, 0), plan.price_cents),
  included_billable_students = COALESCE(NULLIF(sub.included_billable_students, 0), COALESCE((plan.limits_json ->> 'includedBillableStudents')::INTEGER, 0)),
  per_student_overage_cents = COALESCE(sub.per_student_overage_cents, COALESCE((plan.limits_json ->> 'perStudentOverageCents')::INTEGER, 0))
FROM commercial_plans plan
WHERE plan.id = sub.commercial_plan_id;
