# Dashboard Refinement Plan

Date: 2026-04-29
Status: Product/design backlog
Owner: Product Architect

## Objective

Refine the tenant `Dashboard` so it feels more polished, professional, and immediately useful to a parent, teacher, instructor, or co-op operator.

The current dashboard has valuable data, but the next refinement should improve both:

- visual presentation: better gauges, cards, hierarchy, spacing, and status language
- decision value: clearer answers to "What needs my attention?", "Are we on track?", and "What should I do next?"

This is a planning note only. No implementation is included in this slice.

## Product Direction

The dashboard should become the first-glance command center for homeschool operations.

It should help the user understand:

- whether today is on track
- whether students are falling behind
- whether attendance and instructional records are complete enough
- whether grade averages are healthy
- whether reporting/compliance obligations look safe
- which action to take next

The target feel is:

- calm and trustworthy
- polished enough for a paid SaaS product
- useful within 5 seconds
- not visually noisy
- not a wall of tables

## Current Dashboard Inventory

The app already has these major dashboard surfaces:

- `Overview`
  - Instruction Days
  - Instruction Hours
  - Attendance
  - Running Grade Average
  - School Year Progress
  - Current Quarter Progress
  - Completion Today
  - Open Items Today
  - Instruction Pace
  - Awaiting Grades Today
- `Execution`
  - Completion Today
  - Open Items Today
  - Classes Awaiting Grades
- `Performance`
  - Student Performance
  - Course Watchlist
  - Grade Trending
  - GPA Trending
  - Grade Type Volume
  - Work Distribution
- `Compliance`
  - Instruction Hour Pace
  - Student Attendance
  - Student Instructional Hours
  - Instruction Hours Per Month
  - Instruction Days Per Month
  - Instructional Hours Trending

This structure is a good foundation. The next work should refine meaning, hierarchy, and visual treatment before adding many new widgets.

## Recommended Content Model

### 1. Today Snapshot

Purpose: answer "What is happening today?"

Recommended cards:

- `Today's Classes`
  - completed / scheduled
  - percent complete
  - short note such as "5 classes still open"
- `Needs Attention`
  - count of records that need grading, attendance, or completion action
  - severity color based on count
- `Instruction Completed Today`
  - completed hours vs planned hours
  - avoid forcing the user to mentally convert class rows into learning time
- `Next Class`
  - next upcoming class for each selected/visible student or the next global class
  - include time, student, course, and status

### 2. Student Health

Purpose: answer "Which students need attention?"

Recommended cards or ranked list:

- student name
- grade trend indicator
- attendance status
- instructional-hour pace status
- open items count
- one-line recommendation

Example recommendation language:

- "Penelope is on pace, but has 3 classes awaiting grades."
- "PJ is behind instructional-hour pace by 2.5 hours."
- "Dexter has no current risk signals."

### 3. Compliance Confidence

Purpose: answer "Are my records defensible and complete?"

Recommended gauges:

- `Attendance Records`
  - days recorded vs expected school days to date
- `Instruction Hours`
  - earned vs expected to date
- `Grade Records`
  - completed classes missing grade entries
- `Report Readiness`
  - composite status based on attendance, grades, and hours completeness

This should be especially useful for states or co-ops where records matter.

### 4. Academic Momentum

Purpose: answer "Are grades moving in the right direction?"

Recommended content:

- top grade risks
- recently improved courses
- recently declining courses
- course average trends by student
- grade-entry freshness

The most useful first version may be a compact `Academic Momentum` card:

- average now
- change from prior month/quarter
- number of courses below threshold
- number of stale courses with no recent grades

### 5. Work Queue

Purpose: answer "What should I do next?"

Recommended list:

- mark attendance for today
- grade completed classes
- review students behind pace
- check courses below passing threshold
- generate report when records are complete

Each item should be actionable where possible, linking into `School Day`, `Grades`, `Attendance`, or `Reports`.

## Visual Refinement Recommendations

### Gauges

Replace plain KPI blocks where appropriate with more expressive but restrained gauge treatments.

Recommended gauge types:

- circular progress ring for daily completion
- horizontal progress meter for instructional hours
- status pill plus variance number for pace
- compact sparkline for grade and hour trends
- severity badges for open items and risk status

Avoid:

- large speedometer-style gauges
- decorative charts with low information value
- overly colorful dashboards
- hidden meaning that depends only on color

### Cards

