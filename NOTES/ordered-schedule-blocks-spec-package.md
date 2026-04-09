# Ordered Schedule Blocks Spec Package

Date: 2026-04-08
Owner: Product Architect
Status: Implementation-ready

## 1. Objective

Replace the current fixed-time `Daily Lunch and Breaks` model with an ordered `schedule block` model that:

- lets lunch, recess, and other breaks sit inside the student daily sequence
- removes artificial dead time before lunch/breaks when class timings shift
- keeps the existing student schedule-order workflow as the main placement mechanism
- treats lunch/recess/other as non-academic scheduled items rather than true academic courses

This should make the generated day schedule sequence-driven instead of partly sequence-driven and partly clock-pinned.

## 2. Product Problem

Current behavior:

- lunch and breaks are configured with fixed start times
- courses are otherwise laid out from sequence/order and duration
- when class lengths or start times change, lunch may no longer align with the preceding class
- the schedule generator can leave a large idle gap before lunch

This creates a mismatch between:

- how instructional blocks are scheduled
- how lunch/break blocks are scheduled

## 3. Product Decision

Lunch, recess, and other breaks should become ordered `schedule blocks`.

They should:

- be assignable in student enrollment/schedule configuration in the same practical way as courses
- carry an order position in the student schedule
- be sequenced naturally by the day builder
- keep configurable durations
- not behave like academic courses for grades, GPA, curriculum analytics, or instructor assignment

So the UX should feel “course-like” for placement, but the domain model should remain distinct.

## 4. Core Model

Introduce a new scheduled-item concept:

- `course`
- `lunch`
- `recess`
- `other_break`

Recommended umbrella name:

- `schedule block`

Recommended runtime shape:

```text
ScheduleBlock
- id
- tenant_id / schema-owned record id
- name
- blockType: course | lunch | recess | other_break
- durationMinutes
- activeWeekdays
- description (optional, especially for other_break)
- createdAt
- updatedAt
```

Student schedule assignment should then reference either:

- a course
- or a schedule block

Recommended student-assignment shape:

```text
StudentScheduledItem
- id
- studentId
- itemType: course | schedule_block
- courseId (nullable)
- scheduleBlockId (nullable)
- orderIndex
- active
```

Invariant:

- exactly one of `courseId` or `scheduleBlockId` must be present

## 5. UX Direction

### A. Schedule Page

Current `Daily Lunch and Breaks` should evolve into reusable block-template configuration.

Rename direction:

- `Daily Lunch and Breaks` -> `Schedule Blocks`

This section should configure reusable templates such as:

- Lunch
- Recess
- Other Break

Template fields:

- name
- type
- duration minutes
- weekdays
- optional description

Template fields should no longer require:

- fixed start time

Because start time will come from student schedule sequence.

### B. Students > Enrollment

Student enrollment/schedule should become the placement point for both:

- academic courses
- schedule blocks

This means:

- when adding a scheduled item, the selector can include both courses and schedule blocks
- schedule blocks should be visibly labeled by type
- order assignment should work exactly like course order today

Examples:

- `Second Grade Math`
- `Second Grade Bible`
- `Lunch`
- `Second Grade History`

or

- `Math`
- `Recess`
- `History`

### C. Calendar and School Day

Day generation should use the student’s ordered scheduled items list.

That means:

- lunch/recess/other appear naturally where they fall in the sequence
- no dead-time gap caused by a fixed lunch clock
- School Day and Calendar day view stay aligned with the actual student order

## 6. Behavioral Rules

### Day-builder sequencing

For each student on a given instructional day:

1. Start from the student day start time.
2. Walk the ordered scheduled items in `orderIndex`.
3. For each item:
   - place the item at the current time
   - use its duration:
     - course duration from the course
     - schedule-block duration from the block template
4. After each placed item, apply the normal transition gap rules.
5. Continue until the full ordered sequence is placed.

### Transition gap rules

Keep the current normal class-gap behavior unless deliberately changed later.

Recommended initial rule:

- instructional blocks preserve the current default gap behavior
- lunch/recess/other blocks should use the same default transition gap treatment initially for consistency

If later desired, block-type-specific gap rules can be added, but that should not be part of the first slice.

### Academic behavior

Schedule blocks must not:

- accept grades
- appear in GPA calculations
- appear in course-summary academic analytics
- be assignable to instructors by default

Schedule blocks may:

- appear on Calendar and School Day
- appear in completed/planned day sequencing
- optionally count toward daily schedule structure

### Instruction-hour behavior

Initial recommendation:

- lunch/recess/other blocks should **not** count toward instructional hours

Reason:

- they are schedule-management blocks, not instructional blocks

This should stay true even when marked completed.

## 7. Data/Migration Plan

### Current source

The app currently stores fixed-time daily breaks/lunch entries.

### Migration target

We need to move from:

