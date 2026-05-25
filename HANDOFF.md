# Session Handoff

Date: 2026-05-24

## Context

Performance optimization workstream is active. Current slice added baseline measurement before changing data loading or dashboard contracts.

## Current State

- Added protected system instructor id `independent-learning`.
- Instructor admin/API lists hide the system instructor; update/delete are blocked for that id.
- Course instructor dropdown includes `Independent Learning`.
- Class configuration now has an Instructor dropdown with `Use course instructor` default and `Independent Learning`/configured instructors as options.
- Backend persists class instructor overrides in `course_sections.instructor_id`.
- School Day editable rows include `Independent Learning` and class rows default to the class instructor before falling back to course instructor.
- School Day row editor preserves unsaved start time, instructor, and minutes while status/grade actions re-render the row.
- Reports, grade filters, dashboard gauges/checklists, and instructor trend filters use the assignable instructor list, including `Independent Learning`.
- Quick Start Help now walks through workspace review, school year, quarters, holidays, students, subjects, instructors, courses, classes, student schedules, readiness review, daily School Day use, and reporting/export habits.
- Dashboard Attendance Open gauge now targets School Day > Attendance while the other open-item gauges continue to target Daily Schedule as appropriate.
- Quick Start Help now uses the provided detailed step-by-step guidance from `navigrader_help_center_quick_start.md`.
- The previous in-app Quick Start article is saved at `web/help/quick-start-previous-20260522.md`.
- Help Center now has an `Open in Window` action that opens a separate movable reference window without requiring a second login.
- Added opt-in browser performance diagnostics enabled by `?perf=1`.
- Diagnostics record API timing/payload/row counts, `hydrate.total`, per-hydration task timing, `dashboard.render`, and the major Dashboard builder timings to `window.__navigraderPerfMetrics`.
- Added `scripts/Measure-HostedPerformance.ps1` for hosted endpoint timing, payload size, and row-count baselines.
- APP001 deployed API files and tenant migration `031_independent_learning_instructor.sql`.
- WEB001 deployed `app.js?v=202605242103` and `styles.css?v=202605221245`.
- Hosted release gate has not been rerun from this shell because hosted smoke credentials were not present.
- Class form Weekdays field is deployed as a compact, content-width control in `styles.css?v=202605202115`.
- Curriculum sidebar icon was replaced with a clean outline SVG and cache-busted as `book-open.svg?v=202605202130`.
- Rollbacks:
  - APP001: `/home/debian/rollback/hsm/independent-learning-instructor-202605202030/app001/server.tgz`
  - WEB001: `/var/www/home-school-management/rollback/web-performance-instrumentation-served-202605242103.tgz`

## Next Action

Run the hosted performance baseline from a shell with credentials:

- `powershell -ExecutionPolicy Bypass -File .\scripts\Measure-HostedPerformance.ps1 -BaseUrl https://mitchell.navigrader.com`

Then open `https://mitchell.navigrader.com/?perf=1`, navigate login and Dashboard tabs, and inspect `window.__navigraderPerfMetrics`.

## Risks

- Use smoke/test tenant data for mutating QA where possible.
- Do not store smoke credentials, Stripe secrets, or Postmark secrets in repo files.
- Untracked scratch screenshots/icons and `tmp/` remain local and intentionally outside commits.
- Performance diagnostics are opt-in, but enabling them clones JSON responses to measure payload bytes, so use only while measuring.

## Validation

- Local `node --check` passed for touched web/API files.
- PowerShell parser check passed for `scripts/Measure-HostedPerformance.ps1`.
- `git diff --check` passed.
- APP001 deployed syntax checks passed.
- APP001 migrations applied through `031_independent_learning_instructor.sql`.
- APP001 `hsm-api.service` restarted active and local `/health` returned `{"ok":true}`.
- WEB001 root returned HTTP 200.
- Public `https://mitchell.navigrader.com/health` returned `{"ok":true}`.
- Public `mitchell` and `smoketest` roots reference `app.js?v=202605242103` and `styles.css?v=202605221245`.
- Served tenant app JS contains `hsm_perf_diagnostics`, `hydrate.total`, and `dashboard.render`.
- Served tenant app JS contains the Help Center pop-out code.
- Served tenant CSS contains the Help Center pop-out button style.
- Previous full hosted release gate passed for `https://mitchell.navigrader.com`; rerun after this slice from a shell with credentials.
- Public `mitchell` and `smoketest` roots reference `styles.css?v=202605202115`.
- Served tenant CSS contains the compact Class weekdays selector.
- Public `mitchell` and `smoketest` roots reference `book-open.svg?v=202605202130`.
- Served Curriculum icon SVG no longer contains a white background rectangle.
