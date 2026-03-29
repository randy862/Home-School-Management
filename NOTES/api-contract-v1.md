# API Contract v1 (Hosted Transition Phase)

## Base URL

- local development: `http://localhost:3000`
- hosted deployment via Apache: same-origin under the web host, for example `http://192.168.1.210`

## Related Reference

- Auth/session behavior and endpoint protection rules are documented in `NOTES/backend-auth-session-contract.md`.

## Endpoints Implemented

### `GET /health`

- Response `200`:
  - `{ "ok": true }`
- Response `500`:
  - `{ "ok": false, "error": "..." }`

### `POST /api/auth/login`

- Request body:
  - `{ "username": "admin", "password": "..." }`
- Response `200`:
  - `{ "user": { "id": "...", "username": "admin", "role": "admin", "studentId": "", "mustChangePassword": true } }`
- Sets the hosted session cookie on success.
- Response `401`:
  - `{ "error": "Invalid username or password." }`

### `POST /api/auth/logout`

- Response `200`:
  - `{ "ok": true }`
- Revokes the current hosted session and clears the session cookie.

### `GET /api/me`

- Response `200`:
  - `{ "user": { "id": "...", "username": "...", "role": "admin|student", "studentId": "...", "mustChangePassword": false } }`
- Response `401`:
  - `{ "error": "Authentication required." }`
- Hosted frontend bootstrap should use this endpoint as the source of truth for signed-in state.

### `GET /api/setup/status`

- Public hosted setup-status endpoint.
- Response `200`:
  - `{ "initialized": true|false }`

### `POST /api/setup/initialize`

- Public one-time hosted initialization endpoint.
- Request body:
  - `{ "setupToken": "...", "username": "...", "password": "..." }`
- Response `201`:
  - `{ "user": { "id": "...", "username": "...", "role": "admin", "studentId": "", "mustChangePassword": false } }`
- Creates the first hosted admin, consumes the one-time setup token, marks setup complete, and establishes a normal authenticated session.

### `GET /api/users`

- Requires admin session.
- Response `200`:
  - array of hosted user records
- Response `401` or `403` for unauthenticated/non-admin callers

### `POST /api/users`

- Requires admin session.
- Creates one hosted user.
- Password hashing is performed on the backend.

### `PATCH /api/users/:id`

- Requires admin session.
- Updates one hosted user.
- Password changes are handled on the backend when a password is supplied.

### `DELETE /api/users/:id`

- Requires admin session.
- Deletes one hosted user.
- Backend enforces last-admin protection and clears the current session if the current user deletes themselves.

### `GET /api/students`

- Requires authenticated session.
- Admin callers receive all students.
- Student callers receive only their linked student record.

### `POST /api/students`

- Requires admin session.
- Creates one student.

### `PATCH /api/students/:id`

- Requires admin session.
- Updates one student.

### `DELETE /api/students/:id`

- Requires admin session.
- Deletes one student and cleans up dependent hosted links according to backend rules.

### `GET /api/subjects`

- Requires authenticated session.
- Admin callers receive all subjects.
- Student callers receive only subjects tied to their enrolled courses.

### `POST /api/subjects`

- Requires admin session.
- Creates one subject.

### `PATCH /api/subjects/:id`

- Requires admin session.
- Updates one subject.

### `DELETE /api/subjects/:id`

- Requires admin session.
- Deletes one subject and removes dependent hosted curriculum data according to backend cleanup rules.

### `GET /api/courses`

- Requires authenticated session.
- Admin callers receive all courses.
- Student callers receive only courses they are enrolled in.

### `POST /api/courses`

- Requires admin session.
- Creates one course.

### `PATCH /api/courses/:id`

- Requires admin session.
- Updates one course.

### `DELETE /api/courses/:id`

- Requires admin session.
- Deletes one course and removes dependent hosted curriculum data according to backend cleanup rules.

### `GET /api/enrollments`

- Requires authenticated session.
- Admin callers receive all enrollments.
- Student callers receive only their own enrollments.

### `POST /api/enrollments`

- Requires admin session.
- Creates one enrollment.

### `PATCH /api/enrollments/:id`

- Requires admin session.
- Updates one enrollment, including hosted schedule-order changes.

