# Session Handoff

Date: 2026-05-28

## Context

AWS commercial production migration checkpoint after deploying the current home lab web baseline.

## Current State

- Password recovery/login refresh is committed in `7031068`; tenant-aware reset URLs are committed in `a1e0810` and deployed to home lab APP001.
- Attendance Search date range and School Day grouped Scheduled Item filter are committed in `18a482f`.
- Open Items Today count/text and Past Due Schedule Items gauges are committed in `93a6ab8` and `4f75edc`.
- Home lab WEB001 restored the Schedule Items Open detail gauge in `0b66c4f`.
- Grade Search now uses one grouped `Course/Class/Block` dropdown for Classes, Courses, and Schedule Blocks, anchored as the first field on the second filter row.
- Home lab WEB001 is deployed with `styles.css?v=202605281100` and `app.js?v=202605281030`.
- Public `https://mitchell.navigrader.com/health` returned HTTP 200 after deployment.
- WEB001 deployed SHA-256 hashes matched local `web/index.html`, `web/app.js`, and `web/styles.css`.
- AWS APP001/WEB001 were last updated from branch `saas-modern-redesign` at `cb7b057`.
- AWS WEB001 still needs later web changes, including `0b66c4f`, the Grade Search `Course/Class/Block` filter, and the dropdown layout/clipping CSS hotfixes.
- AWS SQL001 migration `032_password_reset_tokens.sql` was applied to `public` and `tenant_aws_validation`.
- AWS `awsadmin` password reset email delivery and reset-complete flow were validated successfully.
- GoDaddy DNS points `aws-validation.navigrader.com` to AWS `18.188.35.157`.
- Temporary AWS NAT Gateway cleanup is complete: private NAT route removed, gateway deleted, temporary Elastic IP released.
- AWS APP001 CORS allows `http://aws-validation.navigrader.com`; env rollback is `/home/admin/rollback/hsm/aws-validation-cors-202605280150/app001/hsm-api.env.before`.
- Journal entry updated at `JOURNAL/2026-05-28.md`.

## Next Action

Restart the needed AWS hosts if stopped, deploy AWS WEB001 from the latest branch, then smoke AWS login, password reset, Attendance Search, School Day Scheduled Item filtering, Grade Search `Course/Class/Block` filtering, dashboard gauges, and health endpoints.

## Risks

- Keep Postmark, database, Stripe, smoke credentials, and runtime env files out of the repo.
- Untracked scratch screenshots/icons and `tmp/` remain local and should stay out of commits.

## Rollback

- Grade Search `Course/Class/Block` rollback: `/home/debian/rollback/hsm/web-grade-search-scheduled-item-filter-202605281030/web001/web.tgz`
- Grade Search dropdown clipping rollback: `/home/debian/rollback/hsm/web-grade-search-dropdown-clip-202605281045/web001/web.tgz`
- Grade Search filter row layout rollback: `/home/debian/rollback/hsm/web-grade-search-filter-row-layout-202605281100/web001/web.tgz`
- Schedule Items Open gauge hotfix rollback: `/home/debian/rollback/hsm/web-open-items-schedule-card-202605280915/web001/web.tgz`
- Tenant-aware password reset link rollback: `/home/debian/rollback/hsm/password-reset-tenant-url-202605272030/app001/server/src/routes/auth-routes.js`
- AWS APP001 rollback: `/home/admin/rollback/hsm/aws-cb7b057-202605272003/app001/server.tgz`
- AWS WEB001 rollback: `/var/www/home-school-management/rollback/aws-cb7b057-202605272003/web001/web.tgz`
- AWS SQL001 pre-migration schema backup: `/home/admin/rollback/hsm/aws-cb7b057-202605272003/sql001/appdb-schema-before-032.sql`
- AWS runtime env rollback: `/home/admin/rollback/hsm/aws-runtime-mail-202605272015/app001/`
- AWS validation tenant init backup: `/home/admin/rollback/hsm/aws-validation-init-202605272015/app001/aws-validation-before-init-data.sql`

## Validation

- `node --check web/app.js` passed.
- `git diff --check` passed with only LF/CRLF warnings.
- Public root references `styles.css?v=202605281100` and `app.js?v=202605281030`.
- Served app script contains Grade Search `Course/Class/Block`, Attendance date filters, School Day Scheduled Item markers, `Schedule Items Open`, and `Past Due Schedule Items`.
- Served CSS contains Grade Search scheduled item dropdown styling.
- Served CSS allows the Grade Search filter panel to overflow visibly so the dropdown is not clipped.
- Served CSS places the Grade Search `Course/Class/Block` field first on the second filter row.
- Public `https://mitchell.navigrader.com/health` returned HTTP 200.
- AWS validation reset email was received and reset-complete succeeded before cost-control cleanup.
