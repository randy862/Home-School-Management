# Current Status

Date: 2026-05-18

## Active Workstream

Product/platform priorities on `saas-modern-redesign`.

## Current Focus

Legal acceptance for SaaS signup is deployed after subscriber cancellation and Data Export.

## Completed Recently

- Production-safe hosted smoke credentials were set outside the repo.
- Hosted release gate passed for `https://mitchell.navigrader.com`.
- Checkout-provisioned `smoketest.navigrader.com` is ready and Stripe-linked.
- Account Profile upgrade webhook reconciliation is deployed.
- Stripe billing webhook endpoint now includes subscription created/updated/deleted events.
- `smoketest.navigrader.com` upgraded from Starter to Growth and remains active.
- Committed `9147a2c Complete account upgrade webhook reconciliation`.
- Post-commit hosted release gate passed for `https://mitchell.navigrader.com`.
- Dormant Mode is deployed; smoke UI dormant/reactivation, write-blocking, final control DB, and final Stripe checks passed.
- Committed `57150b0 Complete dormant mode billing flow`.
- Data Export first slice deployed and live-QA passed: Stripe Checkout request, webhook queueing, CSV ZIP artifact generation, secure admin download, and expiration handling.
- Committed and pushed `ca5fa2d Complete customer data export package`.
- Friendly Data Export browser filenames are deployed; stored artifacts still keep unique internal UUID paths.
- Committed and pushed `4d71709 Polish data export download filenames`.
- Stripe Data Export checkout now returns to a branded status page with Account Profile download instructions and a deep-link back into View Account.
- Committed and pushed `ad9103c Add data export checkout return page`.
- Subscriber cancellation is deployed: Account Options schedules Stripe period-end cancellation and can reverse it with Keep Subscription Active.
- Subscriber cancellation status fix is deployed: tenant account summary now returns `cancelAtPeriodEnd` for Account/Profile UI.
- User verified Cancel Subscription and Keep Subscription Active on `smoketest.navigrader.com`.
- Legal acceptance is deployed: public `/terms` and `/privacy`, required signup checkbox, recurring billing disclosure, Stripe terms consent, `legal_acceptances` audit records, and authenticated legal links.
- Post-deploy hosted release gate passed for `https://mitchell.navigrader.com`, including public legal page checks.
- Public-site polish remains deployed and committed as `6fd203e Blend public closing cards`.

## Production State

- Public SaaS page:
  - `saas.css?v=202605182130`
  - `saas-polish.css?v=202605182130`
  - `saas.js?v=202605182130`
  - Latest WEB001 rollback snapshot:
    `/var/www/home-school-management/rollback/web-legal-acceptance-202605182130.tgz`
- Tenant app assets:
  - `styles.css?v=202605182130`
  - `app.js?v=202605182130`
  - Latest WEB001 rollback snapshot:
    `/var/www/home-school-management/rollback/web-legal-acceptance-202605182130.tgz`
- Control API rollback snapshot:
  - `/home/debian/rollback/hsm/control-api-upgrade-webhook-20260517031559/control-api`
- Dormant deployment rollback snapshot:
  - `/home/debian/rollback/hsm/dormant-mode-20260516230817`
- Dormant metadata-fix rollback snapshot:
  - `/home/debian/rollback/hsm/dormant-mode-metadata-fix-20260516231532`
- Data Export rollback snapshots:
  - APP001 `/home/debian/rollback/hsm/data-export-20260516234316`
  - APP001 path fix `/home/debian/rollback/hsm/data-export-path-fix-20260517000217`
  - APP001 CSV package `/home/debian/rollback/hsm/data-export-csv-package-20260517001730`
  - APP001 friendly filename route `/home/debian/rollback/hsm/data-export-friendly-filename-20260517200847`
  - APP001 export return page route `/home/debian/rollback/hsm/data-export-return-page-202605172014`
  - WEB001 `/var/www/home-school-management/rollback/web-data-export-20260516234316.tgz`
  - WEB001 export return page `/var/www/home-school-management/rollback/web-data-export-return-page-202605172014.tgz`
- Subscriber cancellation rollback snapshots:
  - APP001 `/home/debian/rollback/hsm/subscription-cancel-202605181939`
  - WEB001 `/var/www/home-school-management/rollback/web-subscription-cancel-202605181939.tgz`
  - APP001 status fix `/home/debian/rollback/hsm/subscription-cancel-status-fix-20260518195943`
  - WEB001 status fix `/var/www/home-school-management/rollback/web-subscription-cancel-status-fix-20260518195943.tgz`
- Legal acceptance rollback snapshots:
  - APP001 `/home/debian/rollback/hsm/legal-acceptance-202605182130/control-api`
  - WEB001 `/var/www/home-school-management/rollback/web-legal-acceptance-202605182130.tgz`

## Validation

- Hosted smoke/release gate passed before Data Export slice.
- Account Upgrade syntax/stub validation passed.
- APP001 deployed control-api syntax checks passed and services restarted healthy.
- Stripe webhook endpoint `https://www.navigrader.com/control-api/api/public/billing/webhook` now enables `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, and `invoice.payment_failed`.
- Account Upgrade and Dormant Mode live QA passed.
- Data Export syntax checks and checkout/webhook/download stubs passed.
- Data Export live QA passed on `smoketest.navigrader.com`: paid checkout, webhook job, ready state, JSON download, then CSV ZIP regeneration.
- APP001/WEB001 Data Export slice deployed; public health passed.
- Friendly filename route local/remote syntax checks passed; APP001 control API and public control API health passed after restart.
- Branded Data Export return page local syntax checks passed; APP001 tenant API route syntax and health passed; static page and app deep-link served over HTTPS.
- Subscriber cancellation local and APP001 syntax checks passed; `hsm-control-api` and `hsm-api` restarted healthy; public control/tenant health passed; WEB001 served app `202605181939`.
- Live control DB confirmed `smoketest` has `cancel_at_period_end=true`; status fix deployed and services restarted healthy.
- Legal acceptance syntax checks, mocked checkout validation, mocked Stripe consent encoding, APP001 migration/restart, public legal pages, signup content, app legal links, control health, and tenant health passed.
- Full hosted release gate passed after legal acceptance deploy.

## Current Blockers

- Optional control-plane release gate requires production-safe control credentials.

## Current Risks

- Do not store smoke credentials or Stripe secrets in repo files.
- Use a smoke/test tenant, not a real family account, for mutating validation.
- Data Export first slice ships CSV ZIP artifacts; encryption, cleanup workers, and richer export UX remain future hardening.
- Untracked local scratch assets remain outside committed work.

## Next Actions

1. Resume with backend/platform hardening, tenant/runtime correctness, or deeper workflow QA from real usage.
