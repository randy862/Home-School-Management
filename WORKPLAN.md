# Workplan

## Milestone 1: Foundation (Complete)
- Owner: CEO Orchestrator
- Goal: Establish project operating model and baseline app scaffold
- Workstreams:
  - [x] Governance docs and folder structure
  - [x] Initial multi-agent roster and prompts
  - [x] Frontend MVP scaffold in `web/`

## Milestone 2: MVP Local-First App (Complete)
- Owner: Frontend Engineer
- Goal: Deliver a working local-storage MVP
- Workstreams:
  - [x] Student/subject/course/enrollment management
  - [x] Planning/calendar, attendance, and grade features
  - [x] Dashboard analytics and reporting views

## Milestone 3: Transitional SQL Bridge (Complete)
- Owner: Backend/API Engineer
- Goal: Prove backend persistence, migration mechanics, and initial auth-related state handling
- Dependencies: Milestone 2
- Workstreams:
  - [x] Analyze current state model from `web/app.js`
  - [x] Define transitional relational schema and constraints
  - [x] Scaffold migration and import scripts in `server/`
  - [x] Execute SQL import and validate row parity
  - [x] Implement API full-state sync endpoints (`GET/PUT /api/state`)
  - [x] Wire frontend persistence to API state sync with local fallback cache

## Milestone 4: Production Single-Tenant Platform (In Progress)
- Owner: CEO Orchestrator
- Goal: Rebuild the app as a production-ready single-tenant web platform on Debian, Apache, Node.js, and PostgreSQL
- Dependencies: Milestone 3
- Reference Docs:
  - `NOTES/target-architecture.md`
  - `NOTES/milestone-1-production-plan.md`
  - `NOTES/postgresql-schema-v1.md`
  - `NOTES/backend-auth-api-refactor-plan.md`
  - `NOTES/postgres-repository-transition-plan.md`
- Workstreams:
  - [x] Define target architecture and deployment topology
  - [x] Define Milestone 1 scope, sequencing, and acceptance criteria
  - [x] Define PostgreSQL schema direction for hosted runtime
  - [x] Choose backend session/auth approach and document endpoint contract
  - [x] Design first hosted domain-read APIs to replace more of full-state sync in production
  - [ ] Refactor backend toward PostgreSQL-backed repositories
  - [x] Refactor frontend login/bootstrap to use backend auth
  - [x] Create Debian/Apache deployment assets and runbooks
  - [x] Define PostgreSQL repository transition plan for hosted runtime
  - [ ] Run production readiness smoke checks

## Milestone 5: Multi-Tenant SaaS Foundation (Planned)
- Owner: CEO Orchestrator
- Goal: Introduce tenant-aware backend architecture and a control plane
- Dependencies: Milestone 4
- Workstreams:
  - [x] Add control-plane data model for tenants, domains, plans, and provisioning jobs
  - [x] Add tenant resolution and tenant database routing
  - [x] Add tenant bootstrap/provisioning workflow
  - [x] Define operator authentication/session contract separately from tenant auth
  - [x] Add operator-facing tenant management interface
  - [x] Add initial `control-api/` service scaffold and first route groups
  - [x] Implement first platform-admin mutation paths and operator bootstrap flow in `control-api/`
  - [x] Implement first queued-job execution and event logging in `control-api`
  - [x] Run tenant runtime migration/setup-token automation from queued jobs
  - [x] Propagate tenant setup completion back into control-plane environment state

## Parallel Workstreams (Current)

1. CEO Orchestrator (owner: root governance docs)
   - Maintain production roadmap, milestone scope, and delivery sequencing
2. Product Architect (owner: `NOTES/`)
   - Define target architecture, PostgreSQL schema, and API boundary decisions
3. Backend/API Engineer (owner: `server/`)
   - Prepare auth/session design and first domain API refactor plan
4. Frontend Engineer (owner: `web/`)
   - Prepare frontend integration path away from full-state sync and browser-owned auth
5. QA & Release Agent (owner: `CHECKLISTS/`, `RUNBOOKS/`, `STATUS.md`)
   - Define production readiness checks and deployment validation path

## Active Next Actions

1. Complete Session 5 control-plane UI polish and naming cleanup.
   - [x] Review remaining technical labels and replace them with more business-facing language where appropriate.
   - [x] Improve hierarchy, spacing, and detail layout so audit, jobs, lifecycle views, and user management feel cohesive.
   - [ ] Recheck the main `/control/` flows on desktop and mobile after the latest sidebar and user-management pass using `CHECKLISTS/control-ui-smoke.md`, including the new stacked mobile table layout.
2. Complete the new operator-permission model end to end.
   - [x] Add operator profiles, explicit permissions, and a user-management workspace in `/control/`.
   - [x] Replace coarse control-plane mutation guards with permission-aware route checks.
   - [x] Add more operator safeguards and recovery ergonomics.
   - [x] Run a live staged permission-validation matrix across read-only, customer/environment, operations, and user-admin accounts, including self-service password changes.
   - [x] Decide whether non-user-admin operators should see the `User Management` workspace in read-only mode or have it hidden entirely.
   - [x] Hide `User Management` for operators without `manageUsers` in both the UI and backend reads, then revalidate staging.
