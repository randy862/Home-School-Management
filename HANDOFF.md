# Session Handoff

Date: 2026-05-17

## Context

Product/platform follow-up is active after public-site polish. Focus is authenticated release gates, Account Profile upgrade, Dormant Mode, Data Export, backend hardening, tenant/runtime correctness, and workflow QA.

## Current State

- Production-safe hosted smoke credentials exist outside the repo and authenticate as `smoketest`.
- Hosted release gate succeeded for `https://mitchell.navigrader.com`.
- New checkout-provisioned `smoketest.navigrader.com` tenant provisioning succeeded after retrying failed job `job-d04f8ea3-2f10-4a92-9338-c945fc83ff60` as `job-3a148ffb-a1e3-4b0f-a750-aa336e33c8df`.
- Smoke tenant runtime is ready with schema `tenant_smoketest`; public health returns HTTP 200.
- Account Profile upgrade webhook reconciliation is committed as `9147a2c` and deployed.
- Stripe billing webhook endpoint now enables subscription created/updated/deleted events.
- Control API rollback snapshot:
  - `/home/debian/rollback/hsm/control-api-upgrade-webhook-20260517031559/control-api`
- `smoketest.navigrader.com` upgraded from Starter to Growth and is active, Stripe-linked, and ready for later commercial QA.
- Dormant Mode backend work is deployed to APP001 but not yet live-tested through the UI:
  - dormant requests swap the Stripe base item to reduced recurring pricing
  - reactivation restores the configured plan price
  - Stripe subscription webhooks preserve dormant pricing and queue suspend at the billing boundary
  - tenant API mutations are broadly blocked while dormant/pending dormant except auth/setup/account flows
- Dormant deployment rollback snapshot:
  - `/home/debian/rollback/hsm/dormant-mode-20260516230817`
- Dormant UI QA initially hit `ReferenceError: dormantBasePriceCents is not defined`; fixed/deployed metadata key mapping.
- Dormant metadata-fix rollback snapshot:
  - `/home/debian/rollback/hsm/dormant-mode-metadata-fix-20260516231532`
- Smoke UI QA succeeded after the fix: `smoketest.navigrader.com` marked dormant/displayed Site Dormant, then reactivated/displayed active.
- Dormant write-block QA passed: while dormant, smoke tenant could not make academic/workspace changes.
- Final read-only control DB check shows `SmokeTest` active on `growth_monthly`, subscription active, dormant status active, base price `1499`.
- Final read-only Stripe check shows smoke subscription active on Growth price `1499`, `dormantStatus=active`, `dormantBilling=false`.
- Data Export still needs checkout/payment, export job, secure artifact, download, expiration, and retry handling.

## Next Action

1. Commit Dormant Mode.
2. Continue Data Export implementation.

## Risks

- Do not run mutating upgrade QA against real family data.
- Do not store smoke credentials or Stripe secrets in repo files.
- Dormant Mode should not be called complete until Stripe mutation, webhook reconciliation, backend state, UI refresh, write-blocking, reactivation, and release gate are validated.
- Optional control-plane release gate still requires production-safe control credentials.
- Untracked scratch screenshots/icons and `tmp/` remain local and intentionally outside commits.

## Validation

- `Test-HostedSmoke.ps1 -BaseUrl https://mitchell.navigrader.com` passed.
- `Invoke-HostedReleaseGate.ps1 -PublicBaseUrl https://mitchell.navigrader.com` passed.
- `node --check` passed for account-upgrade and dormant touched files.
- Stubbed `processStripeBillingEvent` upgrade reconciliation check passed.
- `git diff --check` passed for touched files.
- `https://smoketest.navigrader.com/health` returned HTTP 200 with `{"ok":true}`.
- APP001 deployed control-api syntax checks passed and `hsm-control-api.service` restarted healthy.
- `https://mitchell.navigrader.com/control-api/health` returned HTTP 200.
- Stripe endpoint now enables `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, and `invoice.payment_failed`.
- Real `customer.subscription.updated` webhook processed successfully for the smoke subscription after a metadata-only validation update.
- Control DB shows `smoketest.navigrader.com` on `growth_monthly`, `$14.99/month`, 10 included billable students.
- Stubbed Stripe dormant billing-boundary webhook check passed.
- APP001 `hsm-control-api.service` and `hsm-api.service` restarted active after Dormant deploy.
- Public health passed for `https://mitchell.navigrader.com/health`, `https://smoketest.navigrader.com/health`, and `https://www.navigrader.com/control-api/health`.
- Post-Dormant-deploy hosted release gate passed for `https://mitchell.navigrader.com`.
- Internal dormant route metadata stub passed after fixing `dormantBasePriceCents`.
- APP001 control API restarted active and health passed after dormant metadata fix.
- Post-fix logs showed no new control-api/api errors after the successful dormant/reactivation UI test.
- Dormant write-block QA passed in the smoke tenant.
- Final control DB verification passed for smoke tenant active/restored pricing.
- Final Stripe verification passed for smoke subscription active/restored pricing.
