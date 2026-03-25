# Status Board

Date: 2026-03-25

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

## Blocked
- No technical blockers inside the repo.
- Future deployment validation will require access to Debian hosts and PostgreSQL infrastructure.

## Next
1. Document the backend auth/session model and protected endpoint contract.
2. Define the first production domain endpoints and map them to current frontend workflows.
3. Plan the repository-layer transition from transitional SQL state sync to PostgreSQL domain persistence.
4. Add deployment/runbook assets for Apache reverse proxy and Debian service startup.

## Current Assessment
- The app is a strong functional product foundation.
- The current architecture is not yet SaaS-ready because auth and authorization are still too browser-centric and the backend still leans on full-state synchronization.
- The immediate objective is not multi-tenancy first; it is establishing a secure hosted single-tenant platform that multi-tenancy can safely build on.
