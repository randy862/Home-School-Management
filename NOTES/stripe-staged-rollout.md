# Stripe Staged Rollout

Date: 2026-04-17

## Purpose

Provide one concrete checklist for the first staged Stripe rollout on `https://navigrader.com` without relying on chat history.

## Scope

This rollout is for the first live staged validation of:

- public plan loading
- Stripe Checkout session creation
- Stripe webhook signature verification
- webhook-confirmed provisioning handoff

This rollout does **not** complete every later billing feature. Dormant billing changes and paid cancellation export remain later slices.

## Current Internal Plan Mapping

- `starter_monthly` -> `Starter`
- `growth_monthly` -> `Extra Credit`
- `large_monthly` -> `Valedictorian`

These internal codes must remain the keys used when loading Stripe `price_...` IDs into `commercial_plans`.

Current Valedictorian target pricing is `$15.99/month`, `11` included billable students, and `$0.99` per billable student above `11`. Because Stripe prices are immutable, `large_monthly` must be mapped to a newly-created `$15.99` recurring monthly Stripe base price before the live database plan record is reconciled.

## Step 1. Deploy Repo Updates

Deploy the current repo changes to staging before loading Stripe secrets:

- `control-api/src/postgres-commercial-store.js`
- `control-api/src/services/commercial-webhook-service.js`
- `control-api/src/app.js`
- `web/saas.js`
- `web/saas.html`

If the billing-policy migration file is used to reconcile plan names in the staged database, also deploy:

- `control-api/migrations/postgres/005_subscription_billing_policy.sql`

## Step 2. Load APP001 Environment Variables

The `control-api` runtime on `APP001` needs:

```env
STRIPE_PUBLISHABLE_KEY=pk_test_REPLACE_ME
STRIPE_SECRET_KEY=sk_test_REPLACE_ME
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_ME
PUBLIC_APP_BASE_URL=https://navigrader.com
PUBLIC_SIGNUP_STATUS_BASE_URL=https://navigrader.com
PUBLIC_CHECKOUT_SUCCESS_URL=https://navigrader.com/signup-status.html?checkout=success
PUBLIC_CHECKOUT_CANCEL_URL=https://navigrader.com/signup-status.html?checkout=cancel
PUBLIC_DEFAULT_DOMAIN_SUFFIX=navigrader.com
```

After editing the runtime environment, restart:

- `sudo systemctl restart hsm-control-api.service`

Then verify:

- `https://navigrader.com/control-api/health`

## Step 3. Map Stripe Price IDs In PostgreSQL

Update the staged control-plane database so the live public plans return Stripe-backed `price_...` IDs.

```sql
UPDATE commercial_plans
SET stripe_price_id = 'price_REPLACE_STARTER'
WHERE code = 'starter_monthly';

UPDATE commercial_plans
SET stripe_price_id = 'price_REPLACE_EXTRA_CREDIT'
WHERE code = 'growth_monthly';

UPDATE commercial_plans
SET stripe_price_id = 'price_REPLACE_VALEDICTORIAN'
WHERE code = 'large_monthly';
```

Optional verification query:

```sql
SELECT code, name, stripe_price_id
FROM commercial_plans
WHERE code IN ('starter_monthly', 'growth_monthly', 'large_monthly')
ORDER BY sort_order;
```

## Step 4. Stripe Webhook Endpoint

Create or update the Stripe webhook endpoint to:

- `https://navigrader.com/control-api/api/public/billing/webhook`

The first staged event coverage should include:

- `checkout.session.completed`
- `invoice.payment_failed`

The signing secret from this endpoint must match `STRIPE_WEBHOOK_SECRET` on `APP001`.

## Step 5. Run The First Live Test

Use:

- `https://navigrader.com/saas.html`

Expected staged flow:

1. public plans load from `GET /control-api/api/public/plans`
2. checkout form posts to `POST /control-api/api/public/checkout/session`
3. browser redirects to Stripe Checkout
4. successful Stripe event hits the webhook endpoint
5. signup status page shows billing-confirmed or provisioning progress

Recommended validation points after a successful test:

- `https://navigrader.com/control-api/health` returns `200`
- the created checkout row is marked `completed`
- the created subscription row is `active`
- a provisioning request exists for the subscription
- the signup-status page resolves with the returned token

## Later Slices

Not blockers for the first staged Stripe validation:

- dormant billing transitions at period boundary
- Stripe-side dormant price handling
- paid cancellation export checkout path
- wildcard DNS/TLS validation for customer tenant domains such as `mitchell.navigrader.com`
