# Current Status

Date: 2026-05-27

## Active Workstream

AWS commercial production migration.

## Current Focus

Carry the validated home lab password-reset and UI polish work into AWS.

## Completed Recently

- Password recovery and login refresh were committed/pushed in `7031068 Add tenant password reset flow`.
- Attendance Search and School Day filter polish were committed/pushed in `18a482f Polish attendance and school day filters`.
- Open Items Today count/text fix was committed in `93a6ab8 Align open items count with visible buckets` and deployed to home lab WEB001.
- Attendance Search now has `Start Date` and `End Date` filters, matching Grade Search behavior.
- School Day Filters now use a grouped `Scheduled Item` filter that includes Classes, Courses, and Schedule Blocks.
- Cleaned up the School Day Scheduled Item dropdown with compact two-line option rows and wider menu styling.
- Deployed the UI polish to home lab WEB001 as `app.js?v=202605271700` and `styles.css?v=202605271700`.
- Updated `JOURNAL/2026-05-27.md`.

## Production State

- Home lab production URL: `https://mitchell.navigrader.com/`
- Tenant app assets:
  - `app.js?v=202605271851`
  - `styles.css?v=202605271700`
- WEB001 Attendance Search rollback: `/var/www/home-school-management/rollback/web-attendance-date-range-202605271635.tgz`
- WEB001 School Day Scheduled Item rollback: `/var/www/home-school-management/rollback/web-school-day-scheduled-item-filter-202605271655.tgz`
- WEB001 School Day dropdown cleanup rollback: `/var/www/home-school-management/rollback/web-school-day-scheduled-item-cleanup-202605271700.tgz`
- WEB001 Open Items Today rollback: `/var/www/home-school-management/rollback/web-open-items-gauge-202605271851.tgz`

## AWS Pickup

- Deploy/pull branch `saas-modern-redesign` through `93a6ab8` or later.
- AWS APP001 needs password-reset backend/API/mail changes from `7031068`.
- AWS SQL001 needs migration `032_password_reset_tokens.sql` after the database restore/tenant DB is ready.
- AWS WEB001 needs web assets through `93a6ab8`.
- Set `PUBLIC_APP_BASE_URL` to the AWS domain and configure tenant mail/Postmark runtime values.

## Validation

- `node --check web/app.js` passed.
- `git diff --check` passed.
- Public `https://mitchell.navigrader.com/health` returned HTTP 200.
- Public root references `styles.css?v=202605271700` and `app.js?v=202605271851`.
- Served app script contains `attendance-filter-start-date`, `attendance-filter-end-date`, `school-day-scheduled-item-checkbox`, and `school-day-scheduled-option`.
- Served app script excludes Past Due from the Open Items Today total and summary copy.
- WEB001 deployed SHA-256 hashes matched local `web/index.html`, `web/app.js`, and `web/styles.css`.

## Current Blockers

- None.

## Current Risks

- Do not store Postmark, database, Stripe, smoke credentials, or runtime env files in the repo.
- Untracked local scratch assets and `tmp/` remain outside the intended commit.

## Next Actions

1. Resume AWS migration by updating AWS app code to `93a6ab8` or later.
2. Run migration `032_password_reset_tokens.sql` and configure AWS env/mail values.
3. Smoke AWS health, reset email, login, Attendance Search, School Day Scheduled Item filtering, and the Open Items Today gauge.