3. Consider a broader support/operations history view on top of the new audit API after the main UI pass.
4. Keep hosted browser smoke validation as the regression gate after each major backend-boundary slice.
   - [x] Run a broader staged hosted-app smoke pass against the currently served runtime.
   - [x] Fix smoke-discovered hosted create-route and calendar export regressions on `APP001`.
   - [x] Correct the staged tenant-app runtime so the served app actually loads tenant `PGOPTIONS` and the intended tenant schema instead of PostgreSQL `public`.
   - [x] Add and validate a broader staged hosted workflow script that exercises real admin and student flows beyond API reachability.
   - [x] Rerun the scripted release gate after the broader hosted workflow pass.
5. Continue backend/platform hardening and legacy bridge retirement.
   - [x] Isolate the transitional `/api/state` bridge behind explicit legacy module naming in the server and frontend.
   - [x] Wrap the remaining local-only merge/backfill bootstrap logic behind explicit legacy-bridge helpers in `web/app.js`.
   - [x] Stop running startup legacy attendance backfill in hosted mode.
   - [x] Centralize legacy bootstrap-admin checks so hosted-capable UI code no longer carries scattered default-admin logic.
   - [x] Rename bootstrap-admin frontend helpers/constants so they are explicitly marked as legacy/local-only.
   - [x] Extract local-only plan mutation helpers so plan submit flow separates hosted writes from legacy bridge writes.
   - [x] Extract local-only school-year and quarter mutation helpers so schedule settings forms separate hosted writes from legacy bridge writes.
   - [x] Extract local-only daily-break and holiday mutation helpers so schedule admin flows separate hosted writes from legacy bridge writes.
   - [x] Standardize remaining local delete paths behind explicit legacy helper names for admin actions.
   - [x] Extract local-only create/update helpers for core admin forms so hosted and legacy mutation paths read consistently.
   - [x] Extract local-only attendance and grade mutation helpers so instructional record flows read consistently too.
   - [x] Extract local-only grade-settings helpers so grading settings read consistently too.
   - [x] Standardize the remaining local plan delete path behind an explicit legacy helper.
   - [x] Start server-side repository/service hardening with a grading service boundary.
   - [x] Continue server-side repository/service hardening with a calendar service boundary.
   - [x] Continue server-side repository/service hardening with a curriculum service boundary.
   - [x] Continue server-side repository/service hardening with the records domain after grading, calendar, and curriculum.
   - [x] Decide whether the next item 4 slice should be repository extraction or staged smoke validation of the new service-boundary backend shape.
   - [x] Decide that repository extraction is the next item 4 slice after the service-boundary smoke pass.
   - [x] Start Phase 4 repository extraction with a grading repository boundary.
   - [x] Continue Phase 4 repository extraction with a records repository boundary.
   - [x] Validate the new grading/records repository boundaries on staged hosted runtime after deployment.
   - [x] Continue Phase 4 repository extraction with a calendar repository boundary.
   - [x] Continue Phase 4 repository extraction with a curriculum repository boundary.
   - [x] Validate the new calendar/curriculum repository boundaries on staged hosted runtime after deployment.
   - [x] Reassess whether additional shared repository cleanup is worth doing before moving to item 5.
   - [x] Decide that additional shared repository cleanup is lower value than release-process hardening unless a concrete backend risk appears.
6. Start item 5 release and recovery hardening.
   - [x] Rewrite `RUNBOOKS/hosted-deployment.md` to match the actual staged deployment topology and recovery experience.
   - [x] Add a concise staged release checklist and rollback checklist derived from the new runbook.
   - [x] Add a control-plane recovery/runbook companion for queued job failures and operator-side incident response.
   - [x] Add a short-form control-plane incident checklist for faster operator triage.
   - [x] Decide that the current runbooks and checklists are sufficient for the first item 5 checkpoint.
   - [x] Add repeatable workstation validation hooks for the hosted smoke pass and combined release gate.
   - [x] Run the new staged release gate end to end against the live hosted app and control plane.
   - [x] Rehearse one real staged rollback path and revalidate the environment through the same scripted release gate.
7. Final staged readiness assessment.
   - [x] Run the current validation hooks as written without relying on ad hoc memory.
   - [x] Confirm app/control services are healthy and review recent journals for unresolved blockers.
   - [x] Produce a current staged go/no-go call with residual risks.
8. Production cutover planning and checklist hardening.
   - [x] Add a production-specific cutover runbook on top of the staged deployment guide.
   - [x] Add a short-form production cutover checklist.
   - [x] Add an explicit production-cutover worksheet for owners, target host/path/TLS decisions, secrets/config confirmation, and the first cutover window.
   - [x] Fill in the named owner assignments for the first cutover window.
   - [ ] Fill in real owner assignments, target hostname/TLS details, and production secret/config confirmations for the first actual cutover window.
