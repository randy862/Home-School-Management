# Session Handoff

Date: 2026-05-08

## Current Work

Modern app preview refinement on branch:

app-modern-interface-shell

Preview URL:

https://mitchell.navigrader.com/modern-preview/

The live tenant app has not been replaced.

## Current State

Dashboard Performance alerts and visuals were refined and deployed to WEB001 `/modern-preview/`.

Completed this session:

- Course Watchlist now matches the modern Student Performance styling.
- Student Performance letter grades now align with one-decimal displayed averages.
- Student Performance score pill colors now use the same rounded value as the displayed grade.
- Grade Type Volume was rebuilt to match the supplied target design.
- Grade Type Volume includes icon filters, inner chart panel, bar labels, summary metric strip, and real chart/table toggle.
- Grade Type Volume order is Assignment, Quiz, Test, Quarter Final.
- Grade Type Volume Y-axis headroom, April label visibility, and Quarter filter width were fixed.
- Grade Risk was renamed to Average Grade Risk.
- Single Grade Risk alert type and threshold were added.
- Instruction Hours Per Month and Instruction Days Per Month now match Student Grade Trending style.
- Instruction Hours/Days include Subject filters, Line/Area toggles, data point toggles, summary cards, and month-wide hover summaries.
- Student Grade Trending and Instructor Grade Trending now also use month-wide hover summaries.
- APP001 workspace config normalizer was updated for the new Single Grade Risk settings.
- Required Instructional Hours analytics visual was rebuilt in the modern card style.
- Current Pace and Year-End Projection gauges were polished and aligned.
- Required marker label now sits outside the projection arc.
- Required Hours Progress Over Time now keeps actuals through YTD and starts projection from the current/YTD point.
- Overview Instruction Days now matches the projected instruction card style with status, note, and required/projected metrics.
- Subject Required flag was added and deployed: subjects now persist `required`, Curriculum > Subjects exposes the flag, student enrollment shows missing required subjects, and dashboard subject rows label required subjects.
- PostgreSQL migration `026_subject_required_flag.sql` was applied on APP001 across tenant subject schemas.
- Subject form layout was refined so the Subject input is about half width and Add Subject is on a second row aligned left.

Current served preview cache key:

- `styles.css?v=202605091712`
- `app.js?v=202605091712`

## Next Action

Start with the latest user feedback from `/modern-preview/`.

For UI-only work, inspect only:

- `web/index.html`
- `web/styles.css`
- `web/app.js`

Then make the smallest focused change and redeploy those files to:

`debian@192.168.1.210:/var/www/home-school-management/web/modern-preview/`

If alert config persistence changes, also update APP001:

`debian@192.168.1.200:/home/debian/apps/home-school-management/server/src/services/`

## Risks

- Do not replace the live app unless explicitly approved.
- Do not change backend, auth, tenant lifecycle, billing, or database behavior during visual-only work.
- Existing untracked `tmp/` and icon files remain intentionally untouched.

## Validation

- `node --check web/app.js`
- `git diff --check`
- Verify public preview cache key after publishing.
