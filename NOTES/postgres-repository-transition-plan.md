# PostgreSQL Repository Transition Plan

## Purpose
Define how Home School Management moves from the current mixed bridge architecture into a backend organized around PostgreSQL-backed domain repositories, while safely retiring hosted dependence on legacy full-state synchronization.

## Current State
- `server/src/app.js` currently mixes route definitions, auth checks, payload normalization, and direct store calls in one file.
- Hosted mode already uses PostgreSQL-backed auth plus domain APIs for:
  - users
  - students
  - subjects
  - courses
  - enrollments
  - school years
  - quarters
  - attendance
  - tests
  - daily breaks
  - holidays
  - plans
  - grade types
  - grading criteria
- Local/MSSQL mode still depends on `readState()` and `writeState()` through `server/src/state-store.js`.
- The hosted frontend still coexists with browser-owned mutation logic for domains that do not yet have backend writes.

## Problems To Solve
- Route handlers are becoming too large and domain knowledge is still concentrated in `server/src/app.js`.
- Validation rules are duplicated between frontend behavior and backend payload shaping.
- Legacy full-state code remains in the main API process, which makes the production boundary harder to reason about.
- The repo has store modules, but not yet a consistent repository/service/controller structure.

## Target Backend Shape

### Layers
- `routes`:
  - HTTP-only concerns
  - auth/role middleware attachment
  - request/response shaping
- `services`:
  - domain workflows
  - validation orchestration
  - cross-repository transactions
- `repositories`:
  - PostgreSQL data access by domain
  - no HTTP concerns
- `legacy-bridge`:
  - transitional MSSQL/full-state sync only
  - isolated from hosted production paths

### Domain Modules To Introduce
- `auth`
- `users`
- `students`
- `curriculum`
  - subjects
  - courses
  - enrollments
- `calendar`
  - school years
  - quarters
  - holidays
  - daily breaks
  - plans
- `grading`
  - grade types
  - grading criteria
  - tests
- `attendance`

## Recommended Sequence

### Phase 1: Stabilize Current Hosted Surface
- Keep existing endpoints and payload shapes stable.
- Finish browser smoke validation for hosted login and settings/admin CRUD.
- Update `NOTES/api-contract-v1.md` to reflect the actual hosted endpoint surface.

### Phase 2: Extract Controllers and Middleware
- Move repeated auth/role checks out of route bodies into helpers or middleware.
- Split `server/src/app.js` by domain route registration.
- Keep behavior unchanged while reducing file size and route duplication.

### Phase 3: Introduce Service Boundaries
- Create service modules for:
  - `calendar`
  - `grading`
  - `curriculum`
  - `attendance`
- Move payload normalization and business rules from `app.js` into services.
- Let services call current PostgreSQL store functions first; do not combine structural refactor with broad behavior changes.

### Phase 4: Normalize Repository Ownership
- Rename or reorganize PostgreSQL store modules around domains instead of mixed slices.
- Preferred destination:
  - `server/src/repositories/postgres/auth-repository.js`
  - `server/src/repositories/postgres/student-repository.js`
  - `server/src/repositories/postgres/curriculum-repository.js`
  - `server/src/repositories/postgres/calendar-repository.js`
  - `server/src/repositories/postgres/grading-repository.js`
  - `server/src/repositories/postgres/attendance-repository.js`
- Keep each repository focused on persistence mapping only.

### Phase 5: Isolate Legacy Full-State Bridge
- Move `readState` and `writeState` usage behind a clearly named legacy module.
- Restrict `GET/PUT /api/state` to local bridge mode only.
- Remove any hosted-mode fallback assumptions that expect full-state sync to exist.

### Phase 6: Retire Hosted Dependence On Legacy State Sync
- Confirm hosted mode no longer calls `GET/PUT /api/state`.
- Remove hosted-only merge/backfill code that exists solely to reconcile browser state with bridge payloads.
- Keep local migration/import tooling available separately until cutover is complete.

## Delivery Rules
- Do not rewrite endpoint contracts and repository structure in the same slice unless necessary.
- Prefer thin, behavior-preserving extractions first.
- Keep one domain owner per slice to reduce regressions.
- Preserve student scoping rules in backend-owned reads and writes.
- Every new hosted write path should be verified against admin and student sessions.

## Proposed Next Implementation Slices

### Slice A
- Update hosted API contract documentation.
- Add a simple auth/role middleware helper layer.
- Extract calendar routes from `server/src/app.js`.

### Slice B
- Extract grading routes and services.
- Centralize grade settings validation in one backend module.

### Slice C
- Extract curriculum routes and services.
- Begin adding backend-owned writes for subjects, courses, and enrollments.

### Slice D
- Extract attendance and tests into domain services/repositories.
- Reduce remaining browser-owned mutation paths.

### Slice E
- Move legacy `api/state` bridge into an isolated module.
- Remove hosted transition code that is no longer needed.

### Slice E Progress
- `server/src/legacy/local-state-bridge.js` now owns the `readState` / `writeState` handoff for the transitional bridge.
- `server/src/routes/state-routes.js` now presents `/api/state` explicitly as a legacy full-state path.
- `web/app.js` now treats the bridge helpers as local-only synchronization utilities instead of generic hosted API bootstrap/save paths.

## Exit Criteria
- `server/src/app.js` is primarily bootstrap and route registration.
- Hosted production paths no longer rely on `readState()` or `writeState()`.
- Domain behavior is organized by repository and service boundaries.
- `GET/PUT /api/state` is clearly legacy-only or removed from hosted production runtime.
- The frontend hosted mode no longer needs bridge-era merge logic for production use.
