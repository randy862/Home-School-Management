# Current Status

Date: 2026-05-10

## Active Workstream

Modern app preview refinement.

## Current Focus

Modern preview polish in `/modern-design/`.

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
- Current web assets were deployed to `https://mitchell.navigrader.com/modern-design/` and `https://mitchell.navigrader.com/modern-preview/`.

## Current Blockers

- None.

## Current Risks

- Live app has not been replaced.
- Untracked `tmp/` and icon files remain outside the current commit unless explicitly requested.
- Continue avoiding archive/ and NOTES/ unless the task requires them.

## Next Actions

1. Smoke-test Compliance > Required Subjects tab label, nested subtab styling, Student multi-select, Compliance filter, active-student summary cards, and count links.
2. Keep live app unchanged unless replacement is explicitly approved.
