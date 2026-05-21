# Session Handoff

Date: 2026-05-21

## Context

Workflow polish is active. Current slice expanded the Quick Start Help article into a full setup-to-operation walkthrough.

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
- APP001 deployed API files and tenant migration `031_independent_learning_instructor.sql`.
- WEB001 deployed `app.js?v=202605211015`.
- Hosted release gate passed for `https://mitchell.navigrader.com` after deployment.
- Class form Weekdays field is deployed as a compact, content-width control in `styles.css?v=202605202115`.
- Curriculum sidebar icon was replaced with a clean outline SVG and cache-busted as `book-open.svg?v=202605202130`.
- Rollbacks:
  - APP001: `/home/debian/rollback/hsm/independent-learning-instructor-202605202030/app001/server.tgz`
  - WEB001: `/var/www/home-school-management/rollback/web-help-quick-start-expanded-202605211015.tgz`

## Next Action

Review the expanded Quick Start article in `smoketest.navigrader.com`:

- Open Help, choose Quick Start, and scan the setup steps for tone, sequencing, and missing parent-facing guidance.

## Risks

- Use smoke/test tenant data for mutating QA where possible.
- Do not store smoke credentials, Stripe secrets, or Postmark secrets in repo files.
- Untracked scratch screenshots/icons and `tmp/` remain local and intentionally outside commits.

## Validation

- Local `node --check` passed for touched web/API files.
- APP001 deployed syntax checks passed.
- APP001 migrations applied through `031_independent_learning_instructor.sql`.
- APP001 `hsm-api.service` restarted active and local `/health` returned `{"ok":true}`.
- WEB001 root returned HTTP 200.
- Public `https://mitchell.navigrader.com/health` returned `{"ok":true}`.
- Public `mitchell` and `smoketest` roots reference `app.js?v=202605211015`.
- Served tenant app JS contains expanded Quick Start Help content.
- Full hosted release gate passed for `https://mitchell.navigrader.com`.
- Public `mitchell` and `smoketest` roots reference `styles.css?v=202605202115`.
- Served tenant CSS contains the compact Class weekdays selector.
- Public `mitchell` and `smoketest` roots reference `book-open.svg?v=202605202130`.
- Served Curriculum icon SVG no longer contains a white background rectangle.
