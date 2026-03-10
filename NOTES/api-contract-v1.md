# API Contract v1 (Migration Phase)

## Base URL

- `http://localhost:3000`

## Endpoints Implemented

### `GET /health`

- Response `200`:
  - `{ "ok": true }`
- Response `500`:
  - `{ "ok": false, "error": "..." }`

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
