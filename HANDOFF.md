# Session Handoff

Date: 2026-05-25

## Context

Dashboard polish is active for `mitchell.navigrader.com`.

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
- Full hosted release gate passed from the user's PowerShell session after this deployment.
- Dashboard Running Grade Average and Attendance status cards now use the same one-decimal rounded value for threshold classification that they display to users.
- WEB001 deployed `app.js?v=202605251234`.
- Rollback: `/var/www/home-school-management/rollback/web-dashboard-status-rounded-threshold-202605251234.tgz`.
- Added `RUNBOOKS/application-architecture.md` for a practical, non-code-heavy map of browser, `WEB001`, `APP001`, and `SQL001` responsibilities.
- Added `RUNBOOKS/aws-budget-migration.md` for the low-cost AWS proof-of-concept plan that mirrors the lab environment and includes `MAINT001`.
- Updated `RUNBOOKS/aws-budget-migration.md` to include a temporary NAT instance pattern for private-server updates and component downloads without an always-on NAT Gateway.
- Adjusted the AWS plan so `MAINT001` is a public-subnet jumpbox locked to the administrator IP, while `APP001` and `SQL001` remain private.
- AWS foundation build has started: `navigrader-prod-vpc` exists with public/private subnets, S3 Gateway Endpoint, no NAT Gateway, security groups were created, `MAINT001` was launched in the public subnet, SSH was verified, and base updates/tools were installed.
- `WEB001` was launched in the public subnet, an Elastic IP was associated, SSH through `MAINT001` works, Apache was installed, and localhost Apache response was verified.
- `TEMP-NAT` was launched, source/destination check disabled, Linux NAT configured, and private route table temporarily routes `0.0.0.0/0` through the NAT ENI for bootstrap.
- `APP001` was relaunched correctly in the private subnet at `10.40.131.149`; SSH through `MAINT001` works, temporary NAT egress was verified with `curl https://deb.debian.org`, OS/tools/Node/npm were installed, and the `navigrader` service user/directories were created.
- `SQL001` was launched in the private subnet at `10.40.138.78`, PostgreSQL 17 was installed, `appdb` and `navigrader_app` were created, `listen_addresses='*'` was configured, `pg_hba.conf` now allows `APP001` at `10.40.131.149/32`, and an APP001-to-SQL001 test reaches password authentication.
- APP001-to-SQL001 login using the real `navigrader_app` password was verified successfully.
- S3 backup bucket `navigrader-prod-backups-016365604963-us-east-2-an` exists; `navigrader-prod-sql001-backup-role` is attached to SQL001; S3 list/upload under `postgres/` succeeded from SQL001 without access keys.
- SQL001 now has `/usr/local/sbin/navigrader-pg-dump-backup.sh`; a manual `appdb` custom-format dump uploaded to S3 under `postgres/logical/`, checksum uploaded, restore into a temporary database succeeded, and root cron runs the job daily at `07:15 UTC`.
- WAL/PITR is configured with pgBackRest 2.55.1 on SQL001. Config is `/etc/pgbackrest.conf`, stanza is `main`, repository path is `s3://navigrader-prod-backups-016365604963-us-east-2-an/postgres/pgbackrest/`, PostgreSQL archives WAL via `archive_command='pgbackrest --stanza=main archive-push %p'`, `pgbackrest check` succeeded, and first full backup `20260526-002743F` completed successfully.
- Root cron now runs pgBackRest full backups Sundays at `06:30 UTC` and differential backups Monday-Saturday at `06:30 UTC`.
- Expanded `RUNBOOKS/aws-budget-migration.md` with current AWS build state, AWS audit/logging reality, resume point, full commercial production go-live gates, post-go-live stabilization, and pause/shutdown cost guidance.

## Next Action

Continue AWS buildout. Next action: remove the temporary private subnet NAT route, terminate `TEMP-NAT`, stop servers if pausing, then configure EBS snapshot lifecycle policies.

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
- Full hosted release gate passed, including APP001 local health, public health, public legal pages, and hosted tenant smoke.
- `node --check web/app.js` and `git diff --check` passed after the rounded-threshold status fix.
- Public `mitchell` and `smoketest` roots reference `app.js?v=202605251234`.
- Served tenant app JS contains `roundedStatusPercent`.
