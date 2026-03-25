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
- Workstreams:
  - [x] Define target architecture and deployment topology
  - [x] Define Milestone 1 scope, sequencing, and acceptance criteria
  - [x] Define PostgreSQL schema direction for hosted runtime
  - [ ] Choose backend session/auth approach and document endpoint contract
  - [ ] Design first domain APIs to replace full-state sync in production
  - [ ] Refactor backend toward PostgreSQL-backed repositories
  - [ ] Refactor frontend login/bootstrap to use backend auth
  - [ ] Create Debian/Apache deployment assets and runbooks
  - [ ] Run production readiness smoke checks

## Milestone 5: Multi-Tenant SaaS Foundation (Planned)
- Owner: CEO Orchestrator
- Goal: Introduce tenant-aware backend architecture and a control plane
- Dependencies: Milestone 4
- Workstreams:
  - [ ] Add control-plane data model for tenants, domains, plans, and provisioning jobs
  - [ ] Add tenant resolution and tenant database routing
  - [ ] Add tenant bootstrap/provisioning workflow
  - [ ] Add operator-facing tenant management interface

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

1. Choose the backend auth/session pattern and document the endpoint contract.
2. Design the first domain endpoints that will replace `GET/PUT /api/state`.
3. Define the initial PostgreSQL migration/repository strategy for the hosted runtime.
4. Prepare Debian deployment assets for Apache reverse proxy and app service startup.
