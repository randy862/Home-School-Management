# Current Status

Date: 2026-05-28

## Active Workstream

AWS commercial production migration.

## Current Focus

Resume AWS go-live readiness after successful validation and cost-control cleanup.

## Completed Recently

- Password recovery and login refresh were committed/pushed in `7031068 Add tenant password reset flow`.
- Attendance Search and School Day filter polish were committed/pushed in `18a482f Polish attendance and school day filters`.
- Open Items Today count/text fix was committed in `93a6ab8 Align open items count with visible buckets` and deployed to home lab WEB001.
- Past Due Schedule Items detail gauge was committed in `4f75edc Add past due schedule items gauge` and deployed to home lab WEB001.
- Restored the missing home lab `Schedule Items Open` detail gauge and deployed `app.js?v=202605280915`.
- Tenant-aware password reset links were committed in `a1e0810 Use tenant URL for password reset links` and deployed to home lab APP001.
- AWS APP001/WEB001 were updated from branch `saas-modern-redesign` at `cb7b057`.
- AWS SQL001 migration `032_password_reset_tokens.sql` was applied to `public` and `tenant_aws_validation`.
- AWS APP001 runtime/mail env was configured for `http://aws-validation.navigrader.com` with Postmark `allowlist_only`.
- AWS validation tenant was initialized with admin `awsadmin` and email `randy862@gmail.com`.
- GoDaddy DNS now points `aws-validation.navigrader.com` to AWS `18.188.35.157`.
- Temporary NAT Gateway egress was added so APP001 could reach Postmark.
- Temporary NAT Gateway egress was removed after validation: NAT route removed, gateway deleted, and temporary Elastic IP released.
- Temporary Windows hosts override was removed after normal DNS resolved `aws-validation.navigrader.com` to AWS.
- AWS APP001 CORS now allows `http://aws-validation.navigrader.com`.
- AWS validation reset email was received and the reset-complete flow succeeded.
- Attendance Search now has `Start Date` and `End Date` filters, matching Grade Search behavior.
- School Day Filters now use a grouped `Scheduled Item` filter that includes Classes, Courses, and Schedule Blocks.
- Cleaned up the School Day Scheduled Item dropdown with compact two-line option rows and wider menu styling.
- Deployed the UI polish to home lab WEB001 as `app.js?v=202605271700` and `styles.css?v=202605271700`.
- Updated `JOURNAL/2026-05-27.md`.

## Production State

- Home lab production URL: `https://mitchell.navigrader.com/`
- Tenant app assets:
  - `app.js?v=202605280915`
  - `styles.css?v=202605271700`
- WEB001 Attendance Search rollback: `/var/www/home-school-management/rollback/web-attendance-date-range-202605271635.tgz`
- WEB001 School Day Scheduled Item rollback: `/var/www/home-school-management/rollback/web-school-day-scheduled-item-filter-202605271655.tgz`
- WEB001 School Day dropdown cleanup rollback: `/var/www/home-school-management/rollback/web-school-day-scheduled-item-cleanup-202605271700.tgz`
- WEB001 Open Items Today rollback: `/var/www/home-school-management/rollback/web-open-items-gauge-202605271851.tgz`
- WEB001 Past Due Schedule Items gauge rollback: `/var/www/home-school-management/rollback/web-past-due-schedule-gauge-202605271906.tgz`
- WEB001 Schedule Items Open gauge hotfix rollback: `/home/debian/rollback/hsm/web-open-items-schedule-card-202605280915/web001/web.tgz`
- APP001 tenant-aware password reset link rollback: `/home/debian/rollback/hsm/password-reset-tenant-url-202605272030/app001/server/src/routes/auth-routes.js`

## AWS Pickup

- AWS APP001/WEB001 are deployed through `cb7b057`.
- AWS SQL001 has migration `032_password_reset_tokens.sql` applied to existing schemas.
- AWS rollback bundle root: `/home/admin/rollback/hsm/aws-cb7b057-202605272003/`.
- AWS runtime env rollback: `/home/admin/rollback/hsm/aws-runtime-mail-202605272015/app001/`.
- AWS validation tenant init backup: `/home/admin/rollback/hsm/aws-validation-init-202605272015/app001/aws-validation-before-init-data.sql`.
- AWS validation CORS env rollback: `/home/admin/rollback/hsm/aws-validation-cors-202605280150/app001/hsm-api.env.before`.
- Temporary NAT Gateway cleanup is complete; private subnet should no longer have a default internet route.

## Validation

- `node --check web/app.js` passed.
- `git diff --check` passed.
- Public `https://mitchell.navigrader.com/health` returned HTTP 200.
- Public root references `styles.css?v=202605271700` and `app.js?v=202605280915`.
- Served app script contains `attendance-filter-start-date`, `attendance-filter-end-date`, `school-day-scheduled-item-checkbox`, and `school-day-scheduled-option`.
- Served app script contains `Schedule Items Open` and `Past Due Schedule Items`, and still excludes Past Due from the overview Open Items Today total and summary copy.
- Deployed APP001 password reset URL assertion produces `https://pj-cool.navigrader.com/#resetToken=...` even when global config points at Mitchell.
- WEB001 deployed SHA-256 hashes matched local `web/index.html`, `web/app.js`, and `web/styles.css`.
- AWS public HTTP health, setup status, and control health returned HTTP 200 with Host `aws-validation.navigrader.com`.
- AWS deployed tenant reset URL assertion produced `https://aws-validation.navigrader.com/#resetToken=...`.
- AWS tenant API/control API env summaries show Postmark tokens set, `allowlist_only`, and `PUBLIC_APP_BASE_URL=http://aws-validation.navigrader.com`.
- AWS setup status now returns initialized true for Host `aws-validation.navigrader.com`.
- APP001 reached Postmark through the temporary NAT Gateway.
- AWS validation password reset email was received and reset-complete succeeded.
- Normal Windows DNS resolves `aws-validation.navigrader.com` to `18.188.35.157` after hosts override removal.

## Current Blockers

- None.

## Current Risks

- Do not store Postmark, database, Stripe, smoke credentials, or runtime env files in the repo.
- Untracked local scratch assets and `tmp/` remain outside the intended commit.

## Next Actions

1. If EC2 instances were stopped for cost control, restart the needed AWS hosts.
2. Smoke AWS login, Attendance Search, School Day Scheduled Item filtering, Open Items Today gauge, and Past Due Schedule Items gauge.
3. Continue AWS DNS/TLS planning for go-live readiness.
