# API Contract v1 (Hosted Transition Phase)

## Base URL

- local development: `http://localhost:3000`
- hosted deployment via Apache: same-origin under the web host, for example `http://192.168.1.210`

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
- Response `401`:
  - `{ "error": "Invalid username or password." }`

### `POST /api/auth/logout`

- Response `200`:
  - `{ "ok": true }`

### `GET /api/me`

- Response `200`:
  - `{ "user": { "id": "...", "username": "...", "role": "admin|student", "studentId": "...", "mustChangePassword": false } }`
- Response `401`:
  - `{ "error": "Authentication required." }`

### `GET /api/users`

- Requires admin session.
- Response `200`:
  - array of hosted user records
- Response `401` or `403` for unauthenticated/non-admin callers

### `GET /api/students`

- Requires authenticated session.
- Admin callers receive all students.
- Student callers receive only their linked student record.

### `GET /api/subjects`

- Requires authenticated session.
- Admin callers receive all subjects.
- Student callers receive only subjects tied to their enrolled courses.

### `GET /api/courses`

- Requires authenticated session.
- Admin callers receive all courses.
- Student callers receive only courses they are enrolled in.

### `GET /api/enrollments`

- Requires authenticated session.
- Admin callers receive all enrollments.
- Student callers receive only their own enrollments.

### `GET /api/school-years`

- Requires authenticated session.
- Returns hosted school-year configuration with current-year flags.

### `GET /api/quarters`

- Requires authenticated session.
- Returns hosted quarter records across school years.

### `GET /api/attendance`

- Requires authenticated session.
- Admin callers receive all attendance records.
- Student callers receive only their own attendance records.

### `GET /api/tests`

- Requires authenticated session.
- Admin callers receive all grade/test records.
- Student callers receive only their own grade/test records.

## Frontend Integration Direction

- Hosted mode should use backend-owned session cookies and `GET /api/me` for session bootstrap.
- Hosted mode should no longer rely on browser-owned login trust or `sessionStorage` as the source of truth.
- `GET /api/users`, `GET /api/students`, `GET /api/subjects`, `GET /api/courses`, `GET /api/enrollments`, `GET /api/school-years`, `GET /api/quarters`, `GET /api/attendance`, and `GET /api/tests` are now part of the hosted read bridge away from full-state sync.
- Remaining hosted domains still rely on transitional local/full-state behavior until their domain APIs are added.

### `GET /api/students`

- Response `200`:
  - Array of:
    - `id`
    - `firstName`
    - `lastName`
    - `birthdate`
    - `grade`
    - `ageRecorded`
    - `createdAt`

## Planned Next Endpoints

1. `GET/POST/PUT/DELETE /api/subjects`
2. `GET/POST/PUT/DELETE /api/courses`
3. `GET/POST/DELETE /api/enrollments`
4. `GET/POST/PUT /api/attendance`
5. `GET/POST/PUT /api/tests`
6. `GET/POST/PUT /api/plans`
7. `GET/PUT /api/settings` (school years, quarters, holidays, grade types)
