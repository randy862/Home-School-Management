# Valedictorian Pricing Change Plan

Date: 2026-04-27
Owner: Product / Platform
Status: Repo-side implementation prepared; live Stripe and live database rollout still pending operator confirmation

## Target Change

Update the `Valedictorian` plan, internal code `large_monthly`, to:

- base price: `$15.99/month`
- included billable students: `11`
- overage: `$0.99` per billable student above `11`
- overage behavior remains automatic recurring usage via the existing overage subscription item model

The repo-side implementation has been prepared. Do not change live Stripe or live database pricing until the Stripe price ID rollout step is confirmed and executed.

## Current Known State

Prior repo policy and staged behavior described `Valedictorian` as:

- `$14.99/month`
- `10 included billable students`
- `$0.99` per billable student above `10`

Known references:

- clean-database seed policy in `control-api/migrations/postgres/005_subscription_billing_policy.sql`
- forward catalog migration in `control-api/migrations/postgres/008_valedictorian_pricing_update.sql`
- policy documentation in `NOTES/subscription-billing-policy.md`
- rollout documentation in `NOTES/stripe-staged-rollout.md`
- customer-facing plan API data rendered by `web/saas.js`
- tenant account/upgrade messaging rendered by `web/app.js`
- live control-plane commercial plan records in PostgreSQL table `commercial_plans`
- live customer subscription snapshots in PostgreSQL table `customer_subscriptions`
- live Stripe recurring base price for `large_monthly`
- live Stripe recurring overage price or dynamic overage price configuration

## Implementation Surfaces

### 1. Repo Policy Docs

Update documentation so future sessions do not reintroduce the old numbers:

- `NOTES/subscription-billing-policy.md`
  - change Large/Valedictorian base price from `$14.99` to `$15.99`
  - change included students from `10` to `11`
  - change overage text from `above 11` to `above 11`
  - update dormant examples because dormant is based on base subscription price
- `NOTES/stripe-staged-rollout.md`
  - add a note that `large_monthly` must map to the new `$15.99` Stripe recurring base price
  - keep overage price mapped to `$0.99` per billable student unless the Stripe overage price is recreated
- `NOTES/tenant-account-subscription-settings-spec-package.md`
  - update tenant-facing examples currently saying `10 included + automatic $0.99/student overage`
- `WORKPLAN.md`
  - update completed Valedictorian proof notes that currently cite `10 included` and `11 billable / 1 overage`

### 2. Seed / Migration Policy

Add a new forward migration instead of editing only history:

- create `control-api/migrations/postgres/008_valedictorian_pricing_update.sql` or the next available migration number
- update `commercial_plans` where `code = 'large_monthly'`
  - `price_cents = 1599`
  - `feature_summary_json` includes `11 included billable students`
  - `feature_summary_json` includes `$0.99 per billable student above 11`
  - `limits_json.includedBillableStudents = 11`
  - `limits_json.perStudentOverageCents = 99`
  - `limits_json.allowsOverage = true`
  - preserve `stripe_price_id` until the Stripe migration step assigns the new base price id
- also update `005_subscription_billing_policy.sql` so a clean database bootstraps with the new pricing

Suggested SQL shape:

```sql
UPDATE commercial_plans
SET
  description = 'Hosted access for larger schools with a monthly base plus per-student overage after eleven billable students, framed as the top scholastic tier.',
  price_cents = 1599,
  feature_summary_json = '["11 included billable students","$0.99 per billable student above 11","Attendance, grades, reports, and planning","Historical data preserved across school years"]'::jsonb,
  limits_json = jsonb_set(
    jsonb_set(
      jsonb_set(limits_json, '{includedBillableStudents}', '11'::jsonb, true),
      '{perStudentOverageCents}', '99'::jsonb, true
    ),
    '{allowsOverage}', 'true'::jsonb, true
  ),
  updated_at = NOW()
WHERE code = 'large_monthly';
```

### 3. Existing Subscription Records

Plan records affect newly loaded plan data, but existing subscriptions may store snapshots:

- `customer_subscriptions.base_price_cents`
- `customer_subscriptions.included_billable_students`
- current billable count and overage count
- Stripe subscription id and subscription items

Decide rollout policy before mutating existing subscriptions:

- **recommended for pre-production/test mode:** update all active `large_monthly` subscriptions to the new snapshot values
- **future production option:** preserve existing customers on legacy pricing until renewal or explicit grandfathering policy says otherwise

For current pre-production/test mode, use an auditable SQL update after Stripe is updated:

```sql
UPDATE customer_subscriptions sub
SET
  base_price_cents = 1599,
  included_billable_students = 11,
  updated_at = NOW()
FROM commercial_plans plan
WHERE sub.plan_id = plan.id
  AND plan.code = 'large_monthly'
  AND sub.status IN ('trialing', 'active', 'past_due');
```

Then run the billable-student refresh/sync path for affected tenants so overage quantity recalculates from `max(0, currentBillableStudents - 11)`.

### 4. Stripe

Stripe prices are immutable for amount changes. Do not edit the old `$14.99` price in place.

Required Stripe steps:

1. Create a new recurring monthly Stripe Price for the Valedictorian base plan:
   - product: existing Valedictorian/Navigrader subscription product if appropriate
   - amount: `$15.99`
   - currency: `usd`
   - interval: `month`
   - nickname/references: `Valedictorian monthly - 11 included`
