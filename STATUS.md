# Status Board

Date: 2026-03-27

## Done
- Completed the MVP/local-first app with student, curriculum, planning, attendance, grades, dashboard, and report functionality.
- Added login UX, system-user administration, and student read-only behavior in the frontend.
- Proved a transitional backend persistence path with SQL-backed state sync and migration tooling.
- Documented the hosted product direction:
  - `NOTES/target-architecture.md`
  - `NOTES/milestone-1-production-plan.md`
  - `NOTES/postgresql-schema-v1.md`
  - `NOTES/backend-auth-api-refactor-plan.md`
- Reframed the roadmap around a production-ready single-tenant deployment as the prerequisite for later SaaS multi-tenancy.

## In Progress
- Milestone 4 planning: production single-tenant platform on Debian, Apache, Node.js, and PostgreSQL.
- Defining the backend auth/session approach to replace browser-owned security.
- Defining the first domain APIs that will replace `GET/PUT /api/state` for production use.
- Added the first PostgreSQL-hosted backend slice in repo code:
  - PostgreSQL config/env support
  - initial PostgreSQL schema migration asset
  - bootstrap admin seed script
  - backend-owned auth/session endpoints for PostgreSQL mode
  - PostgreSQL-backed `GET /api/users`, `GET /api/me`, and protected `GET /api/students`
- Validated infrastructure access and state:
  - SSH access to `APP001` works
  - Proxmox inventory is reachable through `/home/debian/bin/proxmoxctl`
  - PostgreSQL connectivity to `SQL001` works
  - `appdb` currently has no application tables
- Applied the hosted PostgreSQL schema and bootstrap admin seed on `SQL001`.
- Installed and started a managed user `systemd` service for the API on `APP001`.
- Added deployable infrastructure assets in-repo:
  - `infra/systemd/home-school-management.service`
  - `infra/apache/home-school-management.conf`
  - `RUNBOOKS/hosted-deployment.md`
- Applied the Apache hosted site on `WEB001`:
  - SPA files deployed to `/var/www/home-school-management/web`
  - proxy modules enabled
  - `home-school-management.conf` enabled
  - hosted root and proxied `/health` verified on `WEB001`
- Refactored the frontend hosted path to prefer backend-owned auth/session bootstrap:
  - hosted runtime now targets same-origin API calls through Apache
  - frontend login/logout/bootstrap now uses `POST /api/auth/login`, `POST /api/auth/logout`, and `GET /api/me` in hosted mode
  - first hosted domain reads now use `GET /api/users` and `GET /api/students`
- Expanded hosted domain-read coverage:
  - backend now exposes PostgreSQL-backed `GET /api/subjects`, `GET /api/courses`, `GET /api/enrollments`, `GET /api/school-years`, and `GET /api/quarters`
  - hosted frontend hydration now refreshes users, students, subjects, courses, enrollments, school years, and quarters from backend APIs
- Expanded hosted read coverage again for attendance and grades:
  - backend now exposes PostgreSQL-backed `GET /api/attendance` and `GET /api/tests`
  - hosted frontend hydration now refreshes attendance and tests from backend APIs during session bootstrap
- Added first control-plane scaffolding:
  - `admin/` operator-console placeholder
  - `control-api/` placeholder
  - `NOTES/control-plane-foundation.md`

## Blocked
- No technical blockers inside the repo.
- Future deployment validation will require access to Debian hosts and PostgreSQL infrastructure.
- Direct SSH validation to `SQL001` from this PC still needs to be confirmed separately; current confirmed database path remains through `APP001`.

## Next
1. Document the backend auth/session model and protected endpoint contract.
2. Verify hosted login and shell bootstrap through `WEB001` in a browser after the frontend auth refactor.
3. Expand domain APIs beyond the current hosted read bridge and retire more hosted dependence on full-state behavior.
4. Plan the repository-layer transition from transitional SQL state sync to PostgreSQL domain persistence.
5. Replace temporary bootstrap-admin operations with a controlled hosted admin initialization flow.

## Current Assessment
- The app is a strong functional product foundation.
- The current architecture is not yet SaaS-ready because auth and authorization are still too browser-centric and the backend still leans on full-state synchronization.
- The immediate objective is not multi-tenancy first; it is establishing a secure hosted single-tenant platform that multi-tenancy can safely build on.
