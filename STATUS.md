# Status Board

Date: 2026-03-10

## Done
- Added login UX and system-user administration shell in `web/`:
  - `web/index.html`
  - `web/styles.css`
  - `web/app.js`
- Added persisted user-account model with default admin bootstrap:
  - roles: `admin`, `student`
  - linked student record for student accounts
  - password reset/change support via Users page
- Added role-based access behavior:
  - admins retain full access
  - students can access dashboard, schedule, attendance, and grades only
  - student views are read-only and filtered to the linked student record
- Extended SQL-backed state persistence for `users`:
  - `server/src/app.js`
  - `server/src/state-store.js`
  - `server/migrations/001_initial_schema.sql`
- Added legacy DB compatibility for API-backed state reads by tolerating missing `dbo.users` and creating it on write.
- Scanned current app and confirmed persistence is browser `localStorage` (`web/app.js`).
- Extracted live entity shapes and relationships from insert/update paths.
- Added SQL Server Express environment placeholders to `.env.example`.
- Added backend migration scaffold:
  - `server/src/app.js`
  - `server/src/config.js`
  - `server/src/db.js`
  - `server/src/scripts/migrate.js`
  - `server/src/scripts/import-state.js`
  - `server/migrations/001_initial_schema.sql`
- Added migration planning and operations assets:
  - `NOTES/mssql-migration-plan.md`
  - `RUNBOOKS/mssql-migration.md`
  - `CHECKLISTS/mssql-cutover.md`
  - `PROMPTS/data-migration-engineer.md`
- Verified SQL login from terminal with:
  - `ServerName = KALLEO-LT153\SQLEXPRESS`
  - `LoginName = HSMS`
- Created target database `HomeSchoolManagement`.
- Applied schema script `server/migrations/001_initial_schema.sql` to `HomeSchoolManagement`.
- Verified expected tables exist: `students`, `subjects`, `courses`, `enrollments`, `school_years`, `quarters`, `holidays`, `grade_types`, `plans`, `attendance`, `tests`.
- Imported local state from `NOTES/local-state-export.json` into `HomeSchoolManagement` using `server/scripts/import-state.ps1`.
- Verified post-import row counts:
  - students: 3
  - subjects: 8
  - courses: 15
  - enrollments: 18
  - school_years: 2
  - quarters: 4
  - holidays: 2
  - grade_types: 4
  - plans: 18
  - attendance: 384
  - tests: 70
- Verified integrity checks returned zero orphans for enrollments, courses, and tests.
- Installed server npm dependencies in `server/`.
- Implemented backend state endpoints backed by MSSQL:
  - `GET /api/state`
  - `PUT /api/state`
- Added relational state read/write repository:
  - `server/src/state-store.js`
- Updated frontend persistence to use backend state API with local fallback cache:
  - `web/app.js` now bootstraps from `/api/state` and saves to API on state changes.
- Installed Node dependencies in `server/` via npm.
- Validated Node read/write path against MSSQL using `server/src/state-store.js`.
- Started API server and verified:
  - `GET /health` => `ok: true`
  - `GET /api/state` returned expected counts (`students=3`, `subjects=8`, `courses=15`, `attendance=384`, `tests=70`)
- Confirmed working DB runtime config for this host uses direct TCP:
  - `MSSQL_SERVER=localhost`
  - `MSSQL_PORT=57959`

## In Progress
- Frontend smoke validation on the new login/Users flow.
- Endpoint expansion beyond full-state sync (`/api/subjects`, `/api/courses`, etc.).

## Blocked
- None.

## Next
1. Run browser smoke checks for admin login, user creation, password change, and student restricted access.
2. Re-run the SQL schema migration so `dbo.users` is present in the baseline database schema.
3. Validate API-backed state roundtrip with user-account persistence enabled.
