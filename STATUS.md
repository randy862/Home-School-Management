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
- Marking a student absent now automatically excuses that student's scheduled/open classes for that date.
- Home lab WEB001 is deployed with `styles.css?v=202605281100` and `app.js?v=202605291030`.
- Home lab APP001 has the updated curriculum validation wording deployed.
- AWS validation password reset email was received and reset-complete succeeded.
- Temporary AWS NAT Gateway egress was removed after validation.
- Updated `JOURNAL/2026-05-29.md`.

## Production State

- Home lab production URL: `https://mitchell.navigrader.com/`
- Tenant app assets:
  - `app.js?v=202605291030`
  - `styles.css?v=202605281100`
- Course minutes/day rollback root: `/home/debian/rollback/hsm/course-minutes-day-202605291000/`
- Attendance absent auto-excuse rollback: `/home/debian/rollback/hsm/attendance-absent-auto-excuse-202605291030/web001/web.tgz`
- APP001 tenant-aware password reset link rollback: `/home/debian/rollback/hsm/password-reset-tenant-url-202605272030/app001/server/src/routes/auth-routes.js`

## AWS Pickup

- AWS APP001/WEB001 are deployed through `cb7b057`.
- AWS APP001/WEB001 should be updated from the latest `saas-modern-redesign` branch before go-live validation.
- AWS pickup must include password reset, dashboard gauges, filter changes, Grade Search layout, Course minutes/day UI, and attendance-driven excusals.
- AWS SQL001 has migration `032_password_reset_tokens.sql` applied to existing schemas.
- AWS rollback bundle root: `/home/admin/rollback/hsm/aws-cb7b057-202605272003/`.
- AWS runtime env rollback: `/home/admin/rollback/hsm/aws-runtime-mail-202605272015/app001/`.
- AWS validation tenant init backup: `/home/admin/rollback/hsm/aws-validation-init-202605272015/app001/aws-validation-before-init-data.sql`.
- Temporary NAT Gateway cleanup is complete; private subnet should no longer have a default internet route.

## Validation

- `node --check web/app.js` passed.
- `node --check server/src/services/curriculum-service.js` passed.
- `git diff --check` passed with only LF/CRLF warnings.
- Public `https://mitchell.navigrader.com/health` returned HTTP 200.
- APP001 local `http://127.0.0.1:3000/health` returned HTTP 200.
- Public root references `styles.css?v=202605281100` and `app.js?v=202605291030`.
- Served app script contains attendance-driven auto-excusal helpers.
- Served app script contains `Minutes/Day`, minutes conversion helpers, and the class inherited minutes/day marker.
- WEB001/APP001 deployed SHA-256 hashes matched local changed files.
- AWS public HTTP health, setup status, and control health previously returned HTTP 200 with Host `aws-validation.navigrader.com`.
- AWS deployed tenant reset URL assertion produced `https://aws-validation.navigrader.com/#resetToken=...`.
- AWS validation password reset email was received and reset-complete succeeded.

## Current Blockers

- None.

## Current Risks

- Do not store Postmark, database, Stripe, smoke credentials, or runtime env files in the repo.
- Untracked local scratch assets and `tmp/` remain outside intended commits.

## Next Actions

1. Restart the needed AWS hosts if stopped.
2. Deploy AWS APP001/WEB001 from the latest `saas-modern-redesign` branch.
3. Smoke AWS login, password reset, Course minutes/day editing, absent-to-excused attendance, School Day filtering, Grade Search filtering, dashboard gauges, and health endpoints.
4. Continue AWS DNS/TLS planning for go-live readiness.
