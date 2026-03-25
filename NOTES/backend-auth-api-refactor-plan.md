# Backend Auth and Domain API Refactor Plan

## Purpose
Define the first backend implementation slice that moves Home School Management away from browser-owned security and full-state synchronization.

## Current Problems
- Authentication is primarily controlled in the frontend.
- Authorization decisions are largely enforced in browser code.
- The backend exposes broad full-state read/write behavior that is too coarse for hosted production use.
- Session state is not yet backed by a server-owned trust model.

## Milestone 1 Refactor Goals
- move login/logout/session validation to the backend
- enforce roles on the backend
- keep the existing frontend mostly intact while swapping data sources behind it
- replace production dependence on `GET/PUT /api/state`

## Recommended Auth Model

### Session Approach
- Use server-issued session cookies for the hosted single-tenant deployment.
- Cookie characteristics:
  - `HttpOnly`
  - `Secure` in hosted environments
  - `SameSite=Lax` initially
- Store session records in PostgreSQL or a server-side session store abstraction.

### Login Flow
1. `POST /api/auth/login`
2. backend validates username/password
3. backend creates session
4. backend returns current user summary
5. frontend bootstraps from authenticated session instead of `sessionStorage`

### Logout Flow
1. `POST /api/auth/logout`
2. backend invalidates session
3. frontend clears in-memory user context

### Session Bootstrap
1. `GET /api/me`
2. backend returns current user, role, and required UI scope
3. frontend renders based on authenticated user context

## Recommended Initial Endpoint Set

### Auth
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`

### Users
- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/:id`
- `POST /api/users/:id/reset-password`

### Students
- `GET /api/students`
- `POST /api/students`
- `PATCH /api/students/:id`
- `DELETE /api/students/:id`

### Courses and Curriculum
- `GET /api/subjects`
- `POST /api/subjects`
- `GET /api/courses`
- `POST /api/courses`
- `PATCH /api/courses/:id`
- `DELETE /api/courses/:id`
- `GET /api/enrollments`
- `POST /api/enrollments`
- `PATCH /api/enrollments/:id`
- `DELETE /api/enrollments/:id`

### Planning and Calendar
- `GET /api/school-years`
- `POST /api/school-years`
- `PATCH /api/school-years/:id`
- `GET /api/quarters`
- `POST /api/quarters`
- `PATCH /api/quarters/:id`
- `GET /api/holidays`
- `POST /api/holidays`
- `PATCH /api/holidays/:id`
- `DELETE /api/holidays/:id`
- `GET /api/plans`
- `POST /api/plans`
- `PATCH /api/plans/:id`
- `DELETE /api/plans/:id`

### Attendance and Grades
- `GET /api/attendance`
- `POST /api/attendance`
- `PATCH /api/attendance/:id`
- `DELETE /api/attendance/:id`
- `GET /api/tests`
- `POST /api/tests`
- `PATCH /api/tests/:id`
- `DELETE /api/tests/:id`

## Role Rules

### Admin
- full read/write access across the application

### Student
- read-only access to their own dashboard, schedule, attendance, grades, and reports in scope
- no write access to administration endpoints
- no access to other students' data

## First Delivery Slice

### Slice 1
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/users`
- `GET /api/students`

### Why Start Here
- unlocks backend-owned session handling
- creates the first safe bridge away from frontend-owned auth
- gives the frontend enough data to render the authenticated shell and user-linked student context

## Backend Structural Changes
- add auth middleware
- add role/permission middleware
- add repository layer by domain
- add request validation layer
- separate routing from persistence logic

## Frontend Structural Changes
- replace `sessionStorage` trust with API-driven bootstrap
- create a small API client layer
- migrate one domain at a time off of full-state sync
- keep existing screens and interaction flow stable during the backend transition

## Exit Criteria for This Refactor Track
- login state is server-owned
- protected actions fail on the server without admin permissions
- the frontend no longer depends on hardcoded bootstrap auth behavior for hosted mode
- at least the first critical domains operate through domain APIs instead of full-state sync
