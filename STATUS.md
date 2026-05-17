# Current Status

Date: 2026-05-17

## Active Workstream

Product/platform priorities on `saas-modern-redesign`.

## Current Focus

Dormant Mode backend implementation is deployed; smoke UI dormant/reactivation passed after one metadata fix.

## Completed Recently

- Production-safe hosted smoke credentials were set outside the repo.
- Hosted smoke passed for `https://mitchell.navigrader.com`.
- Hosted release gate passed after APP001 SSH host key was verified and refreshed locally.
- New checkout-provisioned `smoketest.navigrader.com` tenant provisioning was retried successfully after fixing WEB001 host trust for `hsm-control-api`.
- Account Profile upgrade path was traced through UI, tenant API, control API, Stripe service, and billing webhook.
- Deployed control-api patch adds Stripe subscription webhook plan/pricing reconciliation for Account Profile upgrades.
- Stripe billing webhook endpoint now includes subscription created/updated/deleted events.
- `smoketest.navigrader.com` upgraded from Starter to Growth and remains active.
- Committed `9147a2c Complete account upgrade webhook reconciliation`.
- Post-commit hosted release gate passed for `https://mitchell.navigrader.com`.
- Dormant Mode patch adds reduced Stripe recurring pricing, reactivation price restore, billing-boundary suspend handling, and broad tenant write-blocking.
- Dormant Mode backend files are deployed to APP001.
- Fixed/deployed Dormant metadata typo found by smoke UI QA before any Stripe mutation occurred.
- Smoke UI QA marked `smoketest.navigrader.com` dormant, displayed Site Dormant, reactivated, and displayed active.
- Dormant write-block QA passed in the smoke tenant.
- Final control DB verification shows smoke tenant active on `growth_monthly`, subscription active, dormant status active, base price `1499`.
- Final Stripe verification shows smoke subscription active on Growth price `1499`, `dormantStatus=active`, `dormantBilling=false`.
- Public-site polish remains deployed and committed as `6fd203e Blend public closing cards`.

## Production State

- Public SaaS page:
  - `saas-polish.css?v=202605151220`
  - Latest WEB001 rollback snapshot:
    `/var/www/home-school-management/rollback/web-202605151220.tgz`
- Tenant app assets:
  - `styles.css?v=202605150913`
  - `app.js?v=202605150933`
  - Latest WEB001 rollback snapshot:
    `/var/www/home-school-management/rollback/web-202605150933.tgz`
- Control API rollback snapshot:
  - `/home/debian/rollback/hsm/control-api-upgrade-webhook-20260517031559/control-api`
- Dormant deployment rollback snapshot:
  - `/home/debian/rollback/hsm/dormant-mode-20260516230817`
- Dormant metadata-fix rollback snapshot:
  - `/home/debian/rollback/hsm/dormant-mode-metadata-fix-20260516231532`

## Validation

- `powershell -ExecutionPolicy Bypass -File .\scripts\Test-HostedSmoke.ps1 -BaseUrl https://mitchell.navigrader.com`
- `powershell -ExecutionPolicy Bypass -File .\scripts\Invoke-HostedReleaseGate.ps1 -PublicBaseUrl https://mitchell.navigrader.com`
- `node --check control-api/src/app.js`
- `node --check control-api/src/services/commercial-webhook-service.js`
- `node --check control-api/src/postgres-commercial-store.js`
- Stubbed `processStripeBillingEvent` upgrade reconciliation check passed.
- `git diff --check -- control-api/src/app.js control-api/src/services/commercial-webhook-service.js control-api/src/postgres-commercial-store.js`
- `https://smoketest.navigrader.com/health` returned HTTP 200 with `{"ok":true}`.
- APP001 deployed control-api syntax checks passed and `hsm-control-api.service` restarted healthy.
- `https://mitchell.navigrader.com/control-api/health` returned HTTP 200.
- Stripe webhook endpoint `https://www.navigrader.com/control-api/api/public/billing/webhook` now enables `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, and `invoice.payment_failed`.
- Real `customer.subscription.updated` webhook processed successfully for the smoke subscription after a metadata-only validation update.
- Control DB shows `smoketest.navigrader.com` on `growth_monthly`, `$14.99/month`, 10 included billable students.
- Post-commit `Invoke-HostedReleaseGate.ps1 -PublicBaseUrl https://mitchell.navigrader.com` passed.
- `node --check` passed for touched dormant control-api/server files.
- Stubbed `processStripeBillingEvent` dormant billing-boundary check passed.
- APP001 `hsm-control-api.service` and `hsm-api.service` are active after Dormant deploy.
- Public health passed for `mitchell`, `smoketest`, and `www` control API.
- Internal dormant route metadata stub passed after fixing `dormantBasePriceCents`.
- APP001 control API restarted active and health passed after dormant metadata fix.
- Post-fix logs showed no new control-api/api errors after successful dormant/reactivation UI test.
- Dormant write-block QA passed in the smoke tenant.
- Final control DB verification passed for smoke tenant active/restored pricing.
- Final Stripe verification passed for smoke subscription active/restored pricing.

## Current Blockers

- Optional control-plane release gate requires production-safe control credentials.
- Dormant Mode is ready to commit.
- Data Export flow is not end-to-end complete.

## Current Risks

- Do not claim Dormant Mode or Data Export complete until Stripe billing, backend state transitions, UI states, and QA gates are finished.
- Do not store smoke credentials or Stripe secrets in repo files.
- Use a smoke/test tenant, not a real family account, for mutating validation.
- Untracked local scratch assets remain outside committed work.

## Next Actions

1. Commit Dormant Mode.
2. Continue Data Export checkout/job/download/expiration work.
