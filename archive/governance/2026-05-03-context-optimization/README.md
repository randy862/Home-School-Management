# Home School Management

Home School Management is a web application for managing students, courses, plans, attendance, grades, reports, and system users.

The repository currently contains:
- a working customer-facing SPA in `web/`
- a transitional Node backend in `server/`
- planning assets for the next architecture phase: production deployment on Debian with Apache, Node.js, and PostgreSQL

The active platform direction is:
1. production-ready single-tenant hosting
2. backend-owned auth and domain APIs
3. later multi-tenant SaaS expansion

## Authentication

- Administrators can access every page and manage user accounts from the `Users` page.
- Student accounts are linked to a student record and are limited to read-only access on Dashboard, Schedule, Attendance, and Grades.
- Existing installs currently bootstrap a default admin login:
  - Username: `admin`
  - Password: `ChangeMe123!`
  - This is a transitional local/prototype behavior that will be replaced by backend-owned auth before hosted deployment.

## Strategic Direction

The next major milestone is a hosted single-tenant deployment that establishes:
- backend-enforced authentication and authorization
- PostgreSQL as the target runtime database
- domain APIs that replace full-state synchronization
- deployment assets for Apache reverse proxy and Debian application hosting

Reference planning docs:
- `NOTES/target-architecture.md`
- `NOTES/milestone-1-production-plan.md`
- `NOTES/postgresql-schema-v1.md`
- `NOTES/backend-auth-api-refactor-plan.md`

## Project Layout

- `web/` customer-facing frontend SPA
- `server/` current backend and transitional persistence work
- `RUNBOOKS/` repeatable operating procedures
- `CHECKLISTS/` quality, handoff, and deployment gates
- `PROMPTS/` reusable role prompts
- `NOTES/` architecture, discovery, and migration planning notes
- root governance files: `AGENTS.md`, `WORKPLAN.md`, `STATUS.md`, `DECISIONS.md`

## Local Start

1. One-click startup (recommended):
   - Open PowerShell.
   - Run:
     - `cd "C:\Users\rmitchell\OneDrive - Kalleo Technologies, LLC\VSCode\Home-School-Management"`
     - `.\run-local.ps1`
2. Optional configuration update:
   - `run-local.ps1` auto-creates `.env` from `.env.example` if `.env` is missing.
   - Edit `.env` only if you need to change SQL connection values.
3. Manual startup (if needed):
   - API listener:
     - `cd "C:\Users\rmitchell\OneDrive - Kalleo Technologies, LLC\VSCode\Home-School-Management\server"`
     - `npm install`
     - `npm start`
   - Static web server from repo root:
     - `python -m http.server 5500`
4. Open `http://127.0.0.1:5500/web/`.

## Transitional SQL Bridge

The repo includes an MSSQL-based bridge used to prove backend persistence and migration mechanics during the current transition. That work remains useful for reference and data-shape discovery, but it is not the intended long-term hosted architecture.

## Collaboration Cadence

1. Plan and ownership in `WORKPLAN.md`.
2. Live delivery status in `STATUS.md`.
3. Decision rationale in `DECISIONS.md`.
4. Agent interfaces and handoff rules in `AGENTS.md`.
