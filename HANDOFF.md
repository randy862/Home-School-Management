# Session Handoff

Date: 2026-05-27

## Context

Home lab production tenant UI polish for Attendance Search and School Day filters.

## Current State

- Password recovery and login refresh were committed/pushed in `7031068 Add tenant password reset flow`.
- Attendance Search now uses `Start Date` and `End Date` filters instead of a single Date filter.
- School Day Filters now use one grouped `Scheduled Item` filter for Classes, Courses, and Schedule Blocks.
- School Day Scheduled Item dropdown uses compact two-line option rows with wider menu styling to avoid overlap.
- Home lab WEB001 is deployed with:
  - `app.js?v=202605271700`
  - `styles.css?v=202605271700`
- Public `https://mitchell.navigrader.com/health` returned HTTP 200.
- WEB001 deployed SHA-256 hashes matched local `web/index.html`, `web/app.js`, and `web/styles.css`.
- Journal entry updated at `JOURNAL/2026-05-27.md`.

## Next Action

Stage, commit, and push the Attendance Search and School Day filter polish.

## Risks

- Keep Postmark, database, Stripe, smoke credentials, and runtime env files out of the repo.
- Untracked scratch screenshots/icons and `tmp/` remain local and should stay out of this commit.

## Rollback

- Attendance Search rollback: `/var/www/home-school-management/rollback/web-attendance-date-range-202605271635.tgz`
- School Day Scheduled Item rollback: `/var/www/home-school-management/rollback/web-school-day-scheduled-item-filter-202605271655.tgz`
- School Day dropdown cleanup rollback: `/var/www/home-school-management/rollback/web-school-day-scheduled-item-cleanup-202605271700.tgz`

## Validation

- `node --check web/app.js`
- `git diff --check`
- Public root references `styles.css?v=202605271700` and `app.js?v=202605271700`.
- Served app script contains `attendance-filter-start-date`, `attendance-filter-end-date`, `school-day-scheduled-item-checkbox`, and `school-day-scheduled-option`.
