# PostgreSQL Schema V1 Direction

## Purpose
Define the target production data model for the first hosted single-tenant release on PostgreSQL.

## Design Goals
- Preserve current product behavior where practical.
- Replace JSON-style full-state persistence with relational ownership.
- Keep identifiers stable during the transition to reduce migration risk.
- Support later extension to multi-tenancy without redesigning every table.

## Core Domains

### Identity and Access
- `users`
  - `id`
  - `username`
  - `password_hash`
  - `password_salt` or algorithm metadata
  - `role`
  - `student_id` nullable
  - `must_change_password`
  - `created_at`
  - `updated_at`
  - `last_login_at`
- `user_sessions`
- `setup_tokens`
- `app_runtime_state`

### Academic Structure
- `students`
- `subjects`
- `courses`
- `enrollments`

### Calendar and Planning
- `school_years`
- `quarters`
- `daily_breaks`
- `holidays`
- `plans`

### Performance and Attendance
- `attendance`
- `grade_types`
- `grading_criteria`
- `tests`

## Proposed Table Notes

### `students`
- Stores student identity, grade level, birthdate, and timestamps.

### `subjects`
- Stores subject catalog entries.

### `courses`
- Belongs to a subject.
- Retains `hours_per_day` and `exclusive_resource`.

### `enrollments`
- Join between students and courses.
- Retains `schedule_order`.

### `school_years`
- Stores school-year boundaries and instructional goals.

### `quarters`
- Belongs to a school year.
- Maintains current quarter/date segmentation behavior.

### `daily_breaks`
- Current model stores arrays in JSON-style fields.
- Acceptable for Phase 1 if needed, but candidate for later normalization if reporting grows.

### `holidays`
- Stores holiday and break ranges.

### `plans`
- Stores plan type, student, course, dates, weekdays, and optional quarter scope.
- Weekday serialization can remain array/JSON-backed initially if it speeds delivery.

### `attendance`
- One row per student per date.
- Unique constraint on `(student_id, attendance_date)`.

### `grade_types`
- Stores configurable grade categories and optional weights.

### `grading_criteria`
- Stores school-wide grading configuration.
- May remain one-row-per-tenant/school in Phase 1.

### `tests`
- Stores grade entries by date, student, subject, course, and grade type.

### `users`
- Stores application users and role assignments.
- Must become backend-owned for security.

### `user_sessions`
- Stores server-owned session records for hosted auth.

### `setup_tokens`
- Stores one-time hashed setup tokens for first-run admin initialization.

### `app_runtime_state`
- Stores singleton runtime flags such as hosted setup completion state.

## Migration Guidance
- Preserve current string IDs during Phase 1 to reduce migration friction.
- Prefer additive migration steps over one-time destructive conversions.
- Keep import/export utilities available during the transition.
- Replace the full-state repository pattern with per-domain repositories and migrations.

## API Mapping Direction
- `users` <-> auth, admin user management
- `setup_tokens`, `app_runtime_state` <-> first-run hosted initialization
- `students` <-> student management and reporting
- `subjects`, `courses`, `enrollments` <-> curriculum and roster management
- `school_years`, `quarters`, `holidays`, `daily_breaks`, `plans` <-> scheduling/calendar
- `attendance` <-> attendance workflows
- `grade_types`, `grading_criteria`, `tests` <-> grades and reporting

## Multi-Tenant Readiness Notes
- For future SaaS, this schema should live inside one tenant database.
- Do not add `tenant_id` columns for the first hosted single-tenant milestone.
- Control-plane tenancy metadata should live in a separate database later.

## Open Decisions
- whether to use `UUID` for new records after migration tooling is in place
- whether to normalize plan weekdays and daily-break student assignments immediately or defer
- whether grading criteria stays as a singleton table or is tied to school year scope
