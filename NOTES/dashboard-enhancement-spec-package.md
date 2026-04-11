# Dashboard Enhancement Spec Package

Date: 2026-04-09
Owner: Product Architect
Status: Implementation-ready

## Objective

Evolve the current `Dashboard` from a mostly historical reporting surface into a more actionable operational and analytical workspace.

This package defines the first enhancement slice:

1. `Completion Today`
2. `Needs Attention Today`
3. `Instruction Hour Pace`
4. `Grade Risk / Course Watchlist`
5. `Missing Grades`

It also defines a new internal dashboard tab structure so the page can grow without becoming an overloaded scroll wall.

## Product Goals

The enhanced dashboard should help an administrator answer:

- What needs attention right now?
- Which students or courses are drifting off track?
- Are we on pace for instructional hours?
- Are grades complete enough to trust academic trends?
- What should I do next?

## Non-Goals

This slice does not include:

- custom drag-and-drop dashboard composition
- arbitrary user-defined gauges
- role-specific dashboard layouts beyond existing admin/student access rules
- chart-library replacement
- advanced forecasting beyond pace-to-date comparisons

## Dashboard Philosophy

The current dashboard already covers:

- high-level progress
- performance history
- attendance summary
- instructional-hour trends

The missing value is operational and risk-oriented visibility.

So the enhancement should favor:

- actionability over novelty
- compact summaries over dense raw tables
- grouped tabs over one long stacked page

## Recommended Dashboard Tab Model

Keep `Dashboard` as one workspace, but add internal subtabs.

### 1. `Overview`

Purpose:
- high-level year/quarter and health snapshot

Contents:
- Instruction Days
- Instruction Hours
- Attendance
- Running Grade Average
- School Year Progress
- Current Quarter Progress

Implementation note:
- `Overview` remains the fixed dashboard landing state and is not hidden through `Administration > Workspace Configuration`

### 2. `Execution`

Purpose:
- what still needs to be done today or recently

Contents:
- Completion Today
- Needs Attention Today
- Missing Grades

### 3. `Performance`

Purpose:
- academic performance and course-level risk

Contents:
- Student Performance
- Grade Risk / Course Watchlist
- Grade Trending
- GPA Trending

### 4. `Compliance`

Purpose:
- pacing, required records, and progress against obligations

Contents:
- Instruction Hour Pace
- Student Attendance
- Student Instructional Hours
- Instructional Hours Trending

## Why Tabs Are Required

Without grouping, adding the new gauges would make Dashboard too tall and visually noisy.

Tabs solve that by:

- reducing page density
- creating clearer mental models
- letting the user move between operational, academic, and compliance views
- aligning naturally with future `Administration > Workspace Configuration` controls

### Administration Alignment

The shipped Administration controls should not introduce nested dashboard tabs inside configuration.

Instead, `Administration > Workspace Configuration > Dashboard Visibility` should present grouped checkbox sections:

- `Execution Tab`
- `Performance Tab`
- `Compliance Tab`

That keeps the control surface simple while still matching the internal Dashboard structure.

## New Gauge Definitions

## 1. Completion Today

### Purpose

Show how much of the current day’s scheduled instruction has actually been completed.

### Data Source

- `dailyScheduledBlocks(...)`
- `actual_instruction_minutes.completed`
- School Day selected date

### Default Scope

- current date
- visible students under Dashboard rules

### Metric Definition

Instructional rows only:

- denominator: count of scheduled instructional blocks for the selected date
- numerator: count of those instructional blocks marked `Completed`

### Output

Primary KPI:
- `Completed X of Y classes`

Secondary KPI:
- `Z% complete`

Optional supporting detail:
- per-student mini progress bars or compact table:
  - student
  - completed classes
  - scheduled classes

### Visual Recommendation

- KPI card plus compact per-student row list

## 2. Needs Attention Today

### Purpose

Show unresolved operational work for the selected day.

### Data Source

- School Day row state logic already used for:
  - `Needs Attendance`
  - `Needs Grade`
  - `Needs Completion`
  - `Overridden`

### Metric Definition

Count instructional rows by category:

- needs attendance
- needs grade
- needs completion
- overridden

Also calculate:

- total open attention items

### Output

Primary KPI:
- `N open items`

Supporting tiles or chips:
- `Needs Attendance: X`
- `Needs Grade: Y`
- `Needs Completion: Z`
- `Overridden: Q`

### Visual Recommendation

- grouped status chips or 4 mini cards
- clicking a category can deep-link into School Day filtered state

## 3. Instruction Hour Pace

### Purpose

Show whether actual earned instructional hours are on pace for this point in the school year.

### Data Source

- instructional date range and year progress
- completed-only earned hours
- required instructional hours from current school year

### Metric Definition

Expected earned hours to date:

- `requiredInstructionalHours * schoolYearProgressPercent`

Actual earned hours to date:

- completed-only earned hours through today

Variance:

- `actual - expected`

Pace percent:

- `actual / expected`, capped for display as needed

### Output

Primary KPI:
- `Ahead by X.XX hrs`
- `Behind by X.XX hrs`
- or `On Pace`

