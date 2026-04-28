# SaaS Backend Schema And API Design

Date: 2026-04-02
Owner: Backend/API Engineer
Related:
- `NOTES/saas-implementation-spec-package.md`
- `NOTES/saas-commercial-roadmap.md`
- `NOTES/control-plane-provisioning-workflow.md`
- `NOTES/subscription-billing-policy.md`

## Purpose

Define the first implementation-ready backend package for the commercial SaaS layer:

- storage/schema shape
- public API contract
- Stripe integration boundary
- control-plane provisioning handoff
- environment variable contract

This note is the bridge between the SaaS planning package and the first code implementation session.

## Architectural Recommendation

Use the existing `control-api/` service as the first commercial backend boundary instead of creating a third service immediately.

Reasoning:

- `control-api/` already owns tenant, environment, provisioning-job, setup-token, and operator-audit concerns.
- The first SaaS slice needs tight coupling to tenant/environment/job creation.
- Adding a separate billing service now would increase coordination cost before the first subscription path is proven.

Recommended first-release model:

- public marketing page remains static on `WEB001`
- new public SaaS endpoints are added to `control-api/`
- commercial tables live in the same PostgreSQL control-plane database
- tenant runtime remains separate and is still provisioned through the existing control-plane worker

Future option:

- if the commercial layer grows significantly, extract it later into a dedicated `commercial-api` or `billing-api` service

## Boundary Model

### Commercial Layer Owns

- public plans
- customer accounts
- subscriptions
- billing events
- checkout sessions
- provisioning requests
- customer-facing signup status tokens
- access handoff metadata

### Existing Control Plane Continues To Own

- tenants
- tenant domains
- tenant environments
- tenant releases
- provisioning jobs and events
- setup-token issuance metadata
- lifecycle actions such as suspend and resume

### Key Rule

The commercial layer does not provision infrastructure directly.

It creates one idempotent provisioning request and then delegates tenant/environment/job creation to the existing control-plane workflow.

## Storage Schema

### Schema Placement

Recommended first release:

- store commercial tables in the same PostgreSQL database as `control-api`
- keep them in the same schema as the control-plane tables unless a separate `commercial` schema is desired immediately

Recommendation:

- use the same schema for the first implementation to minimize migration and query complexity

## Tables

### 1. commercial_plans

Purpose:
- source of truth for public plans and Stripe price mapping

Current first-release pricing policy:

- `Starter`: `$9.99/month` for `1-3` billable students
- `Growth`: `$14.99/month` for `4-10` billable students
- `Large`: `$15.99/month` plus `$0.99` per billable student above `11`

See `NOTES/subscription-billing-policy.md` for the exact definition of `billable student`.

Columns:
- `id TEXT PRIMARY KEY`
- `code TEXT NOT NULL UNIQUE`
- `name TEXT NOT NULL`
- `description TEXT NULL`
- `billing_interval TEXT NOT NULL CHECK (billing_interval IN ('month', 'year'))`
- `price_cents INTEGER NOT NULL CHECK (price_cents >= 0)`
- `currency TEXT NOT NULL DEFAULT 'usd'`
- `stripe_product_id TEXT NULL`
- `stripe_price_id TEXT NULL`
- `is_public BOOLEAN NOT NULL DEFAULT TRUE`
- `is_active BOOLEAN NOT NULL DEFAULT TRUE`
- `sort_order INTEGER NOT NULL DEFAULT 0`
- `feature_summary_json JSONB NOT NULL DEFAULT '[]'::jsonb`
- `limits_json JSONB NOT NULL DEFAULT '{}'::jsonb`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Indexes:
- unique on `code`
- index on `(is_public, is_active, sort_order)`

### 2. customer_accounts

Purpose:
- commercial customer record independent of tenant runtime state

