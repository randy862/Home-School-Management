# Decision Log

| Date | Decision | Rationale | Impact |
|---|---|---|---|
| 2026-03-07 | Use lightweight static web scaffold first | Enables rapid UI iteration before backend commitments | Faster MVP discovery and lower setup friction |
| 2026-03-07 | Adopt 5-agent operating model | Separates planning, delivery, and quality ownership | Clear accountability and parallel workstreams |
| 2026-03-07 | Keep ops artifacts in repo root and role content in dedicated folders | Reduces navigation overhead and onboarding time | Consistent collaboration pattern |
| 2026-03-07 | Model course lengths as hours per instructional day for MVP | Allows direct calculation of total/complete instructional hours from attendance and calendar days | Delivers hour indicators without backend dependencies |
| 2026-03-07 | Keep app as static SPA with local storage for phase 1 | Avoids backend dependency while validating workflow fit | Faster end-to-end prototype delivery |
| 2026-03-07 | Generate calendar schedules from plan definitions instead of storing every event | Reduces data duplication and keeps calendar aligned to plan edits | Calendar updates immediately on plan changes |
| 2026-03-09 | Introduce SQL Server Express migration track with staged cutover | User requested full MSSQL backend migration with data preservation | Added backend/schema/import scaffolding and migration operations docs |
| 2026-03-09 | Keep string IDs during migration phase instead of immediate UUID rewrite | Existing frontend state uses generated string IDs; preserving keys reduces migration risk | Enables low-risk import and incremental backend adoption |
| 2026-03-10 | Add PowerShell-based import fallback script (`server/scripts/import-state.ps1`) | `node`/`npm` unavailable in execution environment, but migration needed to continue | Enabled successful JSON-to-MSSQL import and integrity verification without Node runtime |
| 2026-03-10 | Add persisted system users inside app state instead of a separate auth service | Current app is a single-file SPA with full-state persistence already in place; this keeps the feature aligned with the existing architecture | Login, role gating, and password management now survive reloads and SQL-backed sync |
| 2026-03-10 | Bootstrap a default admin account (`admin` / `ChangeMe123!`) for existing installs | Existing deployments have no user accounts, so auth needs a deterministic first-login path without blocking on manual DB seeding | App can be upgraded in place; admin must change the default password after initial login |
| 2026-03-10 | Restrict student access at the UI/session layer to dashboard, schedule, attendance, and grades | User requested student read-only access limited to those views | Student sessions are filtered to their linked record and cannot submit admin mutations through normal app flows |
