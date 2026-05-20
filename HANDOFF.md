# Session Handoff

Date: 2026-05-20

## Context

Workflow polish is active. Current slice added a self-led instruction option named `Independent Learning` across instructor assignment and filtering paths.

## Current State

- Added protected system instructor id `independent-learning`.
- Instructor admin/API lists hide the system instructor; update/delete are blocked for that id.
- Course instructor dropdown includes `Independent Learning`.
- Class configuration now has an Instructor dropdown with `Use course instructor` default and `Independent Learning`/configured instructors as options.
- Backend persists class instructor overrides in `course_sections.instructor_id`.
- School Day editable rows include `Independent Learning` and class rows default to the class instructor before falling back to course instructor.
- Reports, grade filters, dashboard gauges/checklists, and instructor trend filters use the assignable instructor list, including `Independent Learning`.
- APP001 deployed API files and tenant migration `031_independent_learning_instructor.sql`.
- WEB001 deployed `app.js?v=202605202030`.
- Rollbacks:
  - APP001: `/home/debian/rollback/hsm/independent-learning-instructor-202605202030/app001/server.tgz`
  - WEB001: `/var/www/home-school-management/rollback/web-independent-learning-instructor-202605202030.tgz`

## Next Action

Run the hosted release gate from a PowerShell session with smoke credentials loaded:

`powershell -ExecutionPolicy Bypass -File .\scripts\Invoke-HostedReleaseGate.ps1 -PublicBaseUrl https://mitchell.navigrader.com`

Then smoke-test `Independent Learning` in `smoketest.navigrader.com`:

- Set a Course instructor to `Independent Learning`.
- Set a Class instructor override to `Independent Learning`.
- Confirm School Day row edit and instructor filters show/select it.

## Risks

- Codex does not have hosted smoke credentials in-process, so full release gate must be run from the user's shell.
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
- Public `mitchell` and `smoketest` roots reference `app.js?v=202605202030`.
- Served tenant app JS contains `INDEPENDENT_LEARNING_INSTRUCTOR_ID`.
