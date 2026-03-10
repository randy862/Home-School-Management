# MSSQL Migration Plan

## Objective

Migrate persistence from browser `localStorage` (`hsm_state_v2`) to Microsoft SQL Server Express without data loss or behavior regressions.

## Source Model (Current)

- `students`: `id`, `firstName`, `lastName`, `birthdate`, `grade`, `ageRecorded`, `createdAt`
- `subjects`: `id`, `name`
- `courses`: `id`, `name`, `subjectId`, `hoursPerDay`
- `enrollments`: `id`, `studentId`, `courseId`
- `plans`: `id`, `planType`, `studentId`, `courseId`, `startDate`, `endDate`, `weekdays[]`, optional `quarterName`
- `attendance`: `id`, `studentId`, `date`, `present`
- `tests`: `id`, `date`, `studentId`, `subjectId`, `courseId`, `gradeType`, `testName`, `score`, `maxScore`
- `settings`: school years, current school year, quarters, holidays, grade types

## Target Relational Model

- Core: `students`, `subjects`, `courses`, `enrollments`
- Academic calendar: `school_years`, `quarters`, `holidays`
- Grading configuration: `grade_types`
- Activity: `plans`, `attendance`, `tests`

## Mapping Rules

1. Preserve existing string IDs for all rows during first migration pass.
2. Map frontend camelCase to SQL snake_case columns.
3. Convert `weekdays[]` to JSON string stored in `plans.weekdays_json`.
4. Keep `quarterName` as nullable `plans.quarter_name`.
5. Set `school_years.is_current = 1` for `settings.currentSchoolYearId`.
6. Enforce unique records where app logic already assumes uniqueness:
   - `subjects.name`
   - `enrollments(student_id, course_id)`
   - `attendance(student_id, attendance_date)`
   - `quarters(school_year_id, name)`

## Execution Phases

1. Baseline
   - Snapshot current local state JSON export.
   - Record row counts per entity.
2. Schema
   - Run `server/migrations/001_initial_schema.sql`.
3. Import
   - Run `server/src/scripts/import-state.js` against exported JSON.
4. Validate
   - Row count parity by table.
   - FK integrity checks (no orphans).
   - Spot-check grade averages and attendance summaries against UI.
5. Cutover
   - Implement API endpoints.
   - Switch frontend persistence adapter from local storage to API.

## Risks and Mitigations

- Risk: Duplicate records violate new unique constraints.
  - Mitigation: Import script de-duplicates arrays by natural keys before insert.
- Risk: Partial imports from mid-run failure.
  - Mitigation: Wrap import in a single transaction and rollback on error.
- Risk: Frontend behavior drift after backend swap.
  - Mitigation: Add endpoint-level smoke tests and compare key dashboard outputs pre/post cutover.