Columns:
- `id TEXT PRIMARY KEY`
- `account_name TEXT NOT NULL`
- `account_slug TEXT NOT NULL UNIQUE`
- `status TEXT NOT NULL CHECK (status IN ('lead', 'checkout_started', 'active', 'past_due', 'suspended', 'canceled'))`
- `owner_first_name TEXT NOT NULL`
- `owner_last_name TEXT NOT NULL`
- `owner_email TEXT NOT NULL`
- `owner_phone TEXT NULL`
- `billing_email TEXT NULL`
- `stripe_customer_id TEXT NULL UNIQUE`
- `notes TEXT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Indexes:
- unique on `account_slug`
- index on `owner_email`
- index on `status`

### 3. customer_subscriptions

Purpose:
- recurring commercial agreement tied to one account and one plan

Columns:
- `id TEXT PRIMARY KEY`
- `customer_account_id TEXT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE`
- `commercial_plan_id TEXT NOT NULL REFERENCES commercial_plans(id) ON DELETE RESTRICT`
- `status TEXT NOT NULL CHECK (status IN ('incomplete', 'trialing', 'active', 'past_due', 'unpaid', 'canceled'))`
- `stripe_subscription_id TEXT NULL UNIQUE`
- `stripe_checkout_session_id TEXT NULL`
- `current_period_start TIMESTAMPTZ NULL`
- `current_period_end TIMESTAMPTZ NULL`
- `cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE`
- `canceled_at TIMESTAMPTZ NULL`
- `trial_ends_at TIMESTAMPTZ NULL`
- `grace_period_ends_at TIMESTAMPTZ NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Recommended additions for the billing-policy implementation:

- `dormant_status TEXT NOT NULL DEFAULT 'active' CHECK (dormant_status IN ('active', 'pending_dormant', 'dormant', 'pending_reactivation'))`
- `base_price_cents INTEGER NOT NULL DEFAULT 0`
- `included_billable_students INTEGER NOT NULL DEFAULT 0`
- `per_student_overage_cents INTEGER NOT NULL DEFAULT 0`
- `current_billable_student_count INTEGER NOT NULL DEFAULT 0`
- `current_overage_student_count INTEGER NOT NULL DEFAULT 0`
- `last_billable_count_calculated_at TIMESTAMPTZ NULL`

Indexes:
- index on `customer_account_id`
- unique on `stripe_subscription_id`
- index on `status`

### 4. billing_events

Purpose:
- durable, idempotent Stripe event ledger for reconciliation and replay safety

Columns:
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `customer_account_id TEXT NULL REFERENCES customer_accounts(id) ON DELETE SET NULL`
- `customer_subscription_id TEXT NULL REFERENCES customer_subscriptions(id) ON DELETE SET NULL`
- `event_type TEXT NOT NULL`
- `event_source TEXT NOT NULL DEFAULT 'stripe'`
- `stripe_event_id TEXT NOT NULL UNIQUE`
- `stripe_object_id TEXT NULL`
- `occurred_at TIMESTAMPTZ NOT NULL`
- `payload_json JSONB NOT NULL DEFAULT '{}'::jsonb`
- `processed_at TIMESTAMPTZ NULL`
- `processing_status TEXT NOT NULL DEFAULT 'received' CHECK (processing_status IN ('received', 'processed', 'ignored', 'failed'))`
- `processing_error TEXT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Indexes:
- unique on `stripe_event_id`
- index on `customer_account_id`
- index on `customer_subscription_id`
- index on `processing_status`

### 5. checkout_sessions

Purpose:
- ties pre-checkout customer intent to Stripe Checkout sessions and allows status lookups before webhook completion

Columns:
- `id TEXT PRIMARY KEY`
- `customer_account_id TEXT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE`
- `commercial_plan_id TEXT NOT NULL REFERENCES commercial_plans(id) ON DELETE RESTRICT`
- `status TEXT NOT NULL CHECK (status IN ('created', 'completed', 'expired', 'failed'))`
- `stripe_checkout_session_id TEXT NOT NULL UNIQUE`
- `stripe_checkout_url TEXT NULL`
- `requested_subdomain_label TEXT NULL`
- `success_token TEXT NOT NULL UNIQUE`
- `cancel_token TEXT NOT NULL UNIQUE`
- `expires_at TIMESTAMPTZ NULL`
- `completed_at TIMESTAMPTZ NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Indexes:
- unique on `stripe_checkout_session_id`
- unique on `success_token`

### 6. provisioning_requests

Purpose:
- commercial-to-control handoff record

