# Session Handoff

Date: 2026-05-15

## Context

Public-site polish has been promoted to `www.navigrader.com`. The next phase moves back to product/platform priorities: authenticated release gates, Account Profile upgrade wiring, Dormant Mode, Data Export, backend hardening, tenant/runtime correctness, and deeper workflow QA.

## Current State

- Public SaaS closing-card blend correction is live in production and committed as `6fd203e Blend public closing cards`.
- Public page cache key:
  - `saas-polish.css?v=202605151220`
- Latest public WEB001 rollback snapshot:
  - `/var/www/home-school-management/rollback/web-202605151220.tgz`
- Public footer includes `support@navigrader.com`, `www.navigrader.com`, and `Copyright 2026, Navigrader, LLC. All rights reserved.`
- Public CTA/footer are visually blended, use the restored screenshot collage, and no longer include scenic/lighthouse graphics.
- Account Options copy polish is live and removes internal terms around tenant lifecycle/runtime/offboarding.
- Account Profile, Account Options, upgrade, dormant, and export UI surfaces exist, but commercial flows are not end-to-end complete.
- Dormant currently records `pending_dormant`/`dormant`, can queue suspend/resume jobs, and blocks attendance/grade writes while dormant.
- Dormant still needs reduced Stripe recurring pricing, billing-boundary processing, full reactivation billing restore, and broader write-block validation.
- Data Export currently records a `$19.99` `pending_payment` request, but checkout/payment, export job, secure artifact, download, expiration, and retry handling remain incomplete.
- Detailed dormant/export plan:
  - `NOTES/dormant-data-export-end-to-end-plan.md`
- Detailed next-efforts plan:
  - `NOTES/product-platform-next-efforts-plan.md`

## Next Action

1. Set production-safe smoke credentials outside the repo:
   - `HSM_HOSTED_SMOKE_USERNAME`
   - `HSM_HOSTED_SMOKE_PASSWORD`
   - `HSM_CONTROL_SMOKE_USERNAME`
   - `HSM_CONTROL_SMOKE_PASSWORD`
2. Run:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\Test-HostedSmoke.ps1 -BaseUrl https://mitchell.navigrader.com
   powershell -ExecutionPolicy Bypass -File .\scripts\Invoke-HostedReleaseGate.ps1 -PublicBaseUrl https://mitchell.navigrader.com
   ```
3. Start implementation with Account Profile upgrade:
   ```powershell
   rg -n "subscription/upgrade|upgradeHostedSubscription|upgrade|stripe.*subscription|customer.subscription.updated" web server control-api
   ```
4. Then continue Dormant Mode and Data Export from `NOTES/product-platform-next-efforts-plan.md`.

## Risks

- Authenticated hosted smoke is blocked until valid production-safe credentials exist.
- Do not use real family data for mutating QA.
- Do not store smoke credentials or Stripe secrets in repo files.
- Dormant/Data Export/Upgrade should not be described as complete until Stripe, webhook, backend state, UI, and QA gates are fully wired.
- Untracked scratch screenshots/icons and `tmp/` remain local and intentionally outside commits.

## Validation

- Public `https://www.navigrader.com/` returned HTTP 200 and includes the expected cache key, no scenic mark, footer logo, contact email, and copyright.
- Public `https://www.navigrader.com/saas-polish.css?v=202605151220` returned HTTP 200 and includes connected CTA/footer card styling with no line-pattern graphic.
- Remote WEB001 hashes matched local `web/saas.html` and `web/saas-polish.css`.
- WEB001 Apache config syntax OK and Apache service active.
- Public health returned `{"ok":true}` for `https://mitchell.navigrader.com/health`.
- Authenticated hosted smoke was not run because production smoke credentials are not set in this shell.