2. Keep or verify the overage price:
   - `$0.99`
   - recurring monthly
   - quantity should equal `max(0, billable students - 11)`
3. Update `commercial_plans.stripe_price_id` for `large_monthly` to the new `$15.99` base price id.
4. For existing test subscriptions that should move immediately:
   - update the base subscription item from the old `$14.99` price to the new `$15.99` price
   - choose proration behavior intentionally; for test mode, either `none` or Stripe default is acceptable if documented
   - run overage sync after updating the included count
5. Verify invoice preview for:
   - 11 billable students: `$15.99` base, `0` overage
   - 12 billable students: `$15.99` base + `$0.99` overage

### 5. Control API / Public Plan API

The public SaaS pricing cards load from `GET /control-api/api/public/plans`.

After the database migration:

- verify `large_monthly` returns:
  - `priceCents: 1599`
  - `limits.includedBillableStudents: 11`
  - `limits.perStudentOverageCents: 99`
  - feature summary text says `above 11`
- verify checkout creation still requires a configured `stripePriceId`
- verify in-app upgrade cards show `$15.99`, `11 included`, and `$0.99 per billable student`

Likely files to inspect if behavior needs code changes:

- `control-api/src/routes/public-saas-routes.js`
- `control-api/src/services/commercial-provisioning-service.js`
- `control-api/src/services/commercial-webhook-service.js`
- `control-api/src/postgres-commercial-store.js`
- `server/src/routes/account-routes.js`
- `server/src/services/commercial-policy-service.js`

### 6. Public SaaS Page Content

`web/saas.html` contains static plan radio labels, but pricing cards are populated dynamically by `web/saas.js` from the public plans API.

Tasks:

- verify no hardcoded Valedictorian price copy remains in `web/saas.html`
- verify `web/saas.js` renders the updated API plan values correctly
- if desired, change the checkout radio label from only `Valedictorian` to `Valedictorian - $15.99/mo + $0.99/student above 11`, but avoid duplicating dynamic pricing unless the label is also API-driven

### 7. Tenant App Account / Upgrade Messaging

The tenant app appears mostly API-driven, but confirm after migration:

- Account summary shows:
  - included billable students: `11`
  - current over plan uses `current - 11`
  - overage estimate uses `$0.99`
- Upgrade Subscription shows:
  - `Valedictorian`
  - `$15.99 / month`
  - `11 included billable students`
  - `$0.99 per billable student`

Likely file:

- `web/app.js`

### 8. Billing Enforcement

The enforcement rule must allow the 11th billable student on `Valedictorian` without overage, and begin overage on the 12th.

Verify:

- `server/src/services/commercial-policy-service.js`
  - `allowsOverage` still lets additions continue
  - overage count recalculates using the stored included count
- billable-student count refresh writes:
  - current count
  - overage count = `max(0, current - 11)`
- Stripe overage sync sends quantity:
  - 11 billable -> `0`, remove or zero overage item depending existing behavior
  - 12 billable -> `1`

### 9. Control Center

Control surfaces should be checked for plan display and subscription snapshot display.

Tasks:

- verify tenant detail billing area shows new plan price and included student count
- verify any plan list or subscription detail card uses `commercial_plans` / `customer_subscriptions` values instead of hardcoded text
- verify operator-facing subscription actions do not assume `10`

Likely files:

- control UI assets under `web/` if the control center is served from this repo's web/control assets
- `control-api/src/routes/control-commercial-routes.js`
- `control-api/src/routes/tenant-routes.js`
- `control-api/src/postgres-commercial-store.js`

### 10. Rollout Order

Recommended order:

1. Create the new Stripe `$15.99` recurring base price in test mode.
2. Add the repo migration and documentation updates.
3. Deploy `control-api` migration to APP001/SQL001.
4. Update `commercial_plans.stripe_price_id` for `large_monthly` to the new Stripe price id.
5. Update existing test subscriptions that should follow current pricing.
6. Refresh billable counts and sync overage quantities.
7. Deploy web assets if any copy changed.
8. Verify public SaaS pricing.
9. Verify checkout for new Valedictorian signup.
10. Verify tenant Account and Upgrade Subscription views.
11. Verify Stripe invoice preview for 11 and 12 billable students.
12. Commit/push all repo changes and record the Stripe price ids in a private operational note, not in public docs if they are environment-specific.

### 11. Test Matrix

Minimum staged checks:

- Public plans API:
  - `large_monthly.priceCents = 1599`
  - `large_monthly.limits.includedBillableStudents = 11`
- Public SaaS page:
  - pricing card displays `$15.99`
  - feature list displays `11 included`
  - overage text says `above 11`
- Checkout:
  - Valedictorian checkout session uses the new Stripe base price id
- Tenant billing:
  - 11 billable students shows no overage
  - 12 billable students shows one overage student
- Stripe:
  - subscription base item uses new `$15.99` price
  - overage item quantity is `0` at 11 and `1` at 12
- Control:
  - tenant/subscription detail reflects `$15.99`, `11 included`
- Regression:
  - Starter and Extra Credit plan behavior unchanged
  - non-Valedictorian subscriptions are not migrated accidentally

## Open Decisions

- Should existing production customers ever be grandfathered on the old `$14.99 / 10 included` plan, or should all active Valedictorian subscriptions move at the next billing period?
- Should the public checkout radio label become API-driven so static labels cannot drift from the pricing cards?
- Should plan price ids be managed through an operator UI/config table update flow instead of manual SQL?
