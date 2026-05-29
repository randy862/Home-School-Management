# Current Status

Date: 2026-05-29

## Active Workstream

Home lab production polish and AWS commercial production migration.

## Current Focus

Keep home lab production current while preparing AWS go-live validation.

## Completed Recently

- Password recovery/login refresh and tenant-aware reset URLs are committed and deployed to home lab APP001.
- Attendance Search has `Start Date` and `End Date` filters.
- School Day Filters use one grouped `Scheduled Item` filter for Classes, Courses, and Schedule Blocks.
- Open Items Today excludes Past Due from the count/text and keeps Past Due as a separate detail gauge.
- Execution dashboard includes both `Schedule Items Open` and `Past Due Schedule Items` gauges.
- Grade Search has a grouped `Course/Class/Block` dropdown, anchored first on the second filter row.
- Curriculum Courses now show `Minutes / Day`; saves convert minutes to the existing internal `hoursPerDay`.
- Class metadata now shows the inherited course minutes/day duration.
- Marking a student absent now automatically excuses that student's scheduled/open classes for that date without generating duplicate Flex Blocks; user confirmed the fix in home lab and AWS.
- Home lab WEB001 is deployed with `styles.css?v=202605281100` and `app.js?v=202605291610`.
- Home lab APP001 has the updated curriculum validation wording deployed.
- AWS validation password reset email was received and reset-complete succeeded.
- Temporary AWS NAT Gateway egress was removed after validation.
- Updated `JOURNAL/2026-05-29.md`.

## Production State

- Home lab production URL: `https://mitchell.navigrader.com/`
- Tenant app assets:
  - `app.js?v=202605291610`
  - `styles.css?v=202605281100`
- Course minutes/day rollback root: `/home/debian/rollback/hsm/course-minutes-day-202605291000/`
- Attendance absent/excused Flex Block rollback: `/home/debian/rollback/hsm/school-day-excused-flex-202605291610/web001/`
- APP001 tenant-aware password reset link rollback: `/home/debian/rollback/hsm/password-reset-tenant-url-202605272030/app001/server/src/routes/auth-routes.js`

## AWS Pickup

- AWS APP001/WEB001 are deployed through `1272ab3`.
- AWS restored Mitchell browser smoke succeeded; pickup now moves to production egress and DNS go-live planning.
- AWS deploy includes password reset, dashboard gauges, filter changes, Grade Search layout, Course minutes/day UI, and attendance-driven excusals without duplicate Flex Blocks.
- AWS SQL001 has tenant/runtime migrations through `032` and control-plane migrations through `012` verified.
- AWS validation tenant has one initialized admin user with email, but no curriculum/student/demo data yet.
- AWS validation control metadata is synced to `setup_state='initialized'`.
- HTTPS/TLS is enabled for `aws-validation.navigrader.com`; HTTP redirects to HTTPS.
- AWS runtime public base URLs and validation tenant `app_base_url` now use `https://aws-validation.navigrader.com`.
- AWS HTTPS login succeeded.
- Temporary NAT via MAINT001 was used for APP001 private egress, then cleaned up after password recovery validation.
- AWS HTTPS password recovery succeeded after temporary NAT was enabled.
- Mitchell AWS validation tenant restored to `tenant_mitchell_aws_validation` and mapped to `mitchell-aws-validation.navigrader.com`.
- GoDaddy A record `mitchell-aws-validation -> 18.188.35.157` is added and public DNS resolves to AWS.
- TLS is issued for `aws-validation.navigrader.com` plus `mitchell-aws-validation.navigrader.com`; HTTP redirects preserve the requested host.
- AWS rollback bundle root: `/home/admin/rollback/hsm/aws-cb7b057-202605272003/`.
- AWS latest branch deploy rollback root: `/home/admin/rollback/hsm/hsm-aws-1272ab3-202605291805/`; latest WEB001 fix rollback: `/home/admin/rollback/hsm/school-day-excused-flex-202605291610/web001/`.
- AWS runtime env rollback: `/home/admin/rollback/hsm/aws-runtime-mail-202605272015/app001/`.
- AWS control CORS rollback: `/home/admin/rollback/hsm/aws-runtime-config-202605291335/app001/hsm-control-api.env.before-cors`.
- AWS TLS rollback root: `/home/admin/rollback/hsm/aws-validation-tls-202605291405/web001/`.
- AWS HTTPS runtime rollback root: `/home/admin/rollback/hsm/aws-validation-https-runtime-202605291410/`.
- AWS HTTPS control CORS rollback: `/home/admin/rollback/hsm/aws-validation-https-cors-202605291415/app001/hsm-control-api.env.before-https-cors`.
- AWS validation tenant init backup: `/home/admin/rollback/hsm/aws-validation-init-202605272015/app001/aws-validation-before-init-data.sql`.
- AWS validation metadata rollback: `/home/admin/rollback/hsm/aws-validation-data-metadata-202605291345/sql001/tenant_environments.before.sql`.
- AWS Mitchell validation restore/CORS rollback roots: `/home/admin/rollback/hsm/aws-mitchell-validation-restore-202605291545/` and `/home/admin/rollback/hsm/aws-mitchell-validation-cors-202605291545/app001/`.
- AWS Mitchell validation TLS/redirect rollback roots: `/home/admin/rollback/hsm/mitchell-aws-validation-tls-202605291953/` and `/home/admin/rollback/hsm/mitchell-aws-validation-http-redirect-202605291957/`.
- Local SSH aliases are configured on this workstation: `aws-maint`, `aws-app`, `aws-web`, and `aws-sql`.
- Temporary NAT Gateway cleanup is complete; private subnet should no longer have a default internet route.

