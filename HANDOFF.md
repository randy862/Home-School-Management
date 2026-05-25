# Session Handoff

Date: 2026-05-24

## Context

Large-tenant performance optimization is active for `mitchell.navigrader.com`.

## Current State

- Added opt-in browser performance diagnostics enabled by `?perf=1`.
- Added `scripts/Measure-HostedPerformance.ps1` for hosted endpoint timing and payload baselines.
- Mitchell endpoint baseline showed the largest payloads on `/api/instruction-actuals`, `/api/tests`, and `/api/attendance`.
- Mitchell browser baseline showed the main lag in Dashboard instructional-hours rendering, not login hydration.
- Added indexed instruction-actual and flex-block lookups.
- Added cached daily scheduled blocks and cached instructional-hours snapshots.
- Follow-up browser metrics improved the worst Dashboard render from ~7.5s to ~754ms, with the first instructional-hours snapshot around ~289ms and subsequent reused metrics near-zero.
- Added cached compliance monthly series and changed instructional-hours chart/trend builders to reuse the daily-block cache instead of rerunning the scheduler path.
- Added helper metrics for `dashboard.buildComplianceMonthlySeries`, `dashboard.renderComplianceHoursMonthlyChart`, and `dashboard.renderInstructionHoursTrending`.
- WEB001 deployed `app.js?v=202605242212` and `styles.css?v=202605221245`.
- Rollback: `/var/www/home-school-management/rollback/web-dashboard-monthly-series-cache-202605242212.tgz`.
- Hosted release gate has not been rerun from this shell because hosted smoke credentials were not present.

## Next Action

Refresh `https://mitchell.navigrader.com/?perf=1`, navigate Dashboard tabs, and inspect `window.__navigraderPerfMetrics` for `dashboard.render`, `dashboard.buildComplianceMonthlySeries`, and `dashboard.renderInstructionHoursTrending`.

## Risks

- Performance diagnostics are opt-in, but enabling them clones JSON responses to measure payload bytes, so use only while measuring.
- Use smoke/test tenant data for mutating QA where possible.
- Do not store smoke credentials, Stripe secrets, or Postmark secrets in repo files.
- Untracked scratch screenshots/icons and `tmp/` remain local and intentionally outside commits.

## Validation

- `node --check web/app.js`
- `git diff --check`
- WEB001 local root references `app.js?v=202605242212`.
- Public `mitchell` and `smoketest` roots reference `app.js?v=202605242212`.
- Served tenant app JS contains `complianceMonthlySeriesCache`, `dashboard.buildComplianceMonthlySeries`, and `dashboard.renderInstructionHoursTrending`.
- Public `https://mitchell.navigrader.com/health` returned `{"ok":true}`.
