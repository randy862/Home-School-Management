# Current Status

Date: 2026-05-25

## Active Workstream

Product/platform priorities on `saas-modern-redesign`.

## Current Focus

Dashboard correctness and performance polish.

## Completed Recently

- Production-safe hosted smoke credentials exist outside the repo.
- Account Upgrade, Dormant Mode, Data Export, subscriber cancellation, Legal acceptance, Dashboard performance diagnostics, and Help Center polish are deployed, committed, and pushed.
- Class configuration supports bulk enrollment, roster conflict warnings, and backend fixed-class conflict validation.
- School Day scheduling reflows flexible courses around fixed classes, uses visible gaps before fixed classes, respects ordered Lunch/Recess placement, and has subtle bulk open-item actions.
- School Years create balanced recommended quarters; Holiday/Break changes rebalance quarters when saved dates still match recommendations.
- Course/Class edit actions scroll the top editor into view; Student Current Schedule has row-specific edit/cancel behavior.
- `Independent Learning` is a protected system instructor option across Course, Class, School Day row edits, reports, dashboard filters, and grade filters.
- Quick Start Help now uses the detailed setup guide; the prior version is saved at `web/help/quick-start-previous-20260522.md`.
- Help Center has an `Open in Window` action.
- Dashboard Attendance Open gauge opens School Day on the Attendance tab.
- Tenant app has opt-in performance diagnostics enabled by `?perf=1`, recording API, hydration, and Dashboard timings to `window.__navigraderPerfMetrics`.
- Added `scripts/Measure-HostedPerformance.ps1` for hosted endpoint timing, payload size, and row-count baselines.
- Dashboard instructional-hours rendering now uses cached instructional-hour snapshots, cached daily scheduled blocks, indexed instruction/flex lookups, and cached compliance monthly series.
- Dashboard Running Grade Average and Attendance status cards now classify against the same one-decimal value shown to users.

## Production State

- Public SaaS assets:
  - `saas.css?v=202605182130`
  - `saas-polish.css?v=202605182130`
  - `saas.js?v=202605182130`
- Tenant app assets:
  - `app.js?v=202605251234`
  - `styles.css?v=202605221245`
- APP001 rollback:
  - `/home/debian/rollback/hsm/independent-learning-instructor-202605202030/app001/server.tgz`
- APP001 control-api rollback:
  - `/home/debian/rollback/hsm/control-api-export-cleanup-202605201610/app001/control-api.tgz`
- WEB001 latest rollback:
  - `/var/www/home-school-management/rollback/web-dashboard-status-rounded-threshold-202605251234.tgz`

## Validation

- Local checks passed:
  - `node --check web/app.js`
  - PowerShell parser check for `scripts/Measure-HostedPerformance.ps1`
  - `git diff --check`
- APP001 tenant migrations applied through `031_independent_learning_instructor.sql`.
- WEB001 root returned HTTP 200.
- Public `https://mitchell.navigrader.com/health` returned `{"ok":true}`.
- Public `mitchell` and `smoketest` tenant roots reference `app.js?v=202605251234` and `styles.css?v=202605221245`.
- Served tenant app JS contains `roundedStatusPercent`.
- Served tenant app JS contains `hsm_perf_diagnostics`, `dashboard.render`, `instructionalHoursSnapshotCache`, `dashboardDailyBlocksCache`, `instructionActualsByKey`, `complianceMonthlySeriesCache`, `dashboard.buildComplianceMonthlySeries`, and `dashboard.renderInstructionHoursTrending`.
- Full hosted release gate passed for `https://mitchell.navigrader.com` after the `app.js?v=202605242212` deployment.

## Current Blockers

- None.

## Current Risks

- Continue using smoke/test tenant data for mutating QA where possible.
- Do not store smoke credentials or Stripe/Postmark secrets in repo files.
- Untracked local scratch assets remain outside committed work.

## Next Actions

1. Verify in the UI that a displayed `90.0%` Running Grade Average shows `Strong`.
2. Keep the current Dashboard performance slice closed unless larger tenants expose new lag.
