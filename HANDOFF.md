# Session Handoff

Date: 2026-05-29

## Context

Home lab production UI refinement and AWS commercial production migration carry-forward.

## Current State

- Password recovery/login refresh is committed in `7031068`; tenant-aware reset URLs are committed in `a1e0810` and deployed to home lab APP001.
- Attendance Search date range and School Day grouped Scheduled Item filter are committed in `18a482f`.
- Open Items Today count/text, Past Due Schedule Items, and Schedule Items Open gauges are deployed to home lab WEB001.
- Grade Search uses one grouped `Course/Class/Block` dropdown, anchored as the first field on the second filter row.
- Curriculum Courses now use `Minutes / Day` in the UI; saved values still use the existing internal `hoursPerDay` field.
- Class metadata now displays the inherited course minutes/day value.
- Marking a student absent now automatically excuses that student's scheduled/open classes for that date.
- Home lab WEB001 is deployed with `styles.css?v=202605281100` and `app.js?v=202605291030`.
- Home lab APP001 has the neutral curriculum validation message deployed.
- Public `https://mitchell.navigrader.com/health` and APP001 local health returned HTTP 200 after deployment.
- WEB001/APP001 deployed SHA-256 hashes matched local changed files.
- AWS APP001/WEB001 were updated from branch `saas-modern-redesign` at `1272ab3`.
- AWS now includes password reset, dashboard gauges, filter changes, Grade Search layout, Course minutes/day UI, and attendance-driven excusals.
- AWS SQL001 migration `032_password_reset_tokens.sql` was applied to `public` and `tenant_aws_validation`.
- AWS migration check confirmed tenant/runtime migrations through `032` and control-plane migrations through `012`.
- AWS control API CORS now allows `http://aws-validation.navigrader.com`.
- AWS validation tenant has one initialized admin user with email, but no curriculum/student/demo data yet.
- AWS validation control metadata was synced to `setup_state='initialized'`.
- HTTPS/TLS is enabled for `aws-validation.navigrader.com`; HTTP redirects to HTTPS.
- AWS runtime public base URLs and validation tenant `app_base_url` now use `https://aws-validation.navigrader.com`.
- AWS HTTPS login succeeded.
- Temporary NAT via MAINT001 was used for APP001 private egress, then cleaned up after password recovery validation.
- AWS HTTPS password recovery succeeded after temporary NAT was enabled.
- Mitchell AWS validation tenant restored to `tenant_mitchell_aws_validation` and mapped to `mitchell-aws-validation.navigrader.com`.
- GoDaddy A record `mitchell-aws-validation -> 18.188.35.157` is added and public DNS resolves to AWS.
- TLS is issued for `aws-validation.navigrader.com` plus `mitchell-aws-validation.navigrader.com`; HTTP redirects preserve the requested host.
- Local SSH aliases were created in `C:/Users/rmitchell/.ssh/config`: `aws-maint`, `aws-app`, `aws-web`, and `aws-sql`.

## Next Action

Decide AWS production egress for mail/password reset, then continue production DNS go-live planning.

## Risks

- Keep Postmark, database, Stripe, smoke credentials, and runtime env files out of the repo.
- `aws-maint` uses public IP `3.138.124.78`; update the local SSH config if `MAINT001` is stopped/started without a stable Elastic IP.
- Untracked scratch screenshots/icons and `tmp/` remain local and should stay out of commits.

## Rollback