Columns:
- `id TEXT PRIMARY KEY`
- `customer_account_id TEXT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE`
- `customer_subscription_id TEXT NOT NULL REFERENCES customer_subscriptions(id) ON DELETE CASCADE`
- `commercial_plan_id TEXT NOT NULL REFERENCES commercial_plans(id) ON DELETE RESTRICT`
- `status TEXT NOT NULL CHECK (status IN ('pending_billing_confirmation', 'queued', 'provisioning', 'awaiting_customer_setup', 'ready', 'failed', 'canceled'))`
- `trigger_source TEXT NOT NULL`
- `requested_subdomain_label TEXT NULL`
- `tenant_id TEXT NULL REFERENCES tenants(id) ON DELETE SET NULL`
- `tenant_environment_id TEXT NULL REFERENCES tenant_environments(id) ON DELETE SET NULL`
- `provisioning_job_id TEXT NULL REFERENCES provisioning_jobs(id) ON DELETE SET NULL`
- `result_access_url TEXT NULL`
- `result_setup_token_issued BOOLEAN NOT NULL DEFAULT FALSE`
- `failure_reason TEXT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `completed_at TIMESTAMPTZ NULL`

Indexes:
- unique on `(customer_subscription_id)`
- index on `status`
- index on `tenant_id`
- index on `tenant_environment_id`

### 7. access_handoffs

Purpose:
- customer-visible access delivery record

Columns:
- `id TEXT PRIMARY KEY`
- `customer_account_id TEXT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE`
- `customer_subscription_id TEXT NOT NULL REFERENCES customer_subscriptions(id) ON DELETE CASCADE`
- `provisioning_request_id TEXT NOT NULL REFERENCES provisioning_requests(id) ON DELETE CASCADE`
- `signup_status_token TEXT NOT NULL UNIQUE`
- `tenant_url TEXT NULL`
- `admin_setup_mode TEXT NOT NULL CHECK (admin_setup_mode IN ('setup_token', 'admin_invite', 'pending'))`
- `setup_token TEXT NULL`
- `setup_token_expires_at TIMESTAMPTZ NULL`
- `delivery_channel TEXT NULL`
- `delivered_at TIMESTAMPTZ NULL`
- `last_viewed_at TIMESTAMPTZ NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Indexes:
- unique on `signup_status_token`
- index on `provisioning_request_id`

### 8. billable_student_periods

Purpose:
- durable per-period record of which students counted toward billing

Recommended columns:
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `customer_subscription_id TEXT NOT NULL REFERENCES customer_subscriptions(id) ON DELETE CASCADE`
- `tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
- `billing_period_start TIMESTAMPTZ NOT NULL`
- `billing_period_end TIMESTAMPTZ NOT NULL`
- `student_id TEXT NOT NULL`
- `first_reason TEXT NOT NULL`
- `counted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Recommended indexes:
- unique on `(customer_subscription_id, billing_period_start, billing_period_end, student_id)`
- index on `(tenant_id, billing_period_start, billing_period_end)`

### 9. billable_student_events

Purpose:
- auditable trail of why a student became billable

Recommended columns:
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `customer_subscription_id TEXT NOT NULL REFERENCES customer_subscriptions(id) ON DELETE CASCADE`
- `tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
- `student_id TEXT NOT NULL`
- `billing_period_start TIMESTAMPTZ NOT NULL`
- `billing_period_end TIMESTAMPTZ NOT NULL`
- `event_type TEXT NOT NULL`
- `event_source TEXT NOT NULL`
- `source_record_id TEXT NULL`
- `payload_json JSONB NOT NULL DEFAULT '{}'::jsonb`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Recommended event types:
- `current_year_enrollment`
- `attendance_write`
- `grade_write`

### 10. cancellation_export_requests

Purpose:
- paid offboarding/export request tracking

Recommended columns:
- `id TEXT PRIMARY KEY`
- `customer_account_id TEXT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE`
- `customer_subscription_id TEXT NOT NULL REFERENCES customer_subscriptions(id) ON DELETE CASCADE`
- `status TEXT NOT NULL CHECK (status IN ('pending_payment', 'paid', 'queued', 'processing', 'ready', 'failed', 'expired'))`
- `price_cents INTEGER NOT NULL`
- `currency TEXT NOT NULL DEFAULT 'usd'`
- `requested_by_email TEXT NULL`
- `payment_reference TEXT NULL`
- `export_job_id TEXT NULL REFERENCES provisioning_jobs(id) ON DELETE SET NULL`
- `artifact_path TEXT NULL`
- `artifact_expires_at TIMESTAMPTZ NULL`
- `failure_reason TEXT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

## Migration Strategy

Recommended first migration:

- add `004_commercial_saas_tables.sql` under `control-api/migrations/postgres/`

Migration contents:

1. create the seven commercial tables above
2. add indexes and uniqueness constraints
3. seed initial public plans only if explicitly desired

Recommendation:

- keep plan seeding in a script or separate seed step rather than auto-seeding inside the migration unless the initial plan list is considered stable enough

## API Contract

### Base Placement

