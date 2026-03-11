# Home School Management

Home School Management is a single-page web app for managing students, courses, plans, attendance, grades, and system users.

This repo now includes an MSSQL migration scaffold to move persistence from browser `localStorage` to SQL Server Express.

## Authentication

- Administrators can access every page and manage user accounts from the new `Users` page.
- Student accounts are linked to a student record and are limited to read-only access on Dashboard, Schedule, Attendance, and Grades.
- Existing installs bootstrap a default admin login:
  - Username: `admin`
  - Password: `ChangeMe123!`
  - Change this password after the first sign-in.

## Project Layout

- `web/` frontend SPA (current production behavior uses local storage)
- `server/` Node API and SQL Server migration/import scaffolding
- `server/migrations/` SQL schema scripts
- `RUNBOOKS/` repeatable operating procedures
- `CHECKLISTS/` quality, handoff, and migration gates
- `PROMPTS/` reusable agent prompts
- `NOTES/` discovery, specs, and migration planning notes
- Root governance files: `AGENTS.md`, `WORKPLAN.md`, `STATUS.md`, `DECISIONS.md`

## Quick Start (API + Frontend on Local PC)

1. One-click startup (recommended):
   - Open PowerShell.
   - Run:
     - `cd "C:\Users\rmitchell\OneDrive - Kalleo Technologies, LLC\VSCode\Home-School-Management"`
     - `.\run-local.ps1`
   - Example prompt:
     - `C:\Users\rmitchell\OneDrive - Kalleo Technologies, LLC\VSCode\Home-School-Management>`
     - `.\run-local.ps1`
   - What it does:
     - Starts API listener (`server/`)
     - Starts local web server on port `5500`
     - Opens `http://127.0.0.1:5500/web/`
2. Optional configuration update:
   - `run-local.ps1` auto-creates `.env` from `.env.example` if `.env` is missing.
   - Edit `.env` only if you need to change SQL connection values.
3. Manual startup (if needed):
   - Start API listener (Terminal 1):
   - `cd "C:\Users\rmitchell\OneDrive - Kalleo Technologies, LLC\VSCode\Home-School-Management\server"`
   - `npm install`
   - `npm start`
   - Example prompt:
     - `C:\Users\rmitchell\OneDrive - Kalleo Technologies, LLC\VSCode\Home-School-Management\server>`
     - `npm install`
     - `npm start`
4. Start web server (Terminal 2, repo root):
   - `python -m http.server 5500`
5. Open `http://127.0.0.1:5500/web/`.

If you run frontend only without API listener, the app can load but API-backed persistence will not be active.

## MSSQL Migration Prep (New)

1. Copy `.env.example` to `.env` and set SQL credentials.
2. In `server/`, install dependencies: `npm install`.
3. Run schema migration: `npm run db:migrate`.
4. Export local app state JSON (from browser local storage), then import:
   - `npm run db:import-state -- --file ../NOTES/local-state-export.json`

## Collaboration Cadence

1. Plan and ownership in `WORKPLAN.md`.
2. Live delivery status in `STATUS.md`.
3. Decision rationale in `DECISIONS.md`.
4. Agent interfaces and handoff rules in `AGENTS.md`.
