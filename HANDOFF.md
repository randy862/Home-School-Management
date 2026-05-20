# Session Handoff

Date: 2026-05-20

## Context

Backend/platform hardening is active. Current slice added control-plane retention cleanup for expired paid data export artifacts.

## Current State

- In-app Help Center content is deployed and pushed.
- Control API now has a maintenance service wired into the existing provisioning worker loop.
- Maintenance expires `ready` cancellation/data-export requests once `artifact_expires_at <= NOW()`.
- Cleanup safely deletes expired artifact files only when they resolve inside `CONTROL_DATA_EXPORT_DIR`.
- Missing artifact files are tolerated; unsafe paths are skipped and logged.
- New config values are documented in `.env.example`:
  - `CONTROL_MAINTENANCE_ENABLED`
  - `CONTROL_MAINTENANCE_CLEANUP_INTERVAL_MS`
  - `CONTROL_MAINTENANCE_EXPIRED_EXPORT_BATCH_SIZE`
  - `CONTROL_DATA_EXPORT_DIR`
- New migration `012_export_cleanup_indexes.sql` adds an index for expiration cleanup.
- APP001 deployed control-api code and migration.
- APP001 deployed migration drift was corrected by syncing missing `009_subscription_package_branding.sql`.
- APP001 rollback snapshot:
  - `/home/debian/rollback/hsm/control-api-export-cleanup-202605201610/app001/control-api.tgz`

## Next Action

Run the hosted release gate from a PowerShell session with smoke credentials loaded:

`powershell -ExecutionPolicy Bypass -File .\scripts\Invoke-HostedReleaseGate.ps1 -PublicBaseUrl https://mitchell.navigrader.com`

Then monitor control-api logs after the next cleanup interval:

`ssh debian@192.168.1.200 "sudo journalctl -u hsm-control-api.service --since today --no-pager | grep -i 'export cleanup' || true"`

## Risks

- Codex does not have hosted smoke credentials in-process, so full release gate must be run from the user's shell.
- Cleanup marks expired export requests before deleting files; if deletion fails, the record remains expired and the error is logged.
- Do not store smoke credentials, Stripe secrets, or Postmark secrets in repo files.
- Untracked scratch screenshots/icons and `tmp/` remain local and intentionally outside commits.

## Validation

- `node --check` passed for control-api app, worker, store, and maintenance service.
- Focused cleanup simulation passed with deleted, missing, and unsafe-path cases.
- Maintenance retry timing simulation passed.
- APP001 deployed syntax checks passed.
- Control migrations applied through `012_export_cleanup_indexes.sql`.
- `hsm-control-api.service` restarted active.
- APP001 local `http://127.0.0.1:3100/health` returned `{"ok":true}`.
- Public `https://mitchell.navigrader.com/control-api/health` returned `{"ok":true}`.
