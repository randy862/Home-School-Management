# Current Status

Date: 2026-05-20

## Active Workstream

Product/platform priorities on `saas-modern-redesign`.

## Current Focus

Backend/platform hardening: expired paid data export artifacts now have control-plane cleanup and retention handling.

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
- School Day bulk status actions were moved into a quieter `Bulk Actions` disclosure to reduce accidental mass updates and visual focus.
- New School Years now receive recommended Q1-Q4 dates balanced by instructional days.
- The Quarters tab previews recommended ranges and can apply/save them for the selected School Year.
- Holiday/Break changes rebalance quarters only when the saved quarters still match the prior recommendation.
- The Recommended Quarters panel is collapsible so the Quarters tab stays focused on saved dates until the recommendation is needed.
- Editing an already-conflicting hosted class now removes unchecked students before backend class conflict validation runs.
- School Day pull-forward scheduling now treats the visible gap before a fixed class as usable, so a 60-minute flexible class can fill a 65-minute opening and leave the transition buffer before the fixed class.
- Ordered schedule blocks now act as placement barriers before fixed classes, so later flexible courses do not jump ahead of Lunch/Recess and push them late in the day.
- Course and Class Edit/Create actions scroll the top editor into view and focus the first field, so long configured lists no longer make the action look invisible.
- Student Current Schedule row actions now say `Edit Schedule`, show `Save Schedule Changes` plus `Cancel Changes`, and discard draft schedule edits without leaving the student page.
- Topbar Help and sidebar `Need Help?` now open a task-based Help Center with parent-friendly guidance and related-page shortcuts.
- Control API maintenance now expires ready data-export requests after `artifact_expires_at` and removes expired ZIP artifacts from the configured export directory.

## Production State

- Public SaaS assets:
  - `saas.css?v=202605182130`
  - `saas-polish.css?v=202605182130`
  - `saas.js?v=202605182130`
- Tenant app assets:
  - `app.js?v=202605201454`
  - `styles.css?v=202605201454`
- APP001 class-conflict rollback:
  - `/home/debian/rollback/hsm/class-conflict-202605191515/`
- APP001 control-api rollback:
  - `/home/debian/rollback/hsm/control-api-export-cleanup-202605201610/app001/control-api.tgz`
- WEB001 class-related rollback snapshots:
  - `/var/www/home-school-management/rollback/web-class-bulk-enroll-202605190845.tgz`
  - `/var/www/home-school-management/rollback/web-school-day-gap-fill-anchor-fix-202605191445.tgz`
  - `/var/www/home-school-management/rollback/web-class-conflict-202605191515.tgz`
  - `/var/www/home-school-management/rollback/web-class-quarters-polish-202605191530.tgz`
  - `/var/www/home-school-management/rollback/web-school-day-bulk-status-202605191700.tgz`
  - `/var/www/home-school-management/rollback/web-school-day-bulk-actions-subtle-202605191730.tgz`
  - `/var/www/home-school-management/rollback/web-quarter-recommendations-202605191815.tgz`
  - `/var/www/home-school-management/rollback/web-quarter-recommendations-disclosure-202605191830.tgz`
  - `/var/www/home-school-management/rollback/web-class-conflict-removal-fix-202605191900.tgz`
  - `/var/www/home-school-management/rollback/web-school-day-gap-fill-visible-window-webroot-202605191930.tgz`
  - `/var/www/home-school-management/rollback/web-school-day-ordered-break-placement-202605191950.tgz`
  - `/var/www/home-school-management/rollback/web-curriculum-editor-scroll-202605200905.tgz`
  - `/var/www/home-school-management/rollback/web-student-schedule-edit-cancel-202605200916.tgz`
  - `/var/www/home-school-management/rollback/web-help-center-202605201454.tgz`

## Validation

- Local syntax checks passed:
  - `node --check web/app.js`
  - `node --check server/src/services/curriculum-service.js`
  - `node --check server/src/repositories/postgres/curriculum-repository.js`
- Backend conflict/non-conflict service behavior checks passed with fake repository data.
- APP001 `hsm-api` restarted healthy and `/health` returned `{"ok":true}`.
- WEB001 public HTML references `app.js?v=202605200916` and `styles.css?v=202605191900`.
- Public hosted `/`, `/terms`, and `/privacy` returned HTTP 200 after the class conflict cleanup deployment.
- Full hosted release gate passed for `https://mitchell.navigrader.com` after class conflict deployment.
- Public `mitchell` and `smoketest` tenant roots reference `app.js?v=202605191930`; served app JS contains the visible-gap fix.
- Public `mitchell` and `smoketest` tenant roots reference `app.js?v=202605191950`; served app JS contains the ordered-break placement fix.
- Public `mitchell` and `smoketest` tenant roots reference `app.js?v=202605200905`; served app JS contains the editor-scroll fix.
- Public `mitchell` and `smoketest` tenant roots reference `app.js?v=202605200916`; served app JS contains the student schedule edit/cancel fix.
- Public `mitchell` and `smoketest` tenant roots reference `app.js?v=202605201454` and `styles.css?v=202605201454`; served app JS/CSS contain the Help Center implementation.
- Control API syntax checks passed for app, worker, commercial store, and maintenance service.
- Focused cleanup simulation passed for expired, missing-file, and unsafe-path export artifacts.
- Maintenance retry timing simulation passed.
- APP001 control migrations applied through `012_export_cleanup_indexes.sql`.
- APP001 `hsm-control-api.service` restarted active and `/control-api/health` returned `{"ok":true}` locally and publicly.

## Current Blockers

- None for the export cleanup/backend hardening slice.

## Current Risks

- Continue using smoke/test tenant data for mutating QA where possible.
- Do not store smoke credentials or Stripe secrets in repo files.
- Untracked local scratch assets remain outside committed work.

## Next Actions

1. Run the hosted release gate from a PowerShell session with smoke credentials loaded.
2. Monitor control-api logs for the next export cleanup interval.
3. Continue backend/platform hardening with control-plane job retention or operational alerting.
