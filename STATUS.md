# Current Status

Date: 2026-05-28

## Active Workstream

AWS commercial production migration.

## Current Focus

Keep home lab production current while preparing AWS go-live validation.

## Completed Recently

- Password recovery and login refresh were committed/pushed in `7031068`.
- Tenant-aware password reset links were committed in `a1e0810` and deployed to home lab APP001.
- Attendance Search has `Start Date` and `End Date` filters.
- School Day Filters use one grouped `Scheduled Item` filter for Classes, Courses, and Schedule Blocks.
- School Day Scheduled Item dropdown uses compact two-line option rows with wider menu styling.
- Open Items Today excludes Past Due from the count/text and keeps Past Due as a separate detail gauge.
- Execution dashboard includes both `Schedule Items Open` and `Past Due Schedule Items` gauges.
- Grade Search now has a grouped `Course/Class/Block` dropdown using Classes, Courses, and Schedule Blocks.
- Home lab WEB001 is deployed with `styles.css?v=202605281030` and `app.js?v=202605281030`.
- AWS SQL001 migration `032_password_reset_tokens.sql` was applied to `public` and `tenant_aws_validation`.
- AWS APP001 runtime/mail env was configured for `http://aws-validation.navigrader.com` with Postmark `allowlist_only`.
- AWS validation tenant was initialized with admin `awsadmin` and email `randy862@gmail.com`.
- AWS APP001 CORS allows `http://aws-validation.navigrader.com`.
- AWS validation reset email was received and the reset-complete flow succeeded.
- GoDaddy DNS points `aws-validation.navigrader.com` to AWS `18.188.35.157`.
- Temporary NAT Gateway egress was removed after validation.
- Updated `JOURNAL/2026-05-28.md`.

## Production State

- Home lab production URL: `https://mitchell.navigrader.com/`
- Tenant app assets:
  - `app.js?v=202605281030`
  - `styles.css?v=202605281030`
- WEB001 Grade Search rollback: `/home/debian/rollback/hsm/web-grade-search-scheduled-item-filter-202605281030/web001/web.tgz`
- WEB001 Schedule Items Open rollback: `/home/debian/rollback/hsm/web-open-items-schedule-card-202605280915/web001/web.tgz`
- APP001 tenant-aware password reset link rollback: `/home/debian/rollback/hsm/password-reset-tenant-url-202605272030/app001/server/src/routes/auth-routes.js`

## AWS Pickup

- AWS APP001/WEB001 are deployed through `cb7b057`.
- AWS WEB001 should be updated from the latest `saas-modern-redesign` branch before go-live validation.
- AWS WEB001 pickup must include the restored Schedule Items Open gauge and Grade Search `Course/Class/Block` filter.
- AWS SQL001 has migration `032_password_reset_tokens.sql` applied to existing schemas.
- AWS rollback bundle root: `/home/admin/rollback/hsm/aws-cb7b057-202605272003/`.
- AWS runtime env rollback: `/home/admin/rollback/hsm/aws-runtime-mail-202605272015/app001/`.
- AWS validation tenant init backup: `/home/admin/rollback/hsm/aws-validation-init-202605272015/app001/aws-validation-before-init-data.sql`.
- AWS validation CORS env rollback: `/home/admin/rollback/hsm/aws-validation-cors-202605280150/app001/hsm-api.env.before`.
- Temporary NAT Gateway cleanup is complete; private subnet should no longer have a default internet route.

## Validation

- `node --check web/app.js` passed.
- `git diff --check` passed with only LF/CRLF warnings.
- Public `https://mitchell.navigrader.com/health` returned HTTP 200.
- Public root references `styles.css?v=202605281030` and `app.js?v=202605281030`.
- Served app script contains `grades-filter-scheduled-item-checkbox` and `Course/Class/Block`.
- Served app script still contains Attendance date filters, School Day Scheduled Item markers, `Schedule Items Open`, and `Past Due Schedule Items`.
- Served CSS contains Grade Search scheduled item dropdown styling.
- WEB001 deployed SHA-256 hashes matched local `web/index.html`, `web/app.js`, and `web/styles.css`.
- AWS public HTTP health, setup status, and control health returned HTTP 200 with Host `aws-validation.navigrader.com`.
- AWS deployed tenant reset URL assertion produced `https://aws-validation.navigrader.com/#resetToken=...`.
- AWS tenant API/control API env summaries showed Postmark tokens set, `allowlist_only`, and `PUBLIC_APP_BASE_URL=http://aws-validation.navigrader.com`.
- AWS setup status returned initialized true for Host `aws-validation.navigrader.com`.
- AWS validation password reset email was received and reset-complete succeeded.

## Current Blockers

- None.

## Current Risks

- Do not store Postmark, database, Stripe, smoke credentials, or runtime env files in the repo.
- Untracked local scratch assets and `tmp/` remain outside intended commits.

## Next Actions

1. Restart the needed AWS hosts if stopped.
2. Deploy AWS WEB001 from the latest `saas-modern-redesign` branch.
3. Smoke AWS login, password reset, Attendance Search, School Day Scheduled Item filtering, Grade Search `Course/Class/Block` filtering, dashboard gauges, and health endpoints.
4. Continue AWS DNS/TLS planning for go-live readiness.
