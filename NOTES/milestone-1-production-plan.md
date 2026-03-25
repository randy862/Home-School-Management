# Milestone 1 Production Plan

## Goal
Deliver a production-ready single-tenant deployment of Home School Management on Debian Linux with Apache, Node.js, and PostgreSQL.

This milestone is intentionally not multi-tenant. Its purpose is to establish the security model, backend boundaries, deployment pattern, and PostgreSQL persistence model that later multi-tenancy will build on.

## Scope

### In Scope
- PostgreSQL as the runtime database target
- backend-enforced authentication and authorization
- domain-based API endpoints replacing full-state sync
- Debian deployment pattern for Apache + app service + PostgreSQL
- migration planning from the current state model
- initial operational runbooks and validation checklists

### Out of Scope
- self-service customer signup
- billing integration
- tenant management UI
- multi-tenant routing and provisioning
- custom domains

## Workstreams

### 1. Backend Security Foundation
- Owner: Backend/API Engineer
- Outcomes:
  - server-side login/logout/session handling
  - password hashing performed on the server
  - role enforcement on protected endpoints
  - removal plan for default frontend bootstrap credential handling

### 2. PostgreSQL Data Model
- Owner: Product Architect + Backend/API Engineer
- Outcomes:
  - normalized PostgreSQL schema for core entities
  - migration strategy from current browser/full-state model
  - seed/bootstrap approach for first admin account

### 3. Domain API Refactor
- Owner: Backend/API Engineer
- Outcomes:
  - replace `GET/PUT /api/state` as the primary production interface
  - add entity-oriented endpoints for students, courses, attendance, grades, users, and reports
  - define DTOs, validation rules, and permissions per endpoint

### 4. Frontend Integration Refactor
- Owner: Frontend Engineer
- Outcomes:
  - UI updated to consume domain APIs
  - session-aware app bootstrap
  - reduced local-storage dependence

### 5. Deployment and Operations
- Owner: QA & Release Agent + CEO Orchestrator
- Outcomes:
  - Apache reverse proxy configuration plan
  - Debian service model
  - environment variable contract
  - backup, rollback, smoke-test, and release runbooks

## Ordered Execution Plan
1. Define PostgreSQL schema and auth/session model.
2. Implement backend auth endpoints and middleware.
3. Implement first domain APIs for users and students.
4. Refactor frontend login/session bootstrap to use backend auth.
5. Continue domain API expansion for courses, attendance, grades, and reports.
6. Deprecate production reliance on full-state sync.
7. Add Debian deployment assets and runbooks.
8. Run smoke tests and production readiness review.

## Initial Deliverables
- PostgreSQL schema design doc
- endpoint inventory and refactor map
- backend auth design
- updated workplan and status board
- deployment topology doc

## Acceptance Criteria
- The app can run as a single-tenant web application behind Apache on Debian.
- Browser-only role enforcement is no longer the primary security mechanism.
- Core data reads/writes are available through domain APIs.
- PostgreSQL is the target production persistence model.
- Deployment and rollback steps are documented.

## Risks
- The current monolithic frontend may slow API integration work until responsibilities are split.
- Existing full-state save behavior can hide domain ownership problems if it remains in parallel too long.
- Dual-database transition work may create confusion unless PostgreSQL is clearly declared the production target.

## Dependencies
- Access to a Debian-based app host and PostgreSQL host for later validation
- final choice of session mechanism
- final choice of PostgreSQL migration/query tooling

## Recommended Technical Decisions for This Milestone
- Use PostgreSQL as the production database target.
- Keep Node.js/Express for the backend to preserve delivery momentum.
- Use Apache only as ingress/reverse proxy, not as the application runtime.
- Treat the current MSSQL bridge work as transitional reference material, not the long-term hosted target.
