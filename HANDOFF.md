# Session Handoff

Date: 2026-05-15

## Context

Public SaaS site polish on `saas-modern-redesign`, promoted to `www.navigrader.com`.

## Current State

- Public site update is live in production and committed as `8894a65 Refresh public site screenshots and footer`.
- `www.navigrader.com` bottom CTA now uses five refreshed UI polish screenshots.
- Public footer now includes `support@navigrader.com` and `Copyright 2026, Navigrader, LLC`.
- Public page cache key:
  - `saas-polish.css?v=202605151005`
- Latest public WEB001 rollback snapshot:
  `/var/www/home-school-management/rollback/web-202605151005.tgz`
- Detailed dormant/data export execution plan added:
  `NOTES/dormant-data-export-end-to-end-plan.md`
- Dormant current code records `pending_dormant`/`dormant`, can queue suspend/resume jobs, and blocks attendance/grade writes while dormant.
- Dormant does not yet update Stripe to a reduced recurring price, apply pending dormant at the billing boundary, or restore Stripe pricing on reactivation.
- Data Export current code records a `$19.99` `pending_payment` request, but checkout/payment, export job, artifact generation, secure download, expiration, and retry handling are not complete.
- Account Options copy polish is live in production and removes internal customer-facing terms around lifecycle/runtime/offboarding.
- Latest production code commit: `c042e07 Polish account options copy`.
- WEB001 has the latest web bundle deployed under `/var/www/home-school-management/web`.
- Live asset cache keys:
  - `styles.css?v=202605150913`
  - `app.js?v=202605150933`
- Latest WEB001 rollback snapshot:
  `/var/www/home-school-management/rollback/web-202605150933.tgz`
- Latest production changes:
  - Account Options copy now uses parent-facing language for Dormant Mode, Reactivation, and Data Export.
  - Dashboard, Dashboard Compliance, Grades, and Attendance tabs now use the flat underline tab style used by School Day.
  - Calendar, Administration, Curriculum, and Schedule setup/config tab styles were intentionally left unchanged.

## Next Action

1. If public site feedback arrives, review `web/saas.html` and `web/saas-polish.css`.
2. Otherwise resume from `NOTES/dormant-data-export-end-to-end-plan.md`.
3. Start dormant billing with control-plane migration and Stripe service methods.
4. Confirm reactivation billing policy: immediate invoice, proration, or next-invoice adjustment.

## Risks

- Dormant/Data Export backend flows are not end-to-end complete; continue from the execution plan before further lifecycle feature claims.
- Authenticated hosted smoke still needs valid production tenant credentials.
- Public production health passed, and live HTML references the expected cache keys.
- Untracked scratch screenshots/icons and `tmp/` remain local and intentionally outside commits.
- Browser cache may need a hard refresh to show current assets.

## Validation

- Public `https://www.navigrader.com/` returned HTTP 200 and includes the refreshed screenshots, contact email, copyright line, and new CSS cache key.
- New public screenshot assets each returned HTTP 200.
- Remote WEB001 hashes matched local `web/saas.html`, `web/saas-polish.css`, and the five new public screenshot assets.
- `node --check web/app.js`
- `git diff --check -- web/app.js web/index.html web/styles.css STATUS.md HANDOFF.md`
- Local Web Preview returned HTTP 200 at `http://127.0.0.1:5500/?seedPreview=1`
- PowerShell parser checks for hosted smoke and release-gate scripts
- Public health returned `{"ok":true}` for `https://mitchell.navigrader.com/health`
- WEB001 Apache config syntax OK and Apache service active
- Remote WEB001 hashes matched local `web/index.html` and `web/app.js`
- Live HTML references `styles.css?v=202605150913` and `app.js?v=202605150933`
- Authenticated hosted smoke was not run because `HSM_HOSTED_SMOKE_USERNAME` and `HSM_HOSTED_SMOKE_PASSWORD` are not set in this shell.
