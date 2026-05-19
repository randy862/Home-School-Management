# Current Status

Date: 2026-05-19

## Active Workstream

Product/platform priorities on `saas-modern-redesign`.

## Current Focus

Deeper workflow QA from real usage: School Day now supports bulk completion/excusal for currently filtered open classes.

## Completed Recently

- Production-safe hosted smoke credentials exist outside the repo.
- Account Upgrade, Dormant Mode, Data Export, subscriber cancellation, Legal acceptance, and Dashboard performance are deployed, committed, and pushed.
- Class configuration now supports bulk student enrollment directly from the Class form.
- Class roster save moves same-course flexible enrollments or same-course class enrollments cleanly into the selected class.
- Class list now shows enrolled student names under the class enrollment count.
- School Day scheduling now reflows flexible/non-class courses around fixed classes and looks ahead to fill open windows before later fixed classes.
- Class roster UI now flags fixed-class conflicts by student, weekday, quarter/date scope, and time window.
- Class save is blocked when selected students have conflicting fixed classes.
- Backend section-enrollment create/update and course-section update now reject fixed-class conflicts with `409`.
- Students and Quarters class-form dropdowns were polished to use compact checklist layout.
- School Day Daily Schedule now has `Complete Open` and `Excuse Open` bulk actions for the currently filtered open instruction queue.

## Production State

- Public SaaS assets:
  - `saas.css?v=202605182130`
  - `saas-polish.css?v=202605182130`
  - `saas.js?v=202605182130`
- Tenant app assets:
  - `app.js?v=202605191700`
  - `styles.css?v=202605191700`
- APP001 class-conflict rollback:
  - `/home/debian/rollback/hsm/class-conflict-202605191515/`
- WEB001 class-related rollback snapshots:
  - `/var/www/home-school-management/rollback/web-class-bulk-enroll-202605190845.tgz`
  - `/var/www/home-school-management/rollback/web-school-day-gap-fill-anchor-fix-202605191445.tgz`
  - `/var/www/home-school-management/rollback/web-class-conflict-202605191515.tgz`
  - `/var/www/home-school-management/rollback/web-class-quarters-polish-202605191530.tgz`
  - `/var/www/home-school-management/rollback/web-school-day-bulk-status-202605191700.tgz`

## Validation

- Local syntax checks passed:
  - `node --check web/app.js`
  - `node --check server/src/services/curriculum-service.js`
  - `node --check server/src/repositories/postgres/curriculum-repository.js`
- Backend conflict/non-conflict service behavior checks passed with fake repository data.
- APP001 `hsm-api` restarted healthy and `/health` returned `{"ok":true}`.
- WEB001 public HTML references `app.js?v=202605191700` and `styles.css?v=202605191700`.
- Public hosted `/`, `/terms`, and `/privacy` returned HTTP 200 after the bulk status deployment.
- Full hosted release gate passed for `https://mitchell.navigrader.com` after class conflict deployment.

## Current Blockers

- None for the class bulk enrollment slice.

## Current Risks

- Continue using smoke/test tenant data for mutating QA where possible.
- Do not store smoke credentials or Stripe secrets in repo files.
- Untracked local scratch assets remain outside committed work.

## Next Actions

1. Run the hosted release gate from a PowerShell session with smoke credentials loaded.
2. Real-usage QA the new School Day `Complete Open` / `Excuse Open` actions from the Open Classes dashboard link.
3. Then close the deeper workflow QA slice or move to backend/platform hardening.