- fixed-time daily break rows

to:

- reusable schedule block templates
- per-student ordered scheduled-item assignments

### Migration strategy

Phase 1 should support coexistence while migrating.

Recommended migration:

1. Add new schedule-block tables and assignment model.
2. Add new student-schedule support for block assignments.
3. Add schedule-builder support that prefers ordered schedule blocks when present.
4. Keep legacy fixed-time daily breaks readable temporarily.
5. Add a migration tool that converts legacy lunch/break definitions into block templates plus student assignments where possible.
6. Retire legacy fixed-time lunch/break scheduling once validated.

### Important migration note

Legacy daily-break records currently include:

- assigned students
- type
- description
- start time
- duration
- weekdays

When migrating:

- `start time` should not be preserved as a primary scheduling field
- the new placement should be determined by schedule order

This means some migration may require operator review if the correct order position is ambiguous.

## 8. Backend Impact

Likely impacted server domains:

- calendar service/repository
- curriculum/student scheduling routes
- records/day-generation logic

Likely backend work:

1. Add schedule-block persistence.
2. Add scheduled-item assignment persistence for students.
3. Extend enrollment APIs or add a dedicated scheduled-items API.
4. Update day-generation logic to merge:
   - courses
   - schedule blocks
5. Ensure School Day and Calendar read paths use the new unified sequence.
6. Keep legacy fixed-time break reads available only during transition.

## 9. Frontend Impact

### Schedule page

Replace current fixed-time lunch/break editor with block-template management.

### Students page

Enrollment/schedule UI must:

- allow adding schedule blocks
- show them in the schedule table
- allow ordering them
- clearly distinguish them from courses

### Calendar / School Day

Generated rows should:

- render schedule blocks inline in sequence
- continue showing lunch/recess/other visually distinct from academic courses
- keep non-academic rows non-gradable and non-instructional-hour-bearing

## 10. Suggested API Direction

Possible new/updated shapes:

### `GET /api/schedule-blocks`

Returns reusable block templates.

### `POST /api/schedule-blocks`

Creates a block template.

### `PATCH /api/schedule-blocks/:id`

Updates a block template.

### `DELETE /api/schedule-blocks/:id`

Deletes a block template.

### Student scheduled-item routes

Either extend enrollments or create a dedicated route family:

- `GET /api/students/:id/scheduled-items`
- `POST /api/students/:id/scheduled-items`
- `PATCH /api/students/:id/scheduled-items/:itemId`
- `DELETE /api/students/:id/scheduled-items/:itemId`

Recommendation:

- use a dedicated `scheduled-items` route family

Reason:

- this is broader than course enrollment now

## 11. Rollout Plan

### Phase 1: Spec and data model

- define schedule blocks and student scheduled items
- agree on migration boundary

### Phase 2: Backend foundation

- create schema/migrations
- add block CRUD APIs
- add student scheduled-item APIs

### Phase 3: Student scheduling UI

- update Student Enrollment to allow schedule blocks
- show block rows in schedule order table

### Phase 4: Day-generation cutover

- update Calendar and School Day to use ordered schedule blocks
- prefer new model over fixed-time daily breaks

### Phase 5: Legacy retirement

- migrate existing lunch/break data
- remove fixed-time lunch/break scheduling from daily generation
- rename Schedule UI from `Daily Lunch and Breaks` to `Schedule Blocks`

## 12. Acceptance Criteria

This feature is done when:

1. A reusable `Lunch` block can be created without a fixed start time.
2. A student can be assigned `Lunch` in the same practical schedule-order workflow used for courses.
3. Calendar day view places lunch according to schedule order, not fixed clock time.
4. School Day places lunch according to schedule order, not fixed clock time.
5. No dead-time gap appears before lunch due solely to a pinned lunch start time.
6. Lunch/recess/other blocks do not accept grades.
7. Lunch/recess/other blocks do not count toward instructional hours.
8. Existing tenants can migrate from the old model without losing daily schedule viability.

## 13. Open Decisions

1. Whether schedule blocks should be global reusable templates only, or optionally student-specific.
   Recommendation: start with global reusable templates.
2. Whether transition gaps should differ by block type.
   Recommendation: no, not in the first slice.
3. Whether recess and other breaks should be implemented at the same time as lunch.
   Recommendation: yes, because the model is the same and partial implementation would create duplication.
4. Whether the old `Daily Lunch and Breaks` UI should remain temporarily visible during migration.
   Recommendation: yes, only during migration/cutover.

## 14. Recommended Next Build Slice

Start with the data model and UI boundary, not the migration script.

Recommended first coding slice:

1. schema for `schedule_blocks` and student `scheduled_items`
2. backend CRUD for block templates
3. Student Enrollment support for assigning schedule blocks and ordering them

Then follow with:

4. Calendar and School Day generation cutover
5. legacy lunch/break migration and retirement
