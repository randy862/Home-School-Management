# Session Handoff

Date: 2026-05-12

## Current Work

Modern app preview refinement on branch:

`app-modern-interface-shell`

Preview URL:

https://mitchell.navigrader.com/modern-preview/

Production URL: https://mitchell.navigrader.com/

## Current State

Dashboard, reports, and School Day refinements are live in production from commit `322d6f1`.

Completed this session:

- Added Required flag support for Subjects and related enrollment/dashboard indicators.
- Refined Curriculum > Subjects form layout.
- Restyled Attendance and Running Grade Average overview cards to match instruction status cards.
- Added Overview Grades at Risk with Average Grade Risk and Single Grade Risk counts.
- Added Grade Search grade-value filtering for risk links.
- Linked Average Grade Risk to Performance Course Watchlist.
- Tightened Performance tables and dashboard chart sizing to avoid horizontal scrollbars.
- Added Compliance subtabs: Instructional Hours, Instructional Days, Required Subjects, with nested secondary-tab styling.
- Built Instructional Days compliance content to mirror Instructional Hours, including student breakdown wiring.
- Tuned Completed Today filter placement and typography.
- Added visible data values and month-wide hover popups to Instruction Days Trending.
- Replaced Overview Completed/Awaiting Grades card with Missing Required Subjects.
- Added Students table filters for Student, Grade, Status, and Required.
- Restyled Student Performance grade method controls as plain tick boxes and removed the circular check indicator.
- Widened Student Performance Student/Category column and constrained nested labels so student, subject, and grade type text stays inside its column.
- Matched Grade Type Volume, GPA Trending, and Work Distribution chart styling to the modern dashboard look; centered the Work Distribution donut-center content.
- Adjusted Required Instructional Hours and Days so Key Numbers aligns with the gauge cards, Progress Over Time spans the full analytics width, and Y-axis labels are less crowded.
- Added Required Subject Compliance analytic to Compliance > Required Subjects with subject rows, course/class lists, distribution bars, active-student summary cards, Student multi-select and Compliance filters, and Students-page count links.
- Updated Administration > Workspace Configuration > Dashboard Visibility to mirror Overview, Execution, Performance, and Compliance subtabs with one configurable flag per current dashboard gauge/section.
- Fixed hosted workspace-config normalization so newly split Dashboard Visibility flags persist when unchecked and are not re-applied after Save Configuration.
- Restyled printable Student and Instructor reports with the Navigrader header logo, branded page frame, polished tables/cards, generated timestamp, `https://www.navigrader.com` footer, Subject/Grade Report Criteria filters, configurable Student Executive Summary/Required Subjects content, split Instructor Executive Summary/Overview/Course Summary sections, Instructor performance summaries by subject, student, and grade, compact print summary cards, and tighter Reports status-message spacing.
- Added a current-day-only School Day Past Due quick filter, Dashboard > Execution Class Status and Past Due gauges, Overview Open Classes tracking from 05/12/2026 forward, School Day Status filtering, and persisted Scheduled/Completed/Excused status.
- Promoted current web assets to production root; backup is `/var/backups/home-school-management/web-production-20260512-002946.tar.gz`.

Current local cache keys:

- `styles.css?v=202605112035`
- `app.js?v=202605112035`

## Next Action

Monitor production after modern interface cutover:

`https://mitchell.navigrader.com/`

## Risks

- Final Required Instructional Days student breakdown change has been deployed to preview.
- Production now serves the modern app; keep `/modern-preview/` as the reference copy.
- Roll back with the production backup above if a blocking live issue appears.
- Existing untracked `tmp/` and icon files remain intentionally untouched.

## Validation

- `node --check web/app.js`
- `git diff --check`
- `node --check server/src/services/records-service.js`
- `node --check server/src/repositories/postgres/records-repository.js`
- `npm run db:migrate:pg` on APP001 with `.env.runtime`; `027_instruction_actual_status.sql` applied
- `curl.exe -s https://mitchell.navigrader.com/ | Select-String -SimpleMatch -Pattern 'styles.css?v=202605112035','app.js?v=202605112035','school-day-status-filter'`
- `curl.exe -s "https://mitchell.navigrader.com/app.js?v=202605112035" | Select-String -SimpleMatch -Pattern 'INSTRUCTION_STATUS_EXCUSED','data-school-day-status','renderSchoolDayStatusControl'`