### `DELETE /api/enrollments/:id`

- Requires admin session.
- Deletes one enrollment.

### `GET /api/school-years`

- Requires authenticated session.
- Returns hosted school-year configuration with current-year flags.

### `POST /api/school-years`

- Requires admin session.
- Creates one school year.

### `PATCH /api/school-years/:id`

- Requires admin session.
- Updates one school year.

### `PATCH /api/school-years/:id/current`

- Requires admin session.
- Sets the current hosted school year.

### `DELETE /api/school-years/:id`

- Requires admin session.
- Deletes one school year and its dependent hosted quarter definitions.

### `GET /api/quarters`

- Requires authenticated session.
- Returns hosted quarter records across school years.

### `PUT /api/school-years/:id/quarters`

- Requires admin session.
- Replaces the quarter definitions for one school year.
- Backend preserves the current product behavior by updating matching hosted quarterly plan dates when applicable.

### `GET /api/daily-breaks`

- Requires authenticated session.
- Admin callers receive all daily break records.
- Student callers receive only break records that include their linked student record.

### `POST /api/daily-breaks`

- Requires admin session.
- Creates one daily break record.

### `PATCH /api/daily-breaks/:id`

- Requires admin session.
- Updates one daily break record.

### `DELETE /api/daily-breaks/:id`

- Requires admin session.
- Deletes one daily break record.

### `GET /api/holidays`

- Requires authenticated session.
- Returns hosted holiday and break records.

### `POST /api/holidays`

- Requires admin session.
- Creates one holiday/break record.

### `PATCH /api/holidays/:id`

- Requires admin session.
- Updates one holiday/break record.

### `DELETE /api/holidays/:id`

- Requires admin session.
- Deletes one holiday/break record.

### `GET /api/plans`

- Requires authenticated session.
- Admin callers receive all plans.
- Student callers receive only their own plans.

### `POST /api/plans`

- Requires admin session.
- Creates one or more plans in one request.

### `PATCH /api/plans/:id`

- Requires admin session.
- Updates one plan.

### `DELETE /api/plans/:id`

- Requires admin session.
- Deletes one plan.

### `GET /api/attendance`

- Requires authenticated session.
- Admin callers receive all attendance records.
- Student callers receive only their own attendance records.

### `POST /api/attendance`

- Requires admin session.
- Creates one attendance record.

### `PATCH /api/attendance/:id`

- Requires admin session.
- Updates one attendance record.

### `DELETE /api/attendance/:id`

- Requires admin session.
- Deletes one attendance record.

### `GET /api/grade-types`

- Requires authenticated session.
- Returns hosted grade type configuration.

### `PUT /api/grade-types`

- Requires admin session.
- Replaces the hosted grade type set.
- Intended to support the current frontend draft/apply workflow.

### `GET /api/grading-criteria`

- Requires authenticated session.
- Returns hosted grading criteria settings.

### `PUT /api/grading-criteria`

- Requires admin session.
- Saves hosted grading criteria settings.

### `GET /api/tests`

- Requires authenticated session.
- Admin callers receive all grade/test records.
- Student callers receive only their own grade/test records.

### `POST /api/tests`

- Requires admin session.
- Creates one grade/test record.

### `PATCH /api/tests/:id`

- Requires admin session.
- Updates one grade/test record.

### `DELETE /api/tests/:id`

- Requires admin session.
- Deletes one grade/test record.

## Frontend Integration Direction

- Hosted mode should use backend-owned session cookies and `GET /api/me` for session bootstrap.
- Hosted mode should no longer rely on browser-owned login trust or `sessionStorage` as the source of truth.
- Hosted mode now reads key domains through dedicated backend APIs rather than `GET /api/state`.
- Hosted mode now writes users, students, curriculum, school configuration, planning settings, attendance, and grades through backend APIs.
- Legacy full-state behavior is still present for local/transitional mode and for any remaining admin domains that have not yet moved to hosted write APIs.

## Planned Next Endpoints

1. Run hosted browser smoke validation across the implemented session and CRUD surface.
2. Continue isolating the legacy `GET/PUT /api/state` bridge behind clearer backend domain boundaries.
