# Current Status

Date: 2026-05-17

## Active Workstream

Product/platform priorities on `saas-modern-redesign`.

## Current Focus

Data Export first slice is deployed with a parent-readable CSV ZIP package, friendly browser download filename, and branded Stripe return page.

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
- Public-site polish remains deployed and committed as `6fd203e Blend public closing cards`.

## Production State

- Public SaaS page:
  - `saas-polish.css?v=202605151220`
  - Latest WEB001 rollback snapshot:
    `/var/www/home-school-management/rollback/web-202605151220.tgz`
- Tenant app assets:
  - `styles.css?v=202605150913`
  - `app.js?v=202605172014`
  - Latest WEB001 rollback snapshot:
    `/var/www/home-school-management/rollback/web-data-export-return-page-202605172014.tgz`
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

## Current Blockers

- Optional control-plane release gate requires production-safe control credentials.

## Current Risks

- Do not store smoke credentials or Stripe secrets in repo files.
- Use a smoke/test tenant, not a real family account, for mutating validation.
- Data Export first slice ships CSV ZIP artifacts; encryption, cleanup workers, and richer export UX remain future hardening.
- Untracked local scratch assets remain outside committed work.

## Next Actions

1. Have user QA a fresh Data Export Stripe return and confirm the branded success page plus Account Profile link.
2. Resume with backend/platform hardening or tenant/runtime correctness.
