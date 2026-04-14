# Hosted Release Checklist

## Before Deploy
- Confirm intended commit and scope.
- Prefer to run:
  - `powershell -ExecutionPolicy Bypass -File .\scripts\Invoke-HostedReleaseGate.ps1 -HostedUsername <tenant-user> -HostedPassword <tenant-password>`
- Confirm `APP001` local health:
  - `curl http://127.0.0.1:3000/health`
- Confirm public hosted health:
  - `curl http://192.168.1.210/health`
- Confirm control API health if included:
  - `curl http://192.168.1.210/control-api/health`

## Deploy
- Copy all required backend files to `APP001` before restarting.
- Create any newly required directories on `APP001` first.
- Copy web assets to `WEB001` if frontend changed.
- Copy control-plane assets/services only if they changed.
- Restart only after file sync is complete:
  - `hsm-api.service`
  - `hsm-control-api.service` if included

## Validate
- Confirm `APP001` service is active.
- Confirm public `http://192.168.1.210/health` returns `200`.
- Confirm hosted login works.
- Run smoke reads for the touched domains.
- Prefer to run:
  - `powershell -ExecutionPolicy Bypass -File .\scripts\Test-HostedSmoke.ps1 -Username <tenant-user> -Password <tenant-password>`
- If control plane changed, confirm `/control/` login and expected workspace behavior.
- Check `sudo journalctl -u hsm-api.service -n 80 --no-pager` for startup errors.

## Rollback Triggers
- public `/health` does not recover to `200`
- hosted login fails
- touched domain smoke checks fail
- repeated service restart errors remain in journal output

## Rollback
- Redeploy the previous known-good files to `APP001`
- Restart `hsm-api.service`
- Recheck local health and public `/health`
- Re-run the hosted smoke pass on the previous known-good version
- Prefer to rerun the full staged gate:
  - `powershell -ExecutionPolicy Bypass -File .\scripts\Invoke-HostedReleaseGate.ps1 -HostedUsername <tenant-user> -HostedPassword <tenant-password>`

## Special Checks
- If runtime/schema behavior looks wrong, inspect `.env.runtime` and `PGOPTIONS`
- If public `503` appears, inspect `hsm-api.service` first
- If restart fails after a refactor, confirm new modules/directories were actually copied
