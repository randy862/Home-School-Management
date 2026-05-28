# Session Handoff

Date: 2026-05-27

## Context

Home lab production checkpoint to carry forward into the AWS commercial production migration.

## Current State

- Password recovery and login refresh were committed/pushed in `7031068 Add tenant password reset flow`.
- Attendance Search and School Day filter polish were committed/pushed in `18a482f Polish attendance and school day filters`.
- Open Items Today count/text fix was committed in `93a6ab8 Align open items count with visible buckets`.
- Past Due Schedule Items detail gauge was committed in `4f75edc Add past due schedule items gauge`.
- Home lab APP001/WEB001 are deployed and validated through `4f75edc`.
- AWS migration pickup must include `7031068`, `18a482f`, `93a6ab8`, and `4f75edc`.
- AWS APP001 needs the password reset backend/API/mail changes from `7031068`.
- AWS SQL001 needs migration `032_password_reset_tokens.sql` after the database restore/tenant DB is ready.
- AWS WEB001 needs web assets through `4f75edc`, including the compact login/reset UI, filter polish, Open Items Today gauge fix, and Past Due Schedule Items gauge.
- AWS runtime env must set `PUBLIC_APP_BASE_URL` to the AWS domain and configure the tenant mail/Postmark values.
- Attendance Search now uses `Start Date` and `End Date` filters instead of a single Date filter.
- School Day Filters now use one grouped `Scheduled Item` filter for Classes, Courses, and Schedule Blocks.
- School Day Scheduled Item dropdown uses compact two-line option rows with wider menu styling to avoid overlap.
- Home lab WEB001 is deployed with:
  - `app.js?v=202605271906`
  - `styles.css?v=202605271700`
- Public `https://mitchell.navigrader.com/health` returned HTTP 200.
- WEB001 deployed SHA-256 hashes matched local `web/index.html`, `web/app.js`, and `web/styles.css`.
- Journal entry updated at `JOURNAL/2026-05-27.md`.

## Next Action

Resume AWS migration by deploying/pulling `saas-modern-redesign` through `4f75edc` or later, then run migration `032_password_reset_tokens.sql` and smoke the reset/login/filter flows.

## Risks

- Keep Postmark, database, Stripe, smoke credentials, and runtime env files out of the repo.
- Untracked scratch screenshots/icons and `tmp/` remain local and should stay out of this commit.

## Rollback

- Attendance Search rollback: `/var/www/home-school-management/rollback/web-attendance-date-range-202605271635.tgz`
- School Day Scheduled Item rollback: `/var/www/home-school-management/rollback/web-school-day-scheduled-item-filter-202605271655.tgz`
- School Day dropdown cleanup rollback: `/var/www/home-school-management/rollback/web-school-day-scheduled-item-cleanup-202605271700.tgz`
- Open Items Today rollback: `/var/www/home-school-management/rollback/web-open-items-gauge-202605271851.tgz`
- Past Due Schedule Items gauge rollback: `/var/www/home-school-management/rollback/web-past-due-schedule-gauge-202605271906.tgz`

## Validation

- `node --check web/app.js`
- `git diff --check`
- Public root references `styles.css?v=202605271700` and `app.js?v=202605271906`.
- Served app script contains `attendance-filter-start-date`, `attendance-filter-end-date`, `school-day-scheduled-item-checkbox`, and `school-day-scheduled-option`.
- Served app script contains `Past Due Schedule Items` and still excludes Past Due from the overview Open Items Today total and summary copy.
