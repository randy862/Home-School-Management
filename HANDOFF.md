# Session Handoff

Date: 2026-05-15

## Context

Commercial subscription lifecycle planning on `saas-modern-redesign`, following Account Options copy review.

## Current State

- Detailed dormant/data export execution plan added:
  `NOTES/dormant-data-export-end-to-end-plan.md`
- Dormant current code records `pending_dormant`/`dormant`, can queue suspend/resume jobs, and blocks attendance/grade writes while dormant.
- Dormant does not yet update Stripe to a reduced recurring price, apply pending dormant at the billing boundary, or restore Stripe pricing on reactivation.
- Data Export current code records a `$19.99` `pending_payment` request, but checkout/payment, export job, artifact generation, secure download, expiration, and retry handling are not complete.
- Account Options wording edits in `web/index.html` and `web/app.js` are local preview changes only and should be reviewed before staging because the backend feature set is incomplete.
- Latest production code commit: `677417b Polish operational tab styling`.
- WEB001 has the latest web bundle deployed under `/var/www/home-school-management/web`.
- Live asset cache keys:
  - `styles.css?v=202605150913`
  - `app.js?v=202605150849`
- Latest WEB001 rollback snapshot:
  `/var/www/home-school-management/rollback/web-202605150913.tgz`
- Latest production changes:
  - Dashboard, Dashboard Compliance, Grades, and Attendance tabs now use the flat underline tab style used by School Day.
  - Calendar, Administration, Curriculum, and Schedule setup/config tab styles were intentionally left unchanged.

## Next Action

1. Resume from `NOTES/dormant-data-export-end-to-end-plan.md`.
2. Start with dormant billing: control-plane migration for dormant Stripe price metadata and transition timestamps.
3. Add Stripe service methods for dormant price apply/restore with tests.
4. Confirm reactivation billing policy: immediate invoice, proration, or next-invoice adjustment.

## Risks

- Do not promise reduced dormant billing in production copy until Stripe-side dormant pricing is implemented.
- Data Export is currently request tracking only, not paid checkout or downloadable export delivery.
- Authenticated hosted smoke still needs valid production tenant credentials.
- Public production health passed, and live HTML references the expected cache keys.
- Untracked scratch screenshots/icons and `tmp/` remain local and intentionally outside commits.
- Browser cache may need a hard refresh to show current assets.

## Validation

- `node --check web/app.js`
- `git diff --check -- web/app.js web/index.html web/styles.css STATUS.md HANDOFF.md`
- Local Web Preview returned HTTP 200 at `http://127.0.0.1:5500/?seedPreview=1`
- PowerShell parser checks for hosted smoke and release-gate scripts
- Public health returned `{"ok":true}` for `https://mitchell.navigrader.com/health`
- WEB001 Apache config syntax OK and Apache service active
- Remote WEB001 hashes matched local `web/index.html` and `web/styles.css`
- Live HTML references `styles.css?v=202605150913` and `app.js?v=202605150849`
- Authenticated hosted smoke was not run because `HSM_HOSTED_SMOKE_USERNAME` and `HSM_HOSTED_SMOKE_PASSWORD` are not set in this shell.