Supporting values:
- Actual to date
- Expected to date

### Visual Recommendation

- KPI card with pace band
- small horizontal comparison bar

## 4. Grade Risk / Course Watchlist

### Purpose

Show which course/student combinations are most in need of intervention.

### Data Source

- existing course summary calculations
- filtered grade averages

### Initial Risk Rules

Flag course summaries where:

- average is below 80%

Optional severity bands:

- `Watch`: 75.0% to 79.9%
- `At Risk`: below 75.0%

### Output

Rows:
- student
- subject
- course
- average
- letter
- risk label

Primary summary:
- count of watchlist courses

### Visual Recommendation

- compact table with colored risk badges
- sorted by lowest average first

## 5. Missing Grades

### Purpose

Distinguish “student performance is weak” from “there just is not enough grade data entered yet.”

### Data Source

- scheduled instructional blocks
- tests table
- selected date range, usually current quarter

### First-Release Heuristic

For the selected quarter:

- expected opportunities = completed instructional days per course
- recorded grade entries = test rows per course

Missing grade count:

- `expected - recorded`, never below 0

This is a heuristic, not a promise that every completed class must have a grade.
That is acceptable for v1 as long as it is framed as a coverage indicator.

### Output

Primary KPI:
- `X potential grades missing`

Supporting rows:
- student
- course
- completed sessions
- recorded grades
- gap

### Visual Recommendation

- KPI plus table sorted by highest gap

## Tab-to-Gauge Mapping

### Overview

- existing overview gauges only

### Execution

- Completion Today
- Needs Attention Today
- Missing Grades

### Performance

- Student Performance
- Grade Risk / Course Watchlist
- Grade Trending
- GPA Trending

### Compliance

- Instruction Hour Pace
- Student Attendance
- Student Instructional Hours
- Instructional Hours Trending

## Dashboard Configuration Impact

The Administration workspace already controls Dashboard visibility at the section level.

This enhancement should extend configuration to support:

- visible dashboard tabs
- visible gauges within each tab

Not required in first code slice:

- tab reordering
- per-gauge custom thresholds

Recommended additions to `workspaceConfig.dashboard` later:

```json
{
  "defaultTab": "overview",
  "showOverviewTab": true,
  "showExecutionTab": true,
  "showPerformanceTab": true,
  "showComplianceTab": true,
  "showCompletionToday": true,
  "showNeedsAttentionToday": true,
  "showInstructionHourPace": true,
  "showGradeRiskWatchlist": true,
  "showMissingGrades": true
}
```

## Data and Calculation Notes

### Completed Hours Rule

Dashboard must continue using the new completed-only instructional-hour model for actual earned hours.

### Date Scope

New operational gauges should default to:

- today for daily execution metrics
- current quarter for grade-coverage metrics
- current school year to date for pace/compliance metrics

### Performance

These gauges should reuse existing in-memory derivations where possible instead of adding many new API calls.

First implementation should stay frontend-computed from already hydrated tenant data.

If later production scale requires it, these can move to pre-aggregated API endpoints.

## Implementation Plan

### Phase A: Dashboard Tab Shell

- add dashboard subtabs
- preserve existing `Overview` as the default
- move current sections into grouped tab panels

### Phase B: Execution Tab

- add Completion Today
- add Needs Attention Today
- add Missing Grades

This is the highest-value first build slice.

### Phase C: Compliance Tab Additions

- add Instruction Hour Pace

### Phase D: Performance Tab Additions

- add Grade Risk / Course Watchlist

### Phase E: Administration Integration

- add Dashboard tab and gauge visibility controls to Workspace Configuration

## Acceptance Criteria

1. Dashboard uses internal tabs rather than one long undifferentiated page.
2. The five new gauges render with real tenant data.
3. Execution gauges reflect School Day completion and open-work states accurately.
4. Instruction Hour Pace uses completed-only earned hours.
5. Grade Risk / Course Watchlist highlights low-performing courses.
6. Missing Grades provides a useful gap indicator without breaking existing grading features.
7. Existing dashboard sections continue working within the new grouped-tab structure.
8. The page remains readable on desktop and mobile.
9. `Administration > Workspace Configuration` can hide any non-Overview dashboard gauge by grouped tab section without affecting the fixed Overview landing state.
10. The first Dashboard drill-down interactions can jump directly into `School Day` with the relevant date/tab/filter context for follow-through work.
11. When Dashboard opens `School Day`, the user can return to the originating dashboard tab from an in-context School Day banner.

## Open Questions

1. Should Dashboard remember the last active dashboard tab per browser session?
2. Should Completion Today always use today, or should it optionally follow the School Day reference date?
3. Should Missing Grades use a stricter rule later than “completed sessions vs recorded grades”?
4. Should Grade Risk thresholds become configurable in Administration later?
5. Which non-Execution dashboard views should gain the next deep-link path into School Day or Grades?

## Recommendation

Build the `Execution` tab first.

Why:

- it gives the biggest practical value immediately
- it complements the new School Day workflow
- it turns Dashboard into a stronger operational companion rather than just a reporting surface
