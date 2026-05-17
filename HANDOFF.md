# Session Handoff

Date: 2026-05-17

## Context

Product/platform follow-up is active after public-site polish. Focus is authenticated release gates, Account Profile upgrade, Dormant Mode, Data Export, backend hardening, tenant/runtime correctness, and workflow QA.

## Current State

- Production-safe hosted smoke credentials exist outside the repo and authenticate as `smoketest`.
- Hosted release gate succeeded for `https://mitchell.navigrader.com`.
- APP001 SSH known-host mismatch was verified against APP001 console fingerprint and resolved locally.
- New checkout-provisioned `smoketest.navigrader.com` tenant provisioning succeeded after retrying failed job `job-d04f8ea3-2f10-4a92-9338-c945fc83ff60` as `job-3a148ffb-a1e3-4b0f-a750-aa336e33c8df`.
- Smoke tenant runtime is ready with schema `tenant_smoketest`; public health returns HTTP 200.
- Account Profile upgrade UI/API path already existed:
  - `web/app.js`
  - `server/src/routes/account-routes.js`
  - `control-api/src/routes/control-commercial-routes.js`
  - `control-api/src/services/stripe-service.js`
- Deployed backend patch improves upgrade webhook reconciliation:
  - `control-api/src/app.js`
  - `control-api/src/services/commercial-webhook-service.js`
  - `control-api/src/postgres-commercial-store.js`
- Patch makes `customer.subscription.created/updated` resolve the commercial plan from Stripe subscription metadata or item price and persist plan/pricing fields locally.
- Stripe billing webhook endpoint now enables subscription created/updated/deleted events.
- Account Profile upgrade reconciliation is committed as `9147a2c Complete account upgrade webhook reconciliation`.
- Post-commit hosted release gate passed for `https://mitchell.navigrader.com`.
- Control API rollback snapshot:
  - `/home/debian/rollback/hsm/control-api-upgrade-webhook-20260517031559/control-api`
- `smoketest.navigrader.com` upgraded from Starter to Growth and is active, Stripe-linked, and ready for later commercial QA.
- Dormant still needs reduced Stripe recurring pricing, billing-boundary processing, full reactivation billing restore, and broader write-block validation.
- Data Export still needs checkout/payment, export job, secure artifact, download, expiration, and retry handling.

## Next Action

1. Continue Dormant Mode and Data Export implementation.

## Risks

- Do not run mutating upgrade QA against real family data.
- Do not store smoke credentials or Stripe secrets in repo files.
- Account Profile upgrade should not be called complete until Stripe mutation, webhook reconciliation, backend state, UI refresh, and release gate are validated.
- Optional control-plane release gate still requires production-safe control credentials.
- Untracked scratch screenshots/icons and `tmp/` remain local and intentionally outside commits.

## Validation

- `Test-HostedSmoke.ps1 -BaseUrl https://mitchell.navigrader.com` passed.
- `Invoke-HostedReleaseGate.ps1 -PublicBaseUrl https://mitchell.navigrader.com` passed.
- `node --check control-api/src/app.js`
- `node --check control-api/src/services/commercial-webhook-service.js`
- `node --check control-api/src/postgres-commercial-store.js`
- Stubbed `processStripeBillingEvent` upgrade reconciliation check passed.
- `git diff --check -- control-api/src/app.js control-api/src/services/commercial-webhook-service.js control-api/src/postgres-commercial-store.js`
- `https://smoketest.navigrader.com/health` returned HTTP 200 with `{"ok":true}`.
- APP001 deployed control-api syntax checks passed and `hsm-control-api.service` restarted healthy.
- `https://mitchell.navigrader.com/control-api/health` returned HTTP 200.
- Stripe endpoint now enables `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, and `invoice.payment_failed`.
- Real `customer.subscription.updated` webhook processed successfully for the smoke subscription after a metadata-only validation update.
- Control DB shows `smoketest.navigrader.com` on `growth_monthly`, `$14.99/month`, 10 included billable students.
- Post-commit `Invoke-HostedReleaseGate.ps1 -PublicBaseUrl https://mitchell.navigrader.com` passed.
