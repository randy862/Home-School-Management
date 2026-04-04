# School Day Hub Spec Package

Date: 2026-04-04
Owner: Product Architect
Related: `web/app.js`, `web/index.html`, `web/styles.css`, `server/src/services/records-service.js`

## Purpose

Translate the `School Day` concept into an implementation-ready feature package and rollout plan for:

- a new daily-operations workspace
- shared daily context and filters
- unified access to schedule, attendance, and grades
- inline daily actions that reduce page switching
- a clean path from a hub model to a future true daily execution layer

## Product Goal

Allow an instructor or administrator to:

1. open one workspace for the current school day
2. see the planned daily schedule with the right student/course/instructor context
3. take attendance without leaving the page
4. enter grades without leaving the page
5. adjust same-day instructional details such as instructor, start time, and duration
6. use the same workspace as the operational starting point for normal daily teaching

## Scope

In scope for the first rollout:

- new `School Day` sidebar entry below `Dashboard`
- shared daily date and filter context
- internal tabs for:
  - `Daily Schedule`
  - `Attendance`
  - `Grades`
- reuse of existing calendar day, attendance, and grade-entry capabilities inside a unified workspace
- row-level actions from the daily schedule to launch inline grade entry
- same-day editing for instructor and actual minutes
- first-pass same-day editing for displayed start times and schedule order in the hub UI

Out of scope for the first rollout:

- replacing the existing `Calendar`, `Attendance`, or `Grades` pages immediately
- drag-and-drop schedule building
- automated pacing suggestions
- lesson-plan authoring
- a persisted day-session model with complete per-day timeline ownership
- live collaboration/multi-user locking

## Core Principles

1. `School Day` should feel like an operational hub, not a fourth disconnected admin page.
2. The first version should reuse proven backend and UI behavior wherever possible.
3. The hub must reduce navigation friction immediately, even before deeper backend redesign.
4. Inline actions should preserve the current domain rules for attendance, grades, and instructional records.
5. The first design must leave a clean upgrade path to a persisted daily execution layer later.

## Product Positioning

### Problem To Solve

Daily school management currently requires bouncing between:

- `Calendar`
- `Attendance`
- `Grades`
- sometimes `Students`

That creates friction for the normal school-day loop:

1. confirm the day plan
2. teach a course
3. adjust what actually happened
4. record attendance
5. record grades
6. move to the next course

### Solution Direction

Add a dedicated `School Day` workspace that becomes the operational home for routine daily activity.

It should:

- center on one selected date
- show the day schedule first
- make daily tasks available from that same screen
- expose attendance and grades in adjacent tabs when bulk work is needed

## Hub Model Versus Future Execution Layer

### Phase A: Hub Model

Purpose:
- unify existing capabilities under one shared daily context

Characteristics:
- primarily frontend orchestration
- reuses existing APIs and data structures
- uses the current planned schedule plus actual instruction records
- launches inline attendance/grade actions from the daily schedule

Benefits:
- lower risk
- faster implementation
- immediate usability gain

### Phase B: True Daily Execution Layer

Purpose:
- make the school day itself a first-class persisted operational object

Characteristics:
- per-day schedule state becomes durable
- start times, durations, order, instructors, attendance, and grade-entry state can belong to one runtime day session
- better support for same-day substitutions, reordered blocks, and audit history

Benefits:
- stronger operational model
- cleaner reporting and replay of what really happened
- better long-term foundation for advanced workflow automation

### Decision

Build Phase A first, but structure the hub around concepts that can map forward into Phase B:

- selected day
- daily blocks
- actual instructional facts
- row-level actions
- per-day overrides

## User Roles

### Admin

Can:

- view all students and instructors in the selected context
- edit same-day schedule details
- submit attendance
- submit grades

### Instructor

Future-facing intent:
- should eventually use the same workspace for normal teaching flow

First rollout note:
- no instructor-auth/login dependency is required for the hub build

## Shared Daily Context

The whole `School Day` workspace should derive from one shared context object.

### Required fields

- `selectedDate`
- `selectedSchoolYearId`
- `selectedQuarterId`
- `selectedStudentIds`
- `selectedInstructorIds`
- `selectedCourseIds`
- `selectedSubjectIds`
- `selectedViewTab`

### Behavior

- changing the date updates all subtabs
- filters should stay in sync across subtabs unless intentionally scoped to one tab
- the initial default should be `today`
- the initial tab should be `Daily Schedule`

## UI Structure

## 1. Sidebar Navigation

Add:

- `School Day`

Placement:

- directly below `Dashboard`

Reason:
- it is a primary daily workflow, not a settings/admin workflow

## 2. School Day Page Frame

Top area:

- page title: `School Day`
- date picker
- optional previous/next day buttons
- shared filters

Subtabs:

- `Daily Schedule`
- `Attendance`
- `Grades`

Main content:

- the selected subtab content rendered beneath the shared context bar

## 3. Daily Schedule Tab

Base:

- adapt the existing Calendar daily view

Columns should include:

- time
- student
- planned instruction
- instructor
- minutes
- attendance status or quick action
- grade action
- edit actions

Row-level actions:

- `Edit`
- `Use Planned`
- `Attendance`
- `Grade`

### Inline edit behavior

When editing a row, the user should be able to adjust:

- instructor
- actual minutes
- start time
- displayed duration
- displayed order where applicable

First rollout note:
- if start time and order edits are not yet durably persisted end to end, the UI should still be designed around a row-expansion editing model that later plugs into a persisted daily override store

## 4. Attendance Tab

Purpose:
- bulk attendance workflow for the selected date

