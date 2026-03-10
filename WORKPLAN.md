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

## Milestone 3: MSSQL Migration Prep (In Progress)
- Owner: Backend/API Engineer
- Goal: Prepare schema, migration tooling, and cutover plan for SQL Server Express
- Dependencies: Milestone 2
- Workstreams:
  - [x] Analyze current state model from `web/app.js`
  - [x] Define SQL schema and relational constraints
  - [x] Scaffold migration and import scripts in `server/`
  - [x] Execute data migration into SQL Server Express and validate row parity
  - [x] Implement API full-state sync endpoints (`GET/PUT /api/state`)
  - [x] Wire frontend persistence to API state sync with local fallback cache
  - [ ] Implement API endpoints used by frontend
  - [ ] Validate row parity and regression checks

## Parallel Workstreams (Current)

1. Backend/API Engineer (owner: `server/`)
   - Build `/api` endpoints and transaction-safe CRUD
2. Data Migration Engineer (owner: `server/src/scripts/`, `NOTES/mssql-migration-plan.md`)
   - Finalize mapping checks and dry-run import flow
3. Frontend Engineer (owner: `web/`)
   - Prepare data adapter layer for local-storage to API cutover
4. QA & Release Agent (owner: `CHECKLISTS/mssql-cutover.md`)
   - Define migration acceptance gates and rollback test

## Active Next Actions

1. Receive SQL Server Express connection details and credentials from user.
2. Run `npm install`, `npm run db:migrate`, then dry-run `db:import-state`.
3. Implement and wire frontend API calls for students/subjects/courses first.
