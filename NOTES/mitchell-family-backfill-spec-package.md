# Mitchell Family Backfill Spec Package

Date: 2026-04-07
Owner: Product Architect
Related: `server/src/scripts/`, `server/src/repositories/postgres/records-repository.js`, `server/src/repositories/postgres/calendar-repository.js`

## Purpose

Define an implementation-ready, tenant-scoped backfill workflow for the Mitchell Family test tenant so the hosted app has realistic historical data for:

- attendance
- grades
- daily completion state
- actual instructional minutes
- dashboard and report presentation

The backfill must be safe, repeatable, and explicitly targeted to the Mitchell Family test tenant rather than treated as a general production import.

## Product Goal

Allow the team to:

1. seed the Mitchell Family tenant with realistic school-year activity from the beginning of the current school year through the current date
2. demonstrate `School Day`, `Dashboard`, and `Reports` with believable complete data
3. test completion-based instructional-hour accounting against a tenant that looks operationally real
4. rerun the backfill intentionally when needed without hand-entering months of records

## Scope

In scope:

- one tenant-scoped backfill script for the Mitchell Family tenant
- attendance generation from school-year start through current date
- test/grade generation from school-year start through current date
- actual instructional minute generation using planned class duration
- completed flag generation for attended instructional rows
- summary output describing what was created
- dry-run capability
- replace mode for the generated record families

Out of scope for the first rollout:

- a generic UI-triggered seeding wizard
- automatic backfill for all tenants
- lesson content or assignment descriptions beyond simple generated labels
- individualized special schedules beyond the tenant's current stored plan data
- artificial schedule-duration changes
- manipulating users, students, courses, or enrollments

## Core Principles

1. The script must only touch data families it owns.
2. The backfill must follow the real planned schedule already stored in the tenant.
3. Attendance remains day-level per student.
4. Course completion remains row-level per student/course/date.
5. Instructional hours must flow from the same completed-row logic the app already uses.
6. The script should be intentionally rerunnable with explicit flags, not silently destructive.

## Target Tenant

Primary target:

- tenant schema: `tenant_mitchell_family`
- tenant host context: `http://mitchell.school.local`

Safety expectation:

- the script must require an explicit tenant schema argument
- the script must reject execution unless the target schema exactly matches an allowlisted value or an explicit override flag is passed

## Data Families To Backfill

### 1. Attendance

Tables:

- `attendance`

Behavior:

- generate one day-level attendance record per student per instructional day
- target attendance percentage per student between `97.0%` and `98.0%`
- distribute absences sparsely and believably across the school year
- do not create attendance records on holidays, weekends, or non-instructional dates

### 2. Actual Instruction Execution

Tables:

- `actual_instruction_minutes`

Behavior:

- create one record per scheduled instructional row for each attended student on each instructional date
- use the planned course duration as `actual_minutes`
- mark `completed = true` for attended rows
- preserve course default instructor when available
- leave start-time and order fields aligned to the planned schedule unless a deterministic calculation is required to satisfy the current runtime model
- do not create completed instructional rows for absent students

### 3. Grades

Tables:

- `tests`

Behavior:

- create grade records across the year through the current date only
- distribution target:
  - `80%` assignments
  - `10%` quizzes
  - `10%` tests
- add one quarter final per quarter per student/course where the course is active during that quarter
- scores should feel realistic rather than perfectly uniform
- generated grade names should be readable and presentable

## Source Of Truth For Schedule Shape

The backfill should derive schedule data from the tenant's existing:

- `students`
- `courses`
- `subjects`
- `enrollments`
- `plans`
- `daily_breaks`
- `holidays`
- `school_years`
- `quarters`
- `instructors`

The backfill must not invent a new schedule model.

## Instructional Date Rules

### Eligible dates

An instructional date is eligible when all of the following are true:

- date is on or after current school year start
- date is on or before the run date
- date is not on a weekend
- date is not covered by a holiday/break range
- date falls inside the relevant course plan range
- date matches the course plan weekdays

### Ineligible dates

Do not create attendance, completion, or grades for:

- future dates
- weekends
- holiday/break dates
- dates outside the current school year
- dates where a student has no planned instruction

## Attendance Generation Rules

### Target range

Each student should finish between:

- `97.0%`
- `98.0%`

### Absence pattern guidance

- use a deterministic pseudo-random strategy so reruns are stable for a given seed
- prefer full-day absences, not partial-day absences
- avoid clustering too many absences together unless the generated count is extremely low
- preserve at least one absence-free stretch so the data looks natural

### Recommended algorithm

1. Build each student's eligible instructional date list.
2. Choose a target attendance percentage in the allowed band using the script seed.
3. Calculate required absence count from the eligible day count.
4. Select absence dates deterministically from the eligible list.
5. Create `present = false` on those dates and `present = true` otherwise.

## Actual Instruction Generation Rules

For each attended student and eligible instructional date:

1. Build the student's planned instructional rows for that date.
2. Exclude daily breaks and lunch rows from `actual_instruction_minutes`.
3. For each instructional row:
   - set `student_id`
   - set `course_id`
   - set `instruction_date`
   - set `actual_minutes` equal to planned scheduled minutes
   - set `completed = true`
   - set `instructor_id` to the course default instructor when present
   - set `order_index` to the planned sequence for that day
   - set `start_minutes` to the planned runtime start for that row

For absent days:

- create no completed instructional rows

## Grade Generation Rules

### Grade mix

Across the generated non-final grades:

- `80%` Assignment
- `10%` Quiz
- `10%` Test

### Quarter finals

For each quarter and student/course combination that is active during that quarter:

- generate one `Quarter Final`

### Volume guidance

The script should create enough grades to make dashboards and reports look realistic without flooding the dataset.

Recommended baseline:

- roughly 1 to 2 generated grades per active course per instructional week
- use the school-year date span to spread those records across time

### Score guidance

- produce generally strong but non-perfect scores suitable for a polished demo tenant
- keep most scores in a believable homeschool-success range
- introduce light variation so GPA and averages are not identical

Recommended score profile:

- Assignments: mostly `85-99`
- Quizzes: mostly `82-98`
- Tests: mostly `80-97`
- Quarter Finals: mostly `78-96`

## Replace Mode And Safety

The first implementation should support:

- `--tenant-schema <schema>`
- `--seed <number>`
- `--through-date <yyyy-mm-dd>`
- `--dry-run`
- `--replace-generated`

### Replace-generated behavior

When `--replace-generated` is used, the script may delete and recreate only records that match a generated naming/signature pattern for:

- attendance generated by this script
- tests generated by this script
- actual instruction rows generated by this script

To keep this safe, the script should mark generated records using recognizable `id` prefixes and grade names.

Example prefixes:

- attendance ids: `seed-att-...`
- actual instruction ids: `seed-act-...`
- test ids: `seed-test-...`

This allows reruns without touching hand-entered records.

## Script Location

Recommended file:

- `server/src/scripts/backfill-mitchell-tenant.js`

Recommended npm script:

- `db:backfill:mitchell`

## Script Inputs

Required:

- tenant schema

Optional:

- seed
- through date
- replace-generated
- dry-run

Environment:

- existing Postgres connection env vars
- tenant schema selection via `PGOPTIONS` or explicit connection-local `search_path`

## Implementation Design

### 1. Data loading phase

Load all required tenant-local records:

- students
- instructors
- subjects
- courses
- enrollments
- plans
- daily breaks
- holidays
- school years
- quarters

### 2. Schedule build phase

Compute, per student and date:

- eligible instructional days
- planned instructional rows in order
- planned day minutes

### 3. Attendance build phase

Generate deterministic attendance records per student/date.

### 4. Execution build phase

Generate completed `actual_instruction_minutes` rows for attended instructional rows only.

### 5. Grade build phase

Generate dated grade rows distributed across the active instructional periods.

### 6. Write phase

In one transaction:

- optionally delete prior generated rows
- insert generated attendance
- insert generated actual instruction rows
- insert generated test rows

### 7. Summary output

Print:

- tenant schema
- run date
- seed
- instructional date range
- student count
- attendance records created
- actual instruction rows created
- grade rows created
- absence counts by student
- final attendance percentage by student

## Acceptance Criteria

1. The script can target the Mitchell Family tenant schema safely.
2. Attendance is backfilled from school-year start through current date.
3. Each student lands between `97%` and `98%` attendance.
4. Grades are generated with the requested type distribution and quarter finals.
5. Completed instructional rows exist for attended scheduled classes only.
6. Planned class duration is preserved in generated actual-minute rows.
7. Dashboard and reports populate from the resulting data without special-case logic.
8. Future dates do not count toward current instructional hours.
9. The script can be dry-run without writing data.
10. The script can be rerun intentionally in replace mode.

## Risks

### 1. Mixed generated and manual data

Risk:

- unintentionally deleting or duplicating hand-entered data

Mitigation:

- generated id prefixes
- replace-generated mode only
- explicit tenant schema requirement

### 2. Schedule derivation drift

Risk:

- generated actual rows might not match what the current frontend would plan for a date

Mitigation:

- use existing stored plans, enrollments, breaks, and holidays
- keep duration equal to planned schedule duration

### 3. Grade overproduction

Risk:

- too many grades could make reports noisy or unrealistic

Mitigation:

- cap weekly grade count per course
- keep quarter final exactly once per quarter/course/student

## Open Decisions

1. Should the first script be Mitchell-only or tenant-generic with a Mitchell wrapper?
   - recommendation: tenant-generic internals with a Mitchell-focused script entrypoint
2. Should absent days create zero actual rows or explicit incomplete rows?
   - recommendation: zero actual rows
3. Should the script seed one school year only or all historical school years?
   - recommendation: current school year only

## Recommended Rollout

### Phase 1

- build the script
- dry-run against Mitchell schema
- verify projected counts

### Phase 2

- run replace-generated mode against Mitchell schema
- verify Dashboard, School Day, and Reports

### Phase 3

- optionally generalize the script for future tenant demo seeding

