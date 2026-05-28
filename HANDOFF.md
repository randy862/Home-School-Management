# Session Handoff

Date: 2026-05-27

## Context

AWS commercial production migration checkpoint after deploying the current home lab code baseline.

## Current State

- Password recovery and login refresh were committed/pushed in `7031068 Add tenant password reset flow`.
- Attendance Search and School Day filter polish were committed/pushed in `18a482f Polish attendance and school day filters`.
- Open Items Today count/text fix was committed in `93a6ab8 Align open items count with visible buckets`.
- Past Due Schedule Items detail gauge was committed in `4f75edc Add past due schedule items gauge`.
- Tenant-aware password reset links were committed in `a1e0810 Use tenant URL for password reset links`.
- Home lab APP001 is deployed and validated through `a1e0810`; WEB001 is deployed and validated through `4f75edc`.
- AWS APP001/WEB001 were updated from branch `saas-modern-redesign` at `cb7b057`.
- AWS SQL001 migration `032_password_reset_tokens.sql` was applied to `public` and `tenant_aws_validation`.
- AWS rollback bundle: `/home/admin/rollback/hsm/aws-cb7b057-202605272003/`.
- AWS APP001 runtime/mail env was configured for `http://aws-validation.navigrader.com` with Postmark `allowlist_only`.
- AWS validation tenant was initialized with admin `awsadmin` and allowlisted email `randy862@gmail.com`.
- Public DNS `aws-validation.navigrader.com` now has an A record to AWS `18.188.35.157`; a temporary Windows hosts override was also added for immediate local validation.
- Temporary AWS NAT Gateway `navigrader-temp-private-egress` is active and private route table `rtb-01e7fa93185f5ddf` has `0.0.0.0/0` routed to it.
- AWS APP001 CORS now allows `http://aws-validation.navigrader.com`; rollback env backup: `/home/admin/rollback/hsm/aws-validation-cors-202605280150/app001/hsm-api.env.before`.
- AWS `awsadmin` password reset email delivery and reset-complete flow were validated successfully.
- Attendance Search now uses `Start Date` and `End Date` filters instead of a single Date filter.
- School Day Filters now use one grouped `Scheduled Item` filter for Classes, Courses, and Schedule Blocks.
- School Day Scheduled Item dropdown uses compact two-line option rows with wider menu styling to avoid overlap.
- Home lab WEB001 is deployed with `app.js?v=202605271906` and `styles.css?v=202605271700`.
- Public `https://mitchell.navigrader.com/health` returned HTTP 200.
- WEB001 deployed SHA-256 hashes matched local `web/index.html`, `web/app.js`, and `web/styles.css`.
- Journal entry updated at `JOURNAL/2026-05-27.md`.

## Next Action

Tear down temporary AWS NAT Gateway egress after any final smoke checks: remove the private `0.0.0.0/0` NAT route, delete `navigrader-temp-private-egress`, release its Elastic IP, and remove the local Windows hosts override once DNS resolves normally. If EC2 instances were stopped for cost control, restart the needed AWS hosts before smoke testing.

## Risks

- Keep Postmark, database, Stripe, smoke credentials, and runtime env files out of the repo.
- Untracked scratch screenshots/icons and `tmp/` remain local and should stay out of this commit.

## Rollback

- Attendance Search rollback: `/var/www/home-school-management/rollback/web-attendance-date-range-202605271635.tgz`
- School Day Scheduled Item rollback: `/var/www/home-school-management/rollback/web-school-day-scheduled-item-filter-202605271655.tgz`
- School Day dropdown cleanup rollback: `/var/www/home-school-management/rollback/web-school-day-scheduled-item-cleanup-202605271700.tgz`
- Open Items Today rollback: `/var/www/home-school-management/rollback/web-open-items-gauge-202605271851.tgz`
- Past Due Schedule Items gauge rollback: `/var/www/home-school-management/rollback/web-past-due-schedule-gauge-202605271906.tgz`
- Tenant-aware password reset link rollback: `/home/debian/rollback/hsm/password-reset-tenant-url-202605272030/app001/server/src/routes/auth-routes.js`
- AWS APP001 rollback: `/home/admin/rollback/hsm/aws-cb7b057-202605272003/app001/server.tgz`
- AWS WEB001 rollback: `/var/www/home-school-management/rollback/aws-cb7b057-202605272003/web001/web.tgz`
- AWS SQL001 pre-migration schema backup: `/home/admin/rollback/hsm/aws-cb7b057-202605272003/sql001/appdb-schema-before-032.sql`
- AWS runtime env rollback: `/home/admin/rollback/hsm/aws-runtime-mail-202605272015/app001/`
- AWS validation tenant init data backup: `/home/admin/rollback/hsm/aws-validation-init-202605272015/app001/aws-validation-before-init-data.sql`

## Validation

- `node --check web/app.js`
- `git diff --check`
- Public root references `styles.css?v=202605271700` and `app.js?v=202605271906`.
- Served app script contains `attendance-filter-start-date`, `attendance-filter-end-date`, `school-day-scheduled-item-checkbox`, and `school-day-scheduled-option`.
- Served app script contains `Past Due Schedule Items` and still excludes Past Due from the overview Open Items Today total and summary copy.
- Deployed APP001 password reset URL assertion produces `https://pj-cool.navigrader.com/#resetToken=...` even when global config points at Mitchell.
- AWS `http://18.188.35.157/health`, `/api/setup/status`, and `/control-api/health` returned HTTP 200 with Host `aws-validation.navigrader.com`.
- AWS served app script contains `Past Due Schedule Items`, Attendance date filters, and School Day Scheduled Item markers.
- AWS tenant API/control API env summaries show Postmark tokens set, `allowlist_only`, and `PUBLIC_APP_BASE_URL=http://aws-validation.navigrader.com`.
- AWS setup status now returns `{"initialized":true}` for Host `aws-validation.navigrader.com`.
- AWS APP001 reached Postmark after temporary NAT Gateway routing.
- AWS validation reset email was received and the password reset completed successfully.