Recommended first-release route group in `control-api`:

- public routes under `/api/public/...`
- Stripe webhook route under `/api/public/billing/webhook`

## Public Endpoints

### 1. `GET /api/public/plans`

Purpose:
- return public active plans for the landing page and checkout entry

Response shape:

```json
{
  "plans": [
    {
      "id": "plan-starter-monthly",
      "code": "starter_monthly",
      "name": "Starter",
      "description": "Hosted access for a family using the full platform.",
      "billingInterval": "month",
      "priceCents": 1900,
      "currency": "usd",
      "featureSummary": [
        "Hosted scheduling and curriculum tools",
        "Attendance, grades, and reports",
        "Standard automated provisioning"
      ],
      "limits": {}
    }
  ]
}
```

Acceptance:
- returns only `is_public = true` and `is_active = true` plans
- returns plans already sorted for UI display

### 2. `POST /api/public/checkout/session`

Purpose:
- create or update the commercial account and return a Stripe Checkout session URL

Request shape:

```json
{
  "planCode": "growth_monthly",
  "accountName": "Mitchell Learning Group",
  "requestedSubdomainLabel": "mitchell-school",
  "ownerFirstName": "Randal",
  "ownerLastName": "Mitchell",
  "ownerEmail": "owner@example.com",
  "ownerPhone": "555-555-5555",
  "billingEmail": "billing@example.com"
}
```

Backend behavior:

1. validate public active plan
2. normalize and validate requested subdomain label if included
3. create or update `customer_accounts`
4. create `customer_subscriptions` in `incomplete` or pending state if needed
5. create `checkout_sessions` row
6. create Stripe Checkout session using the plan's `stripe_price_id`
7. return redirect payload

Response shape:

```json
{
  "checkoutSessionId": "cs_test_123",
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_123",
  "successToken": "signup-status-token",
  "customerAccountId": "acct-123"
}
```

### 3. `POST /api/public/billing/webhook`

Purpose:
- receive Stripe webhook events

Requirements:
- raw request body preserved for signature verification
- verify signature with Stripe webhook secret
- persist every event idempotently into `billing_events`
- update commercial records based on event type
- create provisioning request exactly once when the subscription becomes provisionable

Minimum handled events:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Response:
- `200 OK` after successful receipt/processing
- never create duplicate provisioning requests for duplicate event delivery

### 4. `GET /api/public/signup-status/:token`

Purpose:
- customer-facing provisioning status page data

Response shape:

```json
{
  "accountName": "Mitchell Learning Group",
  "subscriptionStatus": "active",
  "provisioningStatus": "awaiting_customer_setup",
  "tenantUrl": "https://mitchell.school.example.com",
  "adminSetupMode": "setup_token",
  "setupTokenExpiresAt": "2026-04-03T12:00:00Z",
  "message": "Your workspace is ready. Complete first-time setup to continue."
}
```

Rules:
- token must reveal only the minimum customer-safe information needed for onboarding
- do not expose raw Stripe ids, internal job payloads, or internal infrastructure details

### 5. `GET /api/public/checkout/session/:token`

Optional but recommended:
- used for redirect reconciliation and customer-safe status recovery

Purpose:
- allow the post-checkout success page to fetch the latest known state even before webhook completion finishes

## Internal/Operator-Adjacent Endpoints

Not required for the first public release, but recommended soon after:

### `GET /api/control/customers`
- list customer accounts with plan and subscription state

### `GET /api/control/customers/:id`
- customer detail including linked tenant/environment/job records

### `GET /api/control/subscriptions/:id`
- subscription detail and billing-event summary

These can remain future-facing until the first public subscription path works.

## Stripe Integration Mapping

### Plan Mapping

Each public plan must map to exactly one Stripe Price for the first release.

Store:
- `stripe_product_id`
- `stripe_price_id`

### Checkout Session Metadata

Recommended Stripe metadata:
- `customerAccountId`
- `commercialPlanId`
- `requestedSubdomainLabel`
- `source = public_saas_checkout`

### Subscription Metadata

Recommended Stripe subscription metadata:
- `customerAccountId`
- `commercialPlanCode`

## Provisioning Handoff Contract

### Trigger Rule

Create a provisioning request only when subscription state is provisionable.

Recommended first implementation:

- treat `checkout.session.completed` as a signal to reconcile
- only create provisioning request once a valid active or approved trialing subscription state is confirmed

### Handoff Steps

