# Current Status

Date: 2026-05-08

## Active Workstream

Modern app preview refinement.

## Current Focus

Dashboard Performance alert and trend-chart polish in `/modern-preview/`.

## Completed Recently

- Course Watchlist was modernized to match Student Performance styling.
- Student Performance average display, letter grade, and color tone now use consistent one-decimal rounding.
- Grade Type Volume was restyled to match the latest target design.
- Grade Type Volume now has icon filters, value-labeled bars, summary totals, and a working chart/table toggle.
- Grade Type Volume order is Assignment, Quiz, Test, Quarter Final.
- Grade Type Volume Y-axis and Quarter filter width issues were fixed.
- Grade Risk was split into Average Grade Risk and Single Grade Risk with separate thresholds.
- Instruction Hours Per Month and Instruction Days Per Month now match Student Grade Trending style.
- Student, Instructor, and Instruction trend charts now use month-wide hover summaries.
- Updated preview files were deployed to WEB001 `/var/www/home-school-management/web/modern-preview/`.
- Workspace alert config normalizer was deployed to APP001 and `hsm-api.service` was restarted.

## Current Blockers

None.

## Current Risks

- Live app has not been replaced.
- Untracked `tmp/` and icon files remain outside the current commit unless explicitly requested.
- Continue avoiding JOURNAL/, archive/, and NOTES/ unless the task requires them.

## Next Actions

1. Review `/modern-preview/` for any remaining visual issues.
2. Keep future UI preview changes scoped to `web/index.html`, `web/styles.css`, and `web/app.js` unless alert config persistence changes are needed.
3. Validate with `node --check web/app.js` and `git diff --check`.
4. Redeploy changed preview files to WEB001 and verify cache keys.
