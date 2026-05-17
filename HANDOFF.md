# Session Handoff

Date: 2026-05-17

## Context

Product/platform follow-up is active after public-site polish. Focus is authenticated release gates, Account Profile upgrade, Dormant Mode, Data Export, backend hardening, tenant/runtime correctness, and workflow QA.

## Current State

- Production-safe hosted smoke credentials exist outside the repo and authenticate as `smoketest`.
- Hosted release gate succeeded for `https://mitchell.navigrader.com`.
- Smoke tenant `smoketest.navigrader.com` is ready with schema `tenant_smoketest`.
- Account Profile upgrade webhook reconciliation is committed as `9147a2c` and deployed.
- Stripe billing webhook endpoint now enables subscription created/updated/deleted events.
- Control API rollback snapshot:
  - `/home/debian/rollback/hsm/control-api-upgrade-webhook-20260517031559/control-api`
- `smoketest.navigrader.com` is Growth, active, Stripe-linked, and ready for commercial QA.
- Dormant Mode is deployed, live-QA passed, write-blocking passed, final control DB/Stripe state restored active at Growth `1499`.
- Dormant Mode is committed as `57150b0 Complete dormant mode billing flow`.
- Data Export first slice is implemented, deployed, live-QA passed, and accepted:
  - Account Profile export request creates a one-time Stripe Checkout session
  - `checkout.session.completed` queues `archive_tenant_data`
  - archive job writes a parent-readable ZIP of CSV records and marks request ready
  - authenticated tenant admin download streams the ready artifact
  - expired artifacts return 410 and mark request expired
- Data Export rollback snapshots:
  - APP001 `/home/debian/rollback/hsm/data-export-20260516234316`
  - APP001 path fix `/home/debian/rollback/hsm/data-export-path-fix-20260517000217`
  - APP001 CSV package `/home/debian/rollback/hsm/data-export-csv-package-20260517001730`
  - WEB001 `/var/www/home-school-management/rollback/web-data-export-20260516234316.tgz`

## Next Action

1. Have user QA a CSV ZIP export from `mitchell.navigrader.com`.
2. Move to backend/platform hardening or tenant/runtime correctness.

## Risks

- Do not run mutating upgrade QA against real family data.
- Do not store smoke credentials or Stripe secrets in repo files.
- Optional control-plane release gate still requires production-safe control credentials.
- Data Export first slice ships CSV ZIP artifacts; encryption, cleanup workers, and richer export UX remain future hardening.
- Untracked scratch screenshots/icons and `tmp/` remain local and intentionally outside commits.

## Validation

- Account Upgrade and Dormant Mode smoke/release validations passed.
- Data Export syntax checks and checkout/webhook/download stubs passed.
- Data Export live QA passed on `smoketest.navigrader.com`: checkout, webhook job, ready state, JSON download, then CSV ZIP regeneration.
- APP001/WEB001 Data Export slice deployed; public health passed for `mitchell`, `smoketest`, and control API.
