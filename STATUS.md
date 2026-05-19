# Current Status

Date: 2026-05-18

## Active Workstream

Product/platform priorities on `saas-modern-redesign`.

## Current Focus

Tenant Dashboard performance for production family data is deployed after Legal acceptance.

## Completed Recently

- Production-safe hosted smoke credentials were set outside the repo.
- Hosted release gate passed for `https://mitchell.navigrader.com`.
- Account Upgrade, Dormant Mode, Data Export, subscriber cancellation, and Legal acceptance are deployed, committed, and pushed.
- Legal acceptance is live: public `/terms` and `/privacy`, required signup checkbox, recurring billing disclosure, Stripe terms consent, `legal_acceptances` audit records, and authenticated legal links.
- Dashboard performance first pass is deployed to WEB001:
  - tenant app now serves `app.js?v=202605190135`
  - Dashboard renders only the active dashboard tab instead of all hidden charts/tables
  - Compliance subtabs render only their own heavy data path
  - Overview no longer forces Performance and Compliance tables/charts during initial Dashboard load
- User timing on `mitchell.navigrader.com` after first pass:
  - login about 5 seconds
  - return to Dashboard about 2.5 seconds
  - Execution about 1 second
  - Performance about 3 seconds
  - Compliance Hours/Days about 5 seconds before second trimming pass

## Production State

- Public SaaS assets:
  - `saas.css?v=202605182130`
  - `saas-polish.css?v=202605182130`
  - `saas.js?v=202605182130`
- Tenant app assets:
  - `styles.css?v=202605182130`
  - `app.js?v=202605190135`
- Latest WEB001 Dashboard rollback snapshot:
  - `/var/www/home-school-management/rollback/web-dashboard-performance-202605190135.tgz`
- Latest Legal acceptance rollback snapshots:
  - APP001 `/home/debian/rollback/hsm/legal-acceptance-202605182130/control-api`
  - WEB001 `/var/www/home-school-management/rollback/web-legal-acceptance-202605182130.tgz`

## Validation

- Dashboard performance local syntax check passed with `node --check web/app.js`.
- WEB001 serves the updated tenant app bundle.
- Public tenant page returns `200` and references `app.js?v=202605190135`.
- Production data count check for `tenant_mitchell_family` showed 4 students, 558 attendance rows, 3,988 instruction actual rows, and 1,270 test rows.
- Full hosted release gate last passed after Legal acceptance deploy.

## Current Blockers

- Optional control-plane release gate requires production-safe control credentials.
- Hosted smoke credentials are not available inside this Codex shell, so full hosted release gate needs the user environment.

## Current Risks

- Do not store smoke credentials or Stripe secrets in repo files.
- Use a smoke/test tenant, not a real family account, for mutating validation.
- Dashboard performance improved through frontend lazy rendering; deeper API/bootstrap optimization remains available if needed.
- Untracked local scratch assets remain outside committed work.

## Next Actions

1. Re-test the second Dashboard performance pass in production.
2. Then resume backend/platform hardening, tenant/runtime correctness, or deeper workflow QA.
