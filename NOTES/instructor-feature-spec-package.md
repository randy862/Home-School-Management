# Instructor Feature Spec Package

Date: 2026-04-03
Owner: Product Architect
Related: `web/app.js`, `web/index.html`, `server/src/routes/admin-routes.js`

## Purpose

Translate the instructor concept into an implementation-ready feature package and rollout plan for:

- instructor domain model
- schema and API changes
- UI changes by tab
- reporting and dashboard semantics
- phased implementation order

## Product Goal

Allow an administrator to:

1. maintain a roster of instructors
2. assign a default instructor to each course
3. record who actually taught a course on a given day
4. filter grades, reports, and analytics by instructor
5. view instructor-centered reporting on teaching activity and outcomes

## Scope

In scope:

- instructor CRUD management
- course default instructor assignment
- daily calendar instructor override
- instructor filters across grades, reports, and dashboard analytics
- instructor reporting

Out of scope for the first rollout:

- payroll, compensation rates, or payroll exports
- instructor authentication/login
- instructor certification/compliance tracking
- instructor availability scheduling
- parent communication workflows

## Core Principles

1. Instructors are first-class people records, not free-text labels.
2. Course assignment and actual daily instruction are separate facts.
3. Instructor analytics must be driven by who actually taught when that fact is known.
4. Existing student-centered workflows must continue to work when no instructor is assigned.
5. Phase 1 should deliver immediate value without forcing the full reporting stack to land at once.

## Domain Model

### 1. Instructor

Purpose:
- stores the people who may teach or supervise instruction

Fields:
- `id`
- `firstName`
- `lastName`
- `birthdate`
- `ageRecorded`
- `category`
- `createdAt`
- `updatedAt`

Allowed `category` values:
- `parent`
- `volunteer`
- `compensated`
- `other`

Notes:
- `ageRecorded` should be stored for consistency with the existing student model
- UI should calculate age from `birthdate` at render time and on form entry

### 2. Course

Phase 2 addition:
- `instructorId` nullable reference to `instructors.id`

Meaning:
- the default instructor expected to teach the course

### 3. Actual Instruction Record

Phase 3 addition:
- `instructorId` nullable reference to `instructors.id` on `actual_instruction_minutes`

Meaning:
- the instructor who actually taught the course on that recorded day

Why this matters:
- reports such as days taught, hours taught, and average grades by instructor are only reliable if daily overrides are captured

## Reporting Semantics

### Default rules

- If a daily instruction record has an `instructorId`, use that for instructor analytics.
- If no daily override exists, fall back to the course's default `instructorId`.
- If neither exists, classify the instruction as `Unassigned`.

### Instructor report outputs

The instructor report should show:

- instructor roster summary
- instructor category
- assigned courses
- days taught per course
- instructional hours per course
- average grades for courses taught

### Filter behavior

Instructor filters should be added to:

- Grades
- Student Performance dashboard panel
- Instructional Hours dashboard gauges and summaries
- Grade Trending
- GPA Trending
- Instructional Hours trending
- printable reports where course or performance scope is already available

Interpretation:
- filtering by instructor narrows results to records taught by that instructor according to the reporting semantics above

## API Contract

### Phase 1

`GET /api/instructors`
- returns all instructors for authenticated users

`POST /api/instructors`
- admin only
- creates an instructor

`PATCH /api/instructors/:id`
- admin only
- updates an instructor

`DELETE /api/instructors/:id`
- admin only
- deletes an instructor

Payload shape:

```json
{
  "id": "optional-generated-id",
  "firstName": "Randal",
  "lastName": "Mitchell",
  "birthdate": "1980-01-10",
  "ageRecorded": 46,
  "category": "parent",
  "createdAt": "2026-04-03"
}
```

### Phase 2

Course payloads gain:

```json
{
  "instructorId": "optional-instructor-id"
}
```

### Phase 3

Actual instructional minute payloads gain:

```json
{
  "instructorId": "optional-instructor-id"
}
```

## UI Changes By Phase

### Phase 1: Instructor Management

Add a new `Instructors` tab parallel to `Students`.

UI elements:

- instructor list table
- `New Instructor` button
- create/edit form
- fields:
  - first name
  - last name
  - category
  - birthdate
  - calculated age display

Acceptance criteria:

- admin can create, edit, and delete instructors
- age recalculates from DOB on screen
- instructor list persists through hosted API refresh

### Phase 2: Course Assignment

Add instructor dropdown to course create/edit form.

Acceptance criteria:

- course may be saved with or without an instructor
- configured instructors appear in the course dropdown
- course list shows the assigned instructor

### Phase 3: Calendar Daily Override

Add instructor selector in the daily calendar workflow.

Behavior:

- default selection comes from course assignment
- admin can override to another instructor for that day

Acceptance criteria:

- actual instruction records preserve the selected instructor
- leaving the field unchanged uses the course default

### Phase 4: Filters

Add instructor filters to grades, reports, and dashboard analytics.

Acceptance criteria:

- filter defaults to `All Instructors`
- results narrow correctly without breaking existing student/subject/course filters

### Phase 5: Instructor Reports

Add `Instructor` to the reporting interface.

Acceptance criteria:

- report opens with instructor summary data
- days taught, hours taught, and average grades reflect recorded or default instructor attribution

## Data Migration Notes

- existing installs begin with zero instructors
- all current courses default to `NULL instructorId`
- all existing actual instruction records default to `NULL instructorId`
- reporting must tolerate historical records with no instructor attribution

## Rollout Plan

1. Phase 1: Instructor CRUD entity, API, and UI
2. Phase 2: Default instructor on courses
3. Phase 3: Daily calendar instructor override and persistence
4. Phase 4: Instructor filters across grades, reports, and dashboard
5. Phase 5: Instructor reporting surface

## Recommended Build Order For Engineering

1. Add `instructors` table and store functions
2. Add `/api/instructors` routes
3. Add frontend state, API calls, and Instructor tab
4. Ship and validate phase 1
5. Extend courses with `instructorId`
6. Extend daily instruction records with `instructorId`
7. Add analytics and report filters
8. Add instructor report generation

## Risks

- reporting complexity rises once attribution can come from either course defaults or daily overrides
- dashboard filters will touch several independent calculation paths in `web/app.js`
- delete behavior must be defined carefully once courses and instruction records reference instructors

## Decisions Locked In

- instructors are a separate managed entity
- `category` is a controlled value, not free text
- age is derived from DOB in the UI and stored as `ageRecorded` for parity with students
- course default instructor and actual daily instructor are separate facts
- rollout begins with CRUD first, then assignment, then analytics