Use a consistent dashboard card system:

- title
- primary metric
- status indicator
- explanatory sentence
- optional action link

Example:

```text
Instruction Pace
On Pace
826.5 of 810.0 expected hours
Students are currently ahead by 16.5 hours.
```

### Status Language

Prefer human-readable status over raw metrics alone.

Recommended status scale:

- `On Track`
- `Watch`
- `Behind`
- `Critical`
- `Incomplete Records`
- `Needs Grade`
- `Ready for Report`

Each status should have a clear calculation behind it.

### Hierarchy

Recommended dashboard layout:

1. top row: Today Snapshot and urgent attention
2. second row: Student Health and Compliance Confidence
3. third row: Academic Momentum and trend views
4. detail sections: tables and longer reports below the glanceable area

The first viewport should not start with dense tables.

### Visual Style

Use the existing Navigrader app style, but make dashboard cards feel more premium:

- white cards on soft page background
- stronger section headers
- clearer metric sizing
- subtle shadows
- consistent iconography if an icon set is already available
- restrained blue/green/yellow/red status palette
- less table dominance on the initial view

## Suggested First Implementation Slice

### Slice 1: Dashboard Overview Redesign

Keep existing data sources and calculations where possible.

Deliver:

- redesign `Overview` into a more glanceable card layout
- add a `Today Snapshot` row
- add a `Student Health` summary section
- convert key KPIs into polished card/gauge components
- keep existing tabs and existing detailed sections intact
- preserve Administration visibility behavior

Acceptance criteria:

- parent can understand today, risk, and compliance status without scrolling deeply
- dashboard remains responsive on laptop and tablet widths
- no loss of existing dashboard metrics
- no new backend dependency unless clearly justified

### Slice 2: Actionable Work Queue

Deliver:

- create a prioritized list of next actions
- link actions into the correct app area
- include missing attendance, missing grades, behind-pace students, and report-readiness blockers

Acceptance criteria:

- each item says what is wrong and where to fix it
- empty state is encouraging and useful
- work queue avoids duplicates for the same underlying issue

### Slice 3: Compliance Confidence

Deliver:

- record completeness gauge
- report-readiness status
- student-level compliance flags
- improved instructional-hour and attendance pace explanations

Acceptance criteria:

- user can tell whether reports are safe to generate
- user can identify the exact missing record type
- status language matches dashboard and reports language

### Slice 4: Academic Momentum

Deliver:

- grade trend summary cards
- improving/declining course list
- stale grade-entry signal
- clearer Course Watchlist severity

Acceptance criteria:

- user can tell which courses need intervention
- stale grade data is not mistaken for healthy performance
- performance signals are explainable from underlying grade records

## Data Questions To Resolve Later

- Should dashboard thresholds be global defaults or configurable per tenant?
- What passing grade/GPA threshold should drive academic risk?
- Should grade-entry freshness vary by course frequency?
- Should homeschool families and co-ops have different default dashboard layouts?
- Should `Report Readiness` be tied to a selected reporting period or current school year to date?
- Should student users see a simplified dashboard separate from parent/admin users?

## Implementation Notes

Likely frontend files:

- `web/index.html`
- `web/styles.css`
- `web/app.js`

Likely current functions/areas:

- dashboard tab markup in `web/index.html`
- dashboard card/table styles in `web/styles.css`
- `renderDashboard()`
- `renderDashboardExecutionSummary(...)`
- `renderDashboardInstructionHourPaceSummary(...)`
- `renderDashboardMissingGradesSummary(...)`
- `renderDashboardGradeRiskSummary(...)`
- dashboard snapshot builders near the current dashboard rendering code

Prefer using existing dashboard calculations first. Add new backend/domain APIs only if the browser-side full-state calculations become too hard to reason about or too slow.

## Non-Goals For First Refinement

- custom user-configurable dashboard layout
- drag-and-drop dashboard cards
- third-party charting library replacement
- predictive analytics beyond simple pace/trend indicators
- changing underlying grade, attendance, or schedule business rules

## Recommended Next Step

When ready to engage this work, start with `Slice 1: Dashboard Overview Redesign`.

Before coding, capture screenshots of the current dashboard at:

- desktop width
- laptop width
- tablet/mobile-ish width if supported

Then implement one visual/content pass, verify the dashboard with the Mitchell tenant data, and decide whether the new overview is strong enough before moving into the work queue and compliance confidence slices.
