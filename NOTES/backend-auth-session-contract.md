# Backend Auth and Session Contract

## Purpose
Document the current hosted authentication, session, and endpoint-protection model that the PostgreSQL-backed backend enforces.

## Scope
- hosted single-tenant deployment
- PostgreSQL-backed backend mode
- tenant-facing app authentication and authorization

## Runtime Mode
- Auth, setup, and hosted domain endpoints are active only when `DB_CLIENT=postgres`.
- In non-PostgreSQL mode, hosted auth/setup/domain routes return `404` for the PostgreSQL-only surfaces.
- The transitional `GET /api/state` and `PUT /api/state` bridge remains separate from this contract.

## Session Model

### Session Storage
- Sessions are stored in PostgreSQL table `user_sessions`.
- The browser receives only an opaque session token.
- The backend stores only the SHA-256 hash of that token.
- A session is valid only when:
  - the token hash matches a stored session
  - `revoked_at IS NULL`
  - `expires_at > NOW()`

### Cookie Shape
- Session cookie name defaults to `hsm_session`.
- Cookie attributes are backend-owned:
  - `Path=/`
  - `HttpOnly`
  - `SameSite=Lax` by default
  - `Secure` when `SESSION_COOKIE_SECURE=true`
- Cookie TTL is controlled by `SESSION_TTL_HOURS`.

### Auth Context
- Every request passes through the auth-context middleware in PostgreSQL mode.
- The middleware reads the configured session cookie, hashes the token, and loads the matching non-revoked unexpired session.
- The request is populated as:
  - `req.auth.user`
  - `req.auth.session`
- When no valid session is present:
  - `req.auth.user = null`
  - `req.auth.session = null`

## Password Model
- Hosted password hashing is backend-owned.
- New hosted passwords use PBKDF2 SHA-256 with:
  - random per-password salt
  - 120000 iterations
  - 32-byte derived key
- Legacy frontend-hash verification still exists as a compatibility fallback when an older record has not yet been replaced with PBKDF2-backed credentials.

## Setup Flow

### Public Setup Endpoints
- `GET /api/setup/status`
- `POST /api/setup/initialize`

### Setup Guarantees
- Setup is allowed only while no admin exists and runtime setup is incomplete.
- Setup tokens are stored hashed in `setup_tokens`.
- Setup tokens are one-time-use and time-limited.
- Successful setup:
  - creates the first admin
  - marks setup complete in `app_runtime_state`
  - consumes the setup token
  - creates a normal authenticated session

## Login and Logout Flow

### Login
1. Client sends `POST /api/auth/login` with username and password.
2. Backend verifies credentials.
3. Backend creates a session row in `user_sessions`.
4. Backend sets the session cookie.
5. Backend returns the user summary.

### Logout
1. Client sends `POST /api/auth/logout`.
2. Backend hashes the current cookie token.
3. Backend revokes the matching session if it exists.
4. Backend clears the session cookie.

### Session Bootstrap
- Client uses `GET /api/me` to determine whether a valid hosted session exists.
- `GET /api/me` returns `401` when no authenticated session is present.

## Authorization Rules

### Public
- `GET /api/setup/status`
- `POST /api/setup/initialize`
- `GET /health`

### Authenticated Session Required
- `GET /api/me`
- hosted read endpoints for:
  - students
  - subjects
  - courses
  - enrollments
  - school years
  - quarters
  - daily breaks
  - holidays
  - plans
  - attendance
  - grade types
  - grading criteria
  - tests

### Admin Session Required
- all hosted write endpoints
- all hosted user-management endpoints
- all hosted setup-token generation remains operator/CLI-driven and is not browser-exposed

## Role Behavior

### Admin Users
- full hosted read/write access across tenant-facing domains

### Student Users
- no admin-write access
- scoped read access only to their linked student data where route-specific filtering applies

## Read-Filtering Contract

### Fully Scoped To Current Student
- `GET /api/students`
- `GET /api/enrollments`
- `GET /api/plans`
- `GET /api/attendance`
- `GET /api/tests`

### Scoped By Student-Linked Curriculum
- `GET /api/subjects`
- `GET /api/courses`

### Scoped By Student Membership
- `GET /api/daily-breaks`

### Currently Shared To Any Authenticated User
- `GET /api/school-years`
- `GET /api/quarters`
- `GET /api/holidays`
- `GET /api/grade-types`
- `GET /api/grading-criteria`

## Expected Error Semantics
- `400` for invalid payloads or invalid setup tokens
- `401` for missing or invalid authenticated session
- `403` for authenticated non-admin access to admin endpoints
- `404` for PostgreSQL-only routes when not in PostgreSQL mode, or for missing records on update/delete operations
- `409` for setup attempts after initialization is already complete
- `500` for unexpected backend failures

## Operational Notes
- The hosted browser should treat `GET /api/me` as the source of truth for signed-in state.
- The hosted first-run UI should treat `GET /api/setup/status` as the source of truth for setup visibility.
- Operators should use `npm run db:create-setup-token` for first-run hosted admin establishment.
- The retired bootstrap-admin seed path is no longer part of the production contract.