## Validation

- `node --check web/app.js` passed.
- `node --check server/src/services/curriculum-service.js` passed.
- `git diff --check` passed with only LF/CRLF warnings.
- Public `https://mitchell.navigrader.com/health` returned HTTP 200.
- APP001 local `http://127.0.0.1:3000/health` returned HTTP 200.
- Public root references `styles.css?v=202605281100` and `app.js?v=202605291610`.
- Served app script contains attendance-driven auto-excusal helpers.
- Served app script contains `Minutes/Day`, minutes conversion helpers, and the class inherited minutes/day marker.
- WEB001/APP001 deployed SHA-256 hashes matched local changed files.
- AWS public HTTP health, setup status, and control health previously returned HTTP 200 with Host `aws-validation.navigrader.com`.
- AWS deployed hashes matched local `web/index.html`, `web/app.js`, `web/styles.css`, and `server/src/services/curriculum-service.js`.
- AWS public `/health`, `/control-api/health`, and `/api/setup/status` returned HTTP 200 after the latest deploy.
- AWS tenant CORS and control CORS return `Access-Control-Allow-Origin: http://aws-validation.navigrader.com`.
- AWS HTTPS `/health`, `/control-api/health`, and `/api/setup/status` returned HTTP 200; HTTP `/health` returns 301 to HTTPS.
- AWS tenant CORS and control CORS return `Access-Control-Allow-Origin: https://aws-validation.navigrader.com`.
- AWS APP001 logs show password reset mail failures with `request_timeout`; `curl https://api.postmarkapp.com/` from APP001 times out on TCP/443.
- AWS deployed tenant reset URL assertion produced `https://aws-validation.navigrader.com/#resetToken=...`.
- AWS validation password reset email was received and reset-complete succeeded.
- AWS HTTPS password recovery reset-complete succeeded after temporary NAT was enabled.
- Temporary NAT cleanup completed; MAINT001 `net.ipv4.ip_forward=0`, NAT rules are removed, and APP001 Postmark egress times out again as expected.
- Forced AWS host resolution for `mitchell-aws-validation.navigrader.com` returned setup initialized, correct CORS, valid HTTPS, HTTP-to-HTTPS redirect, correct asset versions, expected restored row counts, and no recent API/control warnings.
- Browser smoke at `https://mitchell-aws-validation.navigrader.com` succeeded after DNS/cache cleared.

## Current Blockers

- None.

## Current Risks

- Do not store Postmark, database, Stripe, smoke credentials, or runtime env files in the repo.
- `aws-maint` currently points to public IP `3.138.124.78`; update `C:/Users/rmitchell/.ssh/config` if `MAINT001` receives a new public IP.
- Untracked local scratch assets and `tmp/` remain outside intended commits.

## Next Actions

1. Decide AWS production egress for mail/password reset.
2. Continue production DNS go-live planning.
3. Plan go-live rehearsal and rollback procedure.