- Course minutes/day rollback: `/home/debian/rollback/hsm/course-minutes-day-202605291000/`
- Attendance absent auto-excuse rollback: `/home/debian/rollback/hsm/attendance-absent-auto-excuse-202605291030/web001/web.tgz`
- Grade Search row layout rollback: `/home/debian/rollback/hsm/web-grade-search-filter-row-layout-202605281100/web001/web.tgz`
- Tenant-aware password reset link rollback: `/home/debian/rollback/hsm/password-reset-tenant-url-202605272030/app001/server/src/routes/auth-routes.js`
- AWS rollback bundle root: `/home/admin/rollback/hsm/aws-cb7b057-202605272003/`
- AWS latest branch deploy rollback root: `/home/admin/rollback/hsm/hsm-aws-1272ab3-202605291805/`
- AWS runtime env rollback: `/home/admin/rollback/hsm/aws-runtime-mail-202605272015/app001/`
- AWS control CORS rollback: `/home/admin/rollback/hsm/aws-runtime-config-202605291335/app001/hsm-control-api.env.before-cors`
- AWS TLS rollback root: `/home/admin/rollback/hsm/aws-validation-tls-202605291405/web001/`
- AWS HTTPS runtime rollback root: `/home/admin/rollback/hsm/aws-validation-https-runtime-202605291410/`
- AWS HTTPS control CORS rollback: `/home/admin/rollback/hsm/aws-validation-https-cors-202605291415/app001/hsm-control-api.env.before-https-cors`
- AWS validation tenant init backup: `/home/admin/rollback/hsm/aws-validation-init-202605272015/app001/aws-validation-before-init-data.sql`
- AWS validation metadata rollback: `/home/admin/rollback/hsm/aws-validation-data-metadata-202605291345/sql001/tenant_environments.before.sql`
- AWS Mitchell validation restore/CORS rollback roots: `/home/admin/rollback/hsm/aws-mitchell-validation-restore-202605291545/` and `/home/admin/rollback/hsm/aws-mitchell-validation-cors-202605291545/app001/`
- AWS Mitchell validation TLS/redirect rollback roots: `/home/admin/rollback/hsm/mitchell-aws-validation-tls-202605291953/` and `/home/admin/rollback/hsm/mitchell-aws-validation-http-redirect-202605291957/`

## Validation

- `node --check web/app.js` passed.
- `node --check server/src/services/curriculum-service.js` passed.
- `git diff --check` passed with only LF/CRLF warnings.
- Public root references `styles.css?v=202605281100` and `app.js?v=202605291030`.
- Served app script contains attendance-driven auto-excusal helpers.
- Served app script contains `Minutes/Day`, minutes conversion helpers, and Class inherited minutes/day metadata.
- Public `https://mitchell.navigrader.com/health` returned HTTP 200.
- APP001 local `http://127.0.0.1:3000/health` returned HTTP 200.
- Deployed hashes matched local `web/index.html`, `web/app.js`, and `server/src/services/curriculum-service.js`.
- AWS deployed hashes matched local `web/index.html`, `web/app.js`, `web/styles.css`, and `server/src/services/curriculum-service.js`.
- AWS public `/health`, `/control-api/health`, and `/api/setup/status` returned HTTP 200.
- AWS tenant CORS and control CORS return `Access-Control-Allow-Origin: http://aws-validation.navigrader.com`.
- AWS HTTPS `/health`, `/control-api/health`, and `/api/setup/status` returned HTTP 200; HTTP `/health` returns 301 to HTTPS.
- AWS tenant CORS and control CORS return `Access-Control-Allow-Origin: https://aws-validation.navigrader.com`.
- AWS APP001 logs show password reset mail failures with `request_timeout`; `curl https://api.postmarkapp.com/` from APP001 times out on TCP/443.
- Temporary NAT rollback root on MAINT001: `/home/admin/rollback/hsm/temp-nat-maint001-202605291455`.
- After temporary NAT setup, APP001 `curl -I https://api.postmarkapp.com/` returned HTTP 302 and `checkip.amazonaws.com` returned `3.138.124.78`.
- AWS HTTPS password recovery reset-complete succeeded after temporary NAT was enabled.
- Temporary NAT cleanup completed; MAINT001 `net.ipv4.ip_forward=0`, NAT rules are removed, and APP001 Postmark egress times out again as expected.
- Forced AWS host resolution for `mitchell-aws-validation.navigrader.com` returned setup initialized, correct CORS, valid HTTPS, HTTP-to-HTTPS redirect, correct asset versions, expected restored row counts, and no recent API/control warnings; browser smoke succeeded.