1. create `provisioning_requests` row if one does not already exist for the subscription
2. create control-plane tenant if not already linked
3. create primary domain and environment
4. queue `provision_environment` job
5. update `provisioning_requests` with `tenant_id`, `tenant_environment_id`, and `provisioning_job_id`
6. create `access_handoffs` row with customer-safe signup status token

### Suggested Mapping To Existing Control Model

`customer_accounts.account_slug` -> `tenants.slug`

`customer_accounts.account_name` -> `tenants.display_name`

`owner_first_name` + `owner_last_name` + `owner_email` -> initial tenant contact fields and provisioning payload notes

`requested_subdomain_label` -> `tenant_domains.domain`

`customer_subscriptions.commercial_plan_id` -> `tenants.plan_code` via stable plan-code mapping

### Important Rule

The first commercial implementation may create one primary environment automatically, likely:

- `environment_key = production`
- `display_name = Production`

This should be automatic for self-serve signup unless later plan tiers justify multi-environment support.

## Signup Status Token Design

Recommended:

- opaque random token stored in `access_handoffs.signup_status_token`
- token used only for customer-facing signup/provisioning status
- token separate from Stripe session ids and separate from control-plane ids

## Error And Retry Model

### Checkout Creation Errors

Examples:
- invalid plan code
- inactive plan
- duplicate or invalid requested subdomain
- Stripe API failure

Behavior:
- return customer-safe validation message
- do not create partial provisioning request

### Webhook Processing Errors

Behavior:
- persist event to `billing_events`
- mark `processing_status = failed`
- store error text
- allow safe replay path later

### Provisioning Failures

Behavior:
- `provisioning_requests.status = failed`
- keep `customer_subscriptions.status` accurate to billing state
- do not silently cancel paid subscriptions because a provisioning step failed
- surface a customer-safe status message and operator-side retry path

## Environment Variables

Recommended additions to `control-api/.env`:

- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PUBLIC_APP_BASE_URL`
- `PUBLIC_SIGNUP_STATUS_BASE_URL`
- `PUBLIC_DEFAULT_DOMAIN_SUFFIX`
- `PUBLIC_CHECKOUT_SUCCESS_URL`
- `PUBLIC_CHECKOUT_CANCEL_URL`

Meaning:

- `PUBLIC_APP_BASE_URL`
  - public marketing-site origin such as `https://example.com`
- `PUBLIC_SIGNUP_STATUS_BASE_URL`
  - base URL for signup status page if separate
- `PUBLIC_DEFAULT_DOMAIN_SUFFIX`
  - suffix for generated hosted tenant domains such as `school.example.com`
- `PUBLIC_CHECKOUT_SUCCESS_URL`
  - Stripe Checkout success return URL template
- `PUBLIC_CHECKOUT_CANCEL_URL`
  - Stripe Checkout cancel return URL template

## Suggested Module Layout

Recommended first implementation in `control-api/src/`:

- `routes/public-saas-routes.js`
- `services/commercial-service.js`
- `services/stripe-service.js`
- `services/provisioning-handoff-service.js`
- repository functions added to `postgres-operator-store.js` first, or extracted into a new `postgres-commercial-store.js`

Recommendation:

- add `postgres-commercial-store.js` to keep commercial storage logic from inflating the already-large operator store further

## Acceptance Criteria

### Schema

- commercial tables exist and migrate cleanly in the control-plane database
- commercial records can link to control-plane tenant/environment/job records without circular ambiguity

### API

- landing page can fetch public plans from one endpoint
- checkout session endpoint can create a Stripe Checkout session with validated plan and owner data
- webhook endpoint verifies Stripe signatures and persists events idempotently
- signup-status endpoint can show customer-safe provisioning and access state

### Provisioning

- successful provisionable subscription creates exactly one provisioning request
- provisioning request links to created tenant/environment/job records
- duplicate webhook delivery does not create duplicate tenants or jobs

## Recommended Next Build Order

1. create the commercial migration file
2. implement public plan read endpoint
3. implement Stripe service wrapper and checkout session creation
4. implement webhook intake with raw-body signature verification
5. implement provisioning handoff service
6. implement signup-status endpoint
7. wire the SaaS landing-page CTA to the checkout-session endpoint

## Open Decisions Still Remaining

1. final plan list and price points
2. whether to support annual billing at launch
3. whether requested subdomain is customer-entered during checkout or assigned later
4. setup-token vs admin-invite onboarding
5. whether to expose `/saas.html` as the default homepage or keep it as a separate path during rollout
