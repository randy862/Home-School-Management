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
- Added `RUNBOOKS/application-architecture.md` documenting browser, `WEB001`, `APP001`, and `SQL001` responsibilities.
- Added `RUNBOOKS/aws-budget-migration.md` documenting the initial low-cost AWS plan that mirrors the lab server layout with `WEB001`, `APP001`, `SQL001`, and `MAINT001`.
- Updated the AWS budget plan to include a temporary NAT instance for private-server updates and component downloads without an always-on NAT Gateway.
- Adjusted the AWS plan so `MAINT001` is a public-subnet jumpbox locked to the administrator IP, with `APP001` and `SQL001` private-only.
- Began AWS foundation build: created `navigrader-prod-vpc`, public/private subnets, S3 Gateway Endpoint, no NAT Gateway, security groups, and launched/updated `MAINT001`.
- Launched `WEB001`, associated an Elastic IP, verified SSH through `MAINT001`, installed Apache, and verified local Apache response.
- Launched `TEMP-NAT`, enabled temporary private-subnet egress, corrected `APP001` into the private subnet at `10.40.131.149`, verified NAT egress, and bootstrapped APP001 with base tools, Node/npm, and the `navigrader` service account/directories.
- Launched `SQL001` in the private subnet at `10.40.138.78`, installed PostgreSQL 17, created `appdb`/`navigrader_app`, configured private PostgreSQL listening and APP001 `pg_hba.conf` access, and verified APP001 reaches password authentication.
- Verified APP001-to-SQL001 login using the real `navigrader_app` password.
- Created S3 backup bucket `navigrader-prod-backups-016365604963-us-east-2-an`, attached `navigrader-prod-sql001-backup-role` to SQL001, and verified SQL001 can list/upload under `postgres/` without access keys.
- Added SQL001 logical backup script `/usr/local/sbin/navigrader-pg-dump-backup.sh`, uploaded first `appdb` dump/checksum to S3, verified restore into a temporary database, and scheduled daily root cron at `07:15 UTC`.
- Configured WAL/PITR with pgBackRest 2.55.1 on SQL001 using S3 path `postgres/pgbackrest/`; `pgbackrest check` succeeded, first full backup `20260526-002743F` completed, and root cron schedules weekly full plus daily differential physical backups.
- Expanded the AWS migration runbook with current resource state, audit/logging coverage, exact resume point, commercial go-live gates, post-go-live stabilization, and pause/shutdown guidance.
- User reported pause/cost-control steps completed: temporary private subnet NAT route removed, `TEMP-NAT` terminated, and servers stopped while pausing AWS buildout.
- Updated the Help Center `Account, Billing, and Data Export` article in `web/app.js` with detailed Account, Billing, Dormant Mode, Data Export, cancellation, password, sign-out, and FAQ guidance.
- Deployed the expanded Help Center account article to WEB001 as `app.js?v=202605252122`.

## Production State

- Public SaaS assets:
  - `saas.css?v=202605182130`
  - `saas-polish.css?v=202605182130`
  - `saas.js?v=202605182130`
- Tenant app assets:
  - `app.js?v=202605252122`
  - `styles.css?v=202605221245`
- APP001 rollback:
  - `/home/debian/rollback/hsm/independent-learning-instructor-202605202030/app001/server.tgz`
- APP001 control-api rollback:
  - `/home/debian/rollback/hsm/control-api-export-cleanup-202605201610/app001/control-api.tgz`
- WEB001 latest rollback:
  - `/var/www/home-school-management/rollback/web-help-account-202605252122.tgz`

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
- Help Center account article validation passed:
  - `node --check web/app.js`
  - `git diff --check`
  - WEB001 Apache config test and reload
  - public `mitchell` and `smoketest` roots reference `app.js?v=202605252122`
  - served tenant app JS contains `Account Menu Options`, `Dormant Mode is billed at`, `Request Data Export`, and `Keep Subscription Active`
  - public `https://mitchell.navigrader.com/health` returned `{"ok":true}`
- Full hosted release gate passed from the user's PowerShell session against `https://mitchell.navigrader.com`.

## Current Blockers

- None.

## Current Risks

- Continue using smoke/test tenant data for mutating QA where possible.
- Do not store smoke credentials or Stripe/Postmark secrets in repo files.
- Untracked local scratch assets remain outside committed work.

## Next Actions

1. Start required servers for the next AWS build session, beginning with `MAINT001`, then configure EBS snapshot lifecycle policies.
2. Verify in the UI that a displayed `90.0%` Running Grade Average shows `Strong`.
3. Keep the current Dashboard performance slice closed unless larger tenants expose new lag.
