# Session Handoff

Date: 2026-05-10

## Current Work

Modern app preview refinement on branch:

`app-modern-interface-shell`

Preview URL:

https://mitchell.navigrader.com/modern-design/

The live tenant app has not been replaced.

## Current State

Dashboard and Curriculum refinements are implemented locally.

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
- Deployed current web assets to `/modern-design/` and `/modern-preview/`.

Current local cache keys:

- `styles.css?v=202605110902`
- `app.js?v=202605110902`

## Next Action

Smoke-test Administration > Workspace Configuration > Dashboard Visibility save/reload behavior after deselecting gauges:

`https://mitchell.navigrader.com/modern-design/`

## Risks

- Final Required Instructional Days student breakdown change has been deployed to preview.
- Student Performance grade method tick box styling has been deployed to `modern-design`.
- Same tick box styling has also been deployed to `modern-preview` to avoid the older preview URL serving stale circular-chip controls.
- Student Performance table column fit styling has been deployed to both preview paths.
- Grade Type Volume, GPA Trending, and Work Distribution styling/functionality have been deployed to both preview paths.
- Do not replace the live app unless explicitly approved.
- Existing untracked `tmp/` and icon files remain intentionally untouched.

## Validation

- `node --check web/app.js`
- `node --check server/src/services/workspace-config-service.js`
- `git diff --check`
- `curl.exe -s https://mitchell.navigrader.com/modern-design/ | Select-String -SimpleMatch -Pattern 'styles.css?v=202605110902','app.js?v=202605110902','Overview Tab','Compliance Tab / Instructional Hours','Compliance Tab / Instructional Days','Compliance Tab / Required Subjects','admin-config-dashboard-show-required-subject-compliance'`
- `curl.exe -s https://mitchell.navigrader.com/modern-preview/ | Select-String -SimpleMatch -Pattern 'styles.css?v=202605110902','app.js?v=202605110902','Overview Tab','Compliance Tab / Instructional Hours','Compliance Tab / Instructional Days','Compliance Tab / Required Subjects','admin-config-dashboard-show-required-subject-compliance'`
- `curl.exe -s "https://mitchell.navigrader.com/modern-design/app.js?v=202605110902" | Select-String -SimpleMatch -Pattern 'showOverviewInstructionDays','showStudentGradeTrending','showInstructorGradeTrending','showRequiredInstructionalDays','showInstructionDaysTrending','showRequiredSubjectCompliance'`
- Deployed `server/src/services/workspace-config-service.js` to APP001 and restarted `hsm-api.service`; `curl.exe -k -s https://192.168.1.210/health` returned `{"ok":true}`.
