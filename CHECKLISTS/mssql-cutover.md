# MSSQL Cutover Checklist

## Preflight

- [ ] SQL Server Express instance reachable from app host.
- [ ] Service account/login has required DB permissions.
- [ ] `.env` values reviewed (no placeholder credentials).
- [ ] Local-state backup exported and stored safely.

## Migration

- [ ] `db:migrate` completed without errors.
- [ ] `db:import-state` completed in a single committed transaction.
- [ ] Table row counts match expected source counts.
- [ ] FK integrity checks passed.

## App Cutover

- [ ] API endpoints return expected payloads for core entities.
- [ ] Frontend switched to API data adapter.
- [ ] Smoke tests passed for:
  - [ ] Student CRUD
  - [ ] Course/enrollment flows
  - [ ] Attendance entry/edit
  - [ ] Grade entry/edit and dashboard calculations

## Release Gate

- [ ] Rollback procedure tested.
- [ ] Post-cutover monitoring plan confirmed.
- [ ] Go/No-Go decision logged in `DECISIONS.md`.
