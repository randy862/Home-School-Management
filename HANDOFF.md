# Session Handoff

Date: 2026-05-18

## Context

Product/platform follow-up is active. Current slice is production tenant Dashboard performance after Account Upgrade, Dormant Mode, Data Export, subscriber cancellation, and Legal acceptance.

## Current State

- Production-safe hosted smoke credentials exist outside the repo and authenticate as `smoketest`.
- Legal acceptance is deployed and committed:
  - public `/terms` and `/privacy`
  - signup Terms/Privacy checkbox and recurring billing disclosure
  - `legal_acceptances` audit table
  - Stripe Checkout terms consent/custom legal text
  - authenticated account legal links
  - full hosted release gate passed after deploy
- Dashboard performance optimization is implemented and deployed on WEB001:
  - tenant app now serves `app.js?v=202605190135`
  - active-tab Dashboard rendering avoids building hidden Performance/Compliance charts and tables
  - Compliance subtabs avoid calculating unrelated hidden subtab data
  - live file path is `/var/www/home-school-management/web`
  - WEB001 rollback snapshot: `/var/www/home-school-management/rollback/web-dashboard-performance-202605190135.tgz`
- User timing after first pass on `mitchell.navigrader.com`:
  - login about 5 seconds
  - return to Dashboard about 2.5 seconds
  - Execution about 1 second
  - Performance about 3 seconds
  - Compliance Hours/Days about 5 seconds before second trimming pass
- Production data count check for `tenant_mitchell_family`:
  - 4 students
  - 558 attendance rows
  - 3,988 instruction actual rows
  - 1,270 test rows

## Next Action

1. Have user hard-refresh and re-test `mitchell.navigrader.com` Dashboard after `app.js?v=202605190135`.
2. If still needed, optimize login/bootstrap API payloads next.

## Risks

- Do not run mutating QA against real family data.
- Do not store smoke credentials or Stripe secrets in repo files.
- Hosted smoke credentials are not available in this Codex shell; full hosted release gate must be run from the user environment.
- Untracked scratch screenshots/icons and `tmp/` remain local and intentionally outside commits.

## Validation

- `node --check web/app.js` passed.
- Public `https://mitchell.navigrader.com/` returns `200`.
- Public HTML references `app.js?v=202605190135`.
- Hosted release gate last passed after Legal acceptance deploy.
