# Current Status

Date: 2026-05-20

## Active Workstream

Product/platform priorities on `saas-modern-redesign`.

## Current Focus

Workflow polish: homeschool courses/classes now support self-led instruction through a protected `Independent Learning` instructor option.

## Completed Recently

- Production-safe hosted smoke credentials exist outside the repo.
- Account Upgrade, Dormant Mode, Data Export, subscriber cancellation, Legal acceptance, Dashboard performance, and Help Center are deployed, committed, and pushed.
- Class configuration supports bulk student enrollment, roster conflict warnings, and backend fixed-class conflict validation.
- School Day scheduling reflows flexible courses around fixed classes, uses visible gaps before fixed classes, and respects ordered Lunch/Recess placement.
- School Day has subtle bulk open-item actions for completing/excusing filtered instruction rows.
- School Years create balanced recommended quarters; Holiday/Break changes rebalance quarters when saved dates still match recommendations.
- Course/Class edit actions scroll the top editor into view.
- Student Current Schedule has row-specific edit/cancel behavior.
- Control API maintenance expires ready data-export requests and removes expired ZIP artifacts from the configured export directory.
- `Independent Learning` is now a system instructor option for Course instructor, Class instructor override, School Day instructor edits, reports, and dashboard/grade filters.
- Class-level instructor override persists in `course_sections.instructor_id`; School Day defaults class rows to the class instructor before falling back to the course instructor.
- APP001 deployed migration `031_independent_learning_instructor.sql`, seeding the protected instructor and adding `course_sections.instructor_id`.
- WEB001 deployed tenant app `app.js?v=202605202030`.
- Full hosted release gate passed after deployment.
- Class form Weekdays field is deployed as a compact, content-width control.
- Curriculum sidebar icon no longer renders as a white square when active.

## Production State

- Public SaaS assets:
  - `saas.css?v=202605182130`
  - `saas-polish.css?v=202605182130`
  - `saas.js?v=202605182130`
- Tenant app assets:
  - `app.js?v=202605202030`
  - `styles.css?v=202605202115`
- APP001 latest rollback:
  - `/home/debian/rollback/hsm/independent-learning-instructor-202605202030/app001/server.tgz`
- APP001 control-api rollback:
  - `/home/debian/rollback/hsm/control-api-export-cleanup-202605201610/app001/control-api.tgz`
- WEB001 latest rollback:
  - `/var/www/home-school-management/rollback/web-curriculum-icon-fix-202605202130.tgz`

## Validation

- Local syntax checks passed:
  - `node --check web/app.js`
  - `node --check server/src/postgres-instructor-store.js`
  - `node --check server/src/repositories/postgres/curriculum-repository.js`
  - `node --check server/src/services/curriculum-service.js`
- APP001 deployed syntax checks passed for the touched API files.
- APP001 tenant migrations applied through `031_independent_learning_instructor.sql`.
- APP001 `hsm-api.service` restarted active and local `/health` returned `{"ok":true}`.
- WEB001 root returned HTTP 200.
- Public `https://mitchell.navigrader.com/health` returned `{"ok":true}`.
- Public `mitchell` and `smoketest` tenant roots reference `app.js?v=202605202030`.
- Served tenant app JS contains `INDEPENDENT_LEARNING_INSTRUCTOR_ID`.
- Full hosted release gate passed for `https://mitchell.navigrader.com`.
- Public `mitchell` and `smoketest` tenant roots reference `styles.css?v=202605202115`.
- Served tenant CSS contains the compact Class weekdays selector.
- Public `mitchell` and `smoketest` tenant roots reference `book-open.svg?v=202605202130`.
- Served Curriculum icon SVG no longer contains a white background rectangle.

## Current Blockers

- None.

## Current Risks

- Verify in the UI that `Independent Learning` appears in Course, Class, School Day row edit, Reports, and Dashboard/Grades instructor filters.
- Continue using smoke/test tenant data for mutating QA where possible.
- Do not store smoke credentials or Stripe/Postmark secrets in repo files.
- Untracked local scratch assets remain outside committed work.

## Next Actions

1. QA `Independent Learning` on `smoketest.navigrader.com` by assigning it to a Course and a Class, then checking School Day and instructor filters.
