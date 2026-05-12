# Current Status

Date: 2026-05-11

## Active Workstream

Modern app preview refinement.

## Current Focus

Modern preview polish in `/modern-preview/`.

## Completed Recently

- Required Subjects were added to Curriculum, enrollment checks, dashboard subject rows, and database persistence.
- Overview Attendance and Running Grade Average cards now match instruction status-card styling.
- Overview Grades at Risk replaced School Year-to-Date Pace.
- Grade Search supports grade-value filtering for Single Grade Risk workflows.
- Performance tables were tightened to fit without internal horizontal scrolling.
- Compliance now has Instructional Hours, Instructional Days, and Required Subjects subtabs with distinct nested styling.
- Instructional Days now mirrors the Required Instructional Hours panel, including progress chart and student breakdown wiring.
- Completed Today filter layout and compliance chart sizing were tuned.
- Required Instructional Days student breakdown was deployed to the modern preview.
- Instruction Days Trending now shows data values and month-wide hover popups.
- Overview now has Missing Required Subjects instead of Completed/Awaiting Grades.
- Students table now includes Required status and Student, Grade, Status, Required filters.
- Student Performance grade method controls now render as plain tick boxes without circular indicators.
- Student Performance nested labels now stay inside the Student/Category column.
- Grade Type Volume, GPA Trending, and Work Distribution now match the modern dashboard styling, with Work Distribution donut-center content centered.
- Required Instructional Hours and Days now place Key Numbers with the gauge cards, extend Progress Over Time across the analytics width, and reduce crowded Y-axis labels.
- Compliance > Required Subjects now includes Required Subject Compliance with course/class rows, distribution bars, active-student summary cards, Student multi-select and Compliance filters, and Students-page count links.
- Administration > Workspace Configuration > Dashboard Visibility now mirrors Dashboard tabs/subtabs and exposes one configurable flag per current dashboard gauge/section.
- Hosted workspace-config normalization now preserves unchecked split Dashboard Visibility flags after Save Configuration.
- Printable Student and Instructor reports now use a branded Navigrader report frame with Subject/Grade Report Criteria filters, configurable Student Executive Summary/Required Subjects content, split Instructor Executive Summary/Overview/Course Summary sections, Instructor performance summaries by subject, student, and grade, polished report tables/cards, `https://www.navigrader.com` footer, compact print summary cards, and tighter Reports status-message spacing.
- School Day now has a persisted Scheduled/Completed/Excused status model, a Status filter, correct Excused schedule behavior, and Flex Block actions aligned under Actions.
- Dashboard Execution now has Class Status and Past Due gauges, and Overview tracks Open Classes from 05/12/2026 forward.
- Current web assets were deployed to `https://mitchell.navigrader.com/modern-preview/`. The duplicate `modern-design` URL currently matches `modern-preview`; keep `modern-preview` as source of truth.

## Current Blockers

- None.

## Current Risks

- Live app has not been replaced.
- Untracked `tmp/` and icon files remain outside the current commit unless explicitly requested.
- Continue avoiding archive/ and NOTES/ unless the task requires them.

## Next Actions

1. Smoke-test School Day status dropdowns, especially Excused moving later flexible classes up.
2. Keep live app unchanged unless replacement is explicitly approved.
