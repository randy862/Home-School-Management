# Current Status

Date: 2026-05-24

## Active Workstream

Product/platform priorities on `saas-modern-redesign`.

## Current Focus

Performance baseline instrumentation for large-tenant optimization.

## Completed Recently

- Production-safe hosted smoke credentials exist outside the repo.
- Account Upgrade, Dormant Mode, Data Export, subscriber cancellation, Legal acceptance, Dashboard performance, and Help Center are deployed, committed, and pushed.
- Class configuration supports bulk student enrollment, roster conflict warnings, and backend fixed-class conflict validation.
- School Day scheduling reflows flexible courses around fixed classes, uses visible gaps before fixed classes, and respects ordered Lunch/Recess placement.
- School Day has subtle bulk open-item actions for completing/excusing filtered instruction rows.
- School Years create balanced recommended quarters; Holiday/Break changes rebalance quarters when saved dates still match recommendations.
- Course/Class edit actions scroll the top editor into view.
- Student Current Schedule has row-specific edit/cancel behavior.
- Control API maintenance expires ready data-export requests and removes expired ZIP artifacts from the configured export directory.
- `Independent Learning` is now a system instructor option for Course instructor, Class instructor override, School Day instructor edits, reports, and dashboard/grade filters.
- Class-level instructor override persists in `course_sections.instructor_id`; School Day defaults class rows to the class instructor before falling back to the course instructor.
- APP001 deployed migration `031_independent_learning_instructor.sql`, seeding the protected instructor and adding `course_sections.instructor_id`.
- WEB001 deployed tenant app `app.js?v=202605202030`.
- Full hosted release gate passed after deployment.
- Class form Weekdays field is deployed as a compact, content-width control.
- Curriculum sidebar icon no longer renders as a white square when active.
- School Day row editor now preserves unsaved start time, instructor, and minutes while status/grade actions re-render the row.
- Quick Start Help article now provides a detailed setup-to-operation walkthrough for new homeschool families.
- Dashboard Attendance Open gauge now opens School Day on the Attendance tab instead of requiring an extra click from Daily Schedule.
- Quick Start Help article was replaced with the provided step-by-step setup guidance; the prior version is saved at `web/help/quick-start-previous-20260522.md`.
- Help Center has an `Open in Window` action that opens a movable reference window while the main app stays usable.
- Tenant app now has opt-in performance diagnostics enabled by `?perf=1`, recording API timing/payloads, hydration sections, and Dashboard render builders to `window.__navigraderPerfMetrics`.
- Added `scripts/Measure-HostedPerformance.ps1` to capture hosted endpoint timing, payload size, and row-count baselines from outside the browser.

## Production State

- Public SaaS assets:
  - `saas.css?v=202605182130`
  - `saas-polish.css?v=202605182130`
  - `saas.js?v=202605182130`
- Tenant app assets:
  - `app.js?v=202605242103`
  - `styles.css?v=202605221245`
- APP001 latest rollback:
  - `/home/debian/rollback/hsm/independent-learning-instructor-202605202030/app001/server.tgz`
- APP001 control-api rollback:
  - `/home/debian/rollback/hsm/control-api-export-cleanup-202605201610/app001/control-api.tgz`
- WEB001 latest rollback:
  - `/var/www/home-school-management/rollback/web-performance-instrumentation-served-202605242103.tgz`

## Validation

- Local syntax checks passed:
  - `node --check web/app.js`
  - `node --check server/src/postgres-instructor-store.js`
  - `node --check server/src/repositories/postgres/curriculum-repository.js`
  - `node --check server/src/services/curriculum-service.js`
- APP001 deployed syntax checks passed for the touched API files.
- APP001 tenant migrations applied through `031_independent_learning_instructor.sql`.
- APP001 `hsm-api.service` restarted active and local `/health` returned `{"ok":true}`.
- WEB001 root returned HTTP 200.
- Public `https://mitchell.navigrader.com/health` returned `{"ok":true}`.
- Public `mitchell` and `smoketest` tenant roots reference `app.js?v=202605221245` and `styles.css?v=202605221245`.
- Served tenant app JS contains the Help Center pop-out code.
- Served tenant CSS contains the Help Center pop-out button style.
- Previous full hosted release gate passed for `https://mitchell.navigrader.com`; rerun after this slice from a shell with credentials.
- Local syntax checks passed for performance instrumentation:
  - `node --check web/app.js`
  - PowerShell parser check for `scripts/Measure-HostedPerformance.ps1`
  - `git diff --check`
- WEB001 served root returns `app.js?v=202605242103`.
- Public `mitchell` and `smoketest` tenant roots reference `app.js?v=202605242103`.
- Served tenant app JS contains `hsm_perf_diagnostics`, `hydrate.total`, and `dashboard.render`.
- Public `https://mitchell.navigrader.com/health`, `/terms`, and `/privacy` returned HTTP 200.
- Public `mitchell` and `smoketest` tenant roots reference `styles.css?v=202605202115`.
- Served tenant CSS contains the compact Class weekdays selector.
- Public `mitchell` and `smoketest` tenant roots reference `book-open.svg?v=202605202130`.
- Served Curriculum icon SVG no longer contains a white background rectangle.

## Current Blockers

- None.

## Current Risks

- Verify in the UI that `Independent Learning` appears in Course, Class, School Day row edit, Reports, and Dashboard/Grades instructor filters.
- Full hosted release gate still needs to be run from a shell where `HSM_HOSTED_SMOKE_USERNAME` and `HSM_HOSTED_SMOKE_PASSWORD` are present.
- Continue using smoke/test tenant data for mutating QA where possible.
- Do not store smoke credentials or Stripe/Postmark secrets in repo files.
- Untracked local scratch assets remain outside committed work.

## Next Actions

1. Run `scripts/Measure-HostedPerformance.ps1` against `mitchell.navigrader.com` with performance or hosted smoke credentials.
2. Open `https://mitchell.navigrader.com/?perf=1`, exercise Dashboard tabs, and inspect `window.__navigraderPerfMetrics`.
3. Use the baseline to choose the first data-scope/backend summary endpoint optimization.
