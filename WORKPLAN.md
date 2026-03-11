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

1. Frontend Engineer (owner: `web/`)
   - Add login screen, Users page, role-based navigation, and student view restrictions
2. Backend/API Engineer (owner: `server/`)
   - Persist user accounts in SQL-backed state sync and keep legacy DBs compatible
3. QA & Release Agent (owner: `CHECKLISTS/`, `STATUS.md`)
   - Smoke-test admin create/edit flows and student read-only restrictions
4. CEO Orchestrator (owner: root governance docs)
   - Record auth model, rollout assumptions, and feature status

## Active Next Actions

1. Verify the new Users/login flow in the browser against the local API path.
2. Re-run SQL migration so `dbo.users` exists as a first-class table.
3. Confirm default admin bootstrap and student-linked login behavior end to end.