Behavior:

- show the same student/date context as `Daily Schedule`
- allow fast present/absent updates
- reuse existing attendance submission logic

## 5. Grades Tab

Purpose:
- bulk grade-entry and same-day review workflow for the selected context

Behavior:

- reuse existing grade-entry rules and grading settings
- allow quick grade entry scoped by selected day, student, and course

## 6. Inline Grade Entry From Daily Schedule

This is a priority usability feature.

Behavior:

- each course row has a `Grade` button
- clicking `Grade` expands a grade-entry panel directly below that course row
- the form uses the same grade-entry rules as the current Grades flow
- after successful save, the grade-entry panel collapses
- the row remains in place so the user can continue through the day

Acceptance expectation:

- the user should be able to work top-to-bottom through the day without switching pages

## Domain And State Model

### Existing facts to reuse

- planned schedule blocks
- school years and quarters
- student enrollments
- instructor assignments
- actual instructional minute overrides
- attendance records
- grade/test records

### New frontend state concepts

- `schoolDayContext`
- `schoolDayActiveInlineGradeRowId`
- `schoolDayActiveInlineAttendanceRowId`
- `schoolDayEditingRowId`
- `schoolDayFilterState`

### Future persisted concepts

These do not need to land in phase 1, but the spec should reserve for them:

- `daily_schedule_overrides`
- `daily_execution_sessions`
- `daily_execution_events`

## Backend Impact

### First rollout

Expected backend requirement level:

- light to moderate

Likely first-phase backend reuse:

- existing attendance CRUD
- existing grade/test CRUD
- existing instruction actuals endpoints
- existing course/instructor reads

### Possible first-phase extensions

Depending on what is already supported cleanly in the current app:

- endpoint support for same-day start-time override display
- endpoint support for same-day schedule-order override display
- endpoint support for row-level save semantics if current actuals endpoints are too narrow

### Future execution-layer backend work

The true execution layer likely needs:

- a persisted daily-session record
- a persisted block-level override table
- event/audit semantics for same-day operational edits

## Reporting And Analytics Semantics

The hub should not redefine reporting rules in its first rollout.

Rules:

- attendance still uses existing attendance semantics
- grades still use existing grade/test semantics
- instructional hours still derive from actual instructional minutes when present
- instructor analytics still use the existing instructor attribution rules

The hub is an operational entry point, not a new analytics engine.

## API And Integration Expectations

### No new public contract required for the planning package

The initial build should start by mapping `School Day` interactions onto existing endpoints and only add new APIs when a gap becomes concrete.

### Likely required integration review

Review these existing domains before coding:

- Calendar daily-view reads
- attendance reads/writes
- grade-entry reads/writes
- actual instruction minute writes
- course + instructor hydration for same-day rows

## Acceptance Criteria

### Phase 1: School Day Shell

- sidebar includes `School Day` below `Dashboard`
- page opens with shared date/filter bar
- page contains subtabs for `Daily Schedule`, `Attendance`, and `Grades`
- switching subtabs preserves shared selected-day context

### Phase 2: Daily Schedule Hub

- `Daily Schedule` renders the selected day schedule using current calendar logic
- daily rows support instructor and minute editing as they do today
- row actions are visible and usable from this page

### Phase 3: Inline Grade Entry

- clicking `Grade` opens an inline grade-entry form beneath the course row
- grade save uses the same grading rules as the current Grades workflow
- successful save collapses the inline form

### Phase 4: Attendance Integration

- `Attendance` tab supports fast attendance updates for the selected day
- daily workflow no longer requires leaving `School Day` for ordinary attendance tasks

### Phase 5: Advanced Daily Overrides

- the design supports durable same-day start time, duration, order, and instructor adjustments
- implementation can evolve into a true daily execution layer without discarding the `School Day` UI shell

## Rollout Plan

1. Phase 1: School Day shell and shared context
2. Phase 2: Daily Schedule tab using current calendar-day logic
3. Phase 3: inline grade entry from schedule rows
4. Phase 4: attendance integration and bulk daily workflow
5. Phase 5: advanced same-day overrides and execution-layer-ready model

## Recommended Build Order For Engineering

1. add `School Day` sidebar tab and empty shell
2. extract or reuse shared daily context helpers from current calendar/attendance/grades flows
3. render the current day schedule inside the new tab
4. wire row-level actions and inline edit state
5. add inline grade entry panel
6. add attendance tab integration
7. identify backend gaps for same-day overrides
8. define the follow-on execution-layer persistence model only after the hub flow is proven

## Open Design Decisions To Reconfirm Before Coding

1. Which shared filters are visible by default on day one:
   - student
   - instructor
   - subject
   - course
2. Whether the attendance action should exist both inline on schedule rows and in the dedicated tab on day one
3. Whether same-day start-time and order changes should be visual-only first or persisted in phase 1
4. Whether the existing `Calendar`, `Attendance`, and `Grades` pages remain fully visible after `School Day` ships

## Risks

- `web/app.js` already carries substantial UI coordination logic, so the hub could increase complexity if state is not isolated cleanly
- trying to persist full same-day schedule mutation too early could turn a fast hub build into a backend redesign
- reusing existing grade and attendance behavior inline will require careful event/state management to avoid regressions

## Decisions Locked In

- `School Day` will be built as a hub first, not as a true execution layer first
- the hub will sit below `Dashboard` in the sidebar
- the hub will use internal tabs for `Daily Schedule`, `Attendance`, and `Grades`
- row-level inline grade entry is part of the intended daily workflow
- the hub is explicitly the stepping stone toward a future persisted daily execution layer
