# Hosted Deployment Runbook

## Purpose
Run and recover the staged hosted deployment across:
- `APP001` for the tenant app and `control-api`
- `WEB001` for Apache-served web assets and reverse proxy
- `SQL001` for PostgreSQL

This runbook reflects the current staged production-like shape, not the original first-boot-only setup.

## Runtime Layout

### APP001
- Tenant app path: `/home/debian/apps/home-school-management/server`
- Tenant app service: `home-school-management.service`
- Control API path: `/home/debian/apps/home-school-management/control-api`
- Control API service: `home-school-management-control-api.service`
- Runtime override bundle: `/home/debian/apps/home-school-management/server/.env.runtime`

### WEB001
- Tenant web path: `/var/www/home-school-management/web`
- Control Center path: `/var/www/home-school-management/control`
- Apache site: `home-school-management.conf`

### SQL001
- Database: `appdb`
- Control-plane schema: staged control schema in PostgreSQL
- Tenant runtime schema: written through `.env.runtime` `PGOPTIONS`

## Standard Release Flow

### 1. Pre-Deploy Checks
- Confirm repo is at the intended commit.
- Preferred quick gate from this workstation:
  - `powershell -ExecutionPolicy Bypass -File .\scripts\Invoke-HostedReleaseGate.ps1 -HostedUsername <tenant-user> -HostedPassword <tenant-password>`
- Confirm `APP001` app health before touching anything:
  - `ssh debian@192.168.1.200 "curl -s http://127.0.0.1:3000/health"`
- Confirm public hosted health:
  - `curl http://192.168.1.210/health`
- Confirm control plane health if that surface is part of the release:
  - `curl http://192.168.1.210/control-api/health`

### 2. Deploy Tenant App Backend To APP001
- Copy updated backend files into:
  - `/home/debian/apps/home-school-management/server/src/`
- If new folders were introduced, create them first on `APP001`.
  Examples:
  - `server/src/services/`
  - `server/src/repositories/postgres/`
  - `server/src/legacy/`
- If deployment includes systemd unit changes, also sync:
  - `infra/systemd/home-school-management.service`

### 3. Deploy Tenant Web Assets To WEB001
- Copy updated `web/` assets into:
  - `/var/www/home-school-management/web`
- Reload Apache if site config changed:
  - `sudo systemctl reload apache2`

### 4. Deploy Control Plane When Included
- Copy updated `control-api/` files into:
  - `/home/debian/apps/home-school-management/control-api`
- Copy updated `admin/` assets into:
  - `/var/www/home-school-management/control`
- Restart control API only if its code or config changed:
  - `systemctl --user restart home-school-management-control-api.service`

### 5. Restart Order
- Restart only after all required files for that service are fully copied.
- Tenant app:
  - `systemctl --user restart home-school-management.service`
- Control API if included:
  - `systemctl --user restart home-school-management-control-api.service`

Do not restart midway through a partial copy. One real staged failure came from restarting before the corrected `services/` files had finished syncing.

## Required Post-Deploy Validation

### APP001 Local Checks
- `systemctl --user is-active home-school-management.service`
- `curl http://127.0.0.1:3000/health`
- `systemctl --user status home-school-management.service --no-pager -l`

### Public Hosted Checks
- `curl http://192.168.1.210/health`
- Hosted login via:
  - `POST /api/auth/login`
- Authenticated smoke reads should include the domains touched by the release:
  - `/api/me`
  - `/api/subjects`
  - `/api/courses`
  - `/api/enrollments`
  - `/api/school-years`
  - `/api/quarters`
  - `/api/holidays`
  - `/api/daily-breaks`
  - `/api/plans`
  - `/api/grade-types`
  - `/api/grading-criteria`
  - `/api/attendance`
  - `/api/tests`
- Preferred smoke command from this workstation:
  - `powershell -ExecutionPolicy Bypass -File .\scripts\Test-HostedSmoke.ps1 -Username <tenant-user> -Password <tenant-password>`

### Control Plane Checks When Included
- `curl http://192.168.1.210/control-api/health`
- Login to `/control/`
- Verify expected operator workspace loads
- If deployment touched provisioning/release execution, verify the latest job detail renders cleanly
- Preferred combined gate when control-plane changes are included:
  - `powershell -ExecutionPolicy Bypass -File .\scripts\Invoke-HostedReleaseGate.ps1 -HostedUsername <tenant-user> -HostedPassword <tenant-password> -IncludeControlPlane -ControlUsername <operator-user> -ControlPassword <operator-password>`

## Tenant Runtime Checks

### `.env.runtime`
The tenant app service loads:
- `/home/debian/apps/home-school-management/server/.env.runtime`

This file is the current source of truth for:
- tenant schema selection via `PGOPTIONS`
- runtime URL values
- tenant-specific deployment identity

### Validate Runtime Schema
- `curl http://127.0.0.1:3000/api/setup/status`
- if needed:
  - `systemctl --user show home-school-management.service --property=EnvironmentFiles --property=Environment | grep PGOPTIONS`

If the wrong tenant schema is loaded, the public app can silently point at PostgreSQL `public` instead of the intended tenant schema.

## Recovery Playbooks

### A. Public `503` From `192.168.1.210`
Likely causes:
- tenant app service failed on `APP001`
- Apache proxy on `WEB001` cannot reach `APP001:3000`
- app restarted before required files were fully copied

Check:
- `ssh debian@192.168.1.200 "systemctl --user status home-school-management.service --no-pager -l | head -n 80"`
- `ssh debian@192.168.1.200 "journalctl --user -u home-school-management.service -n 80 --no-pager"`
- `ssh debian@192.168.1.210 "curl -s -i http://192.168.1.200:3000/health"`

Recovery:
- finish any incomplete file sync
- restart `home-school-management.service`
- recheck local health
- recheck public `/health`

### B. Service Will Not Start On APP001
Likely causes already seen:
- missing newly introduced module path
- partial deploy left new `require(...)` target absent
- stale runtime file/config mismatch

Check:
- `journalctl --user -u home-school-management.service -n 80 --no-pager`

Examples already encountered:
- missing `server/src/legacy/local-state-bridge.js`
- restarting before corrected remote `services/` files were in place

Recovery:
- copy missing files/directories
- confirm the file exists on host
- restart again only after sync completes

### C. Wrong Tenant Runtime / Wrong Schema
Symptoms:
- hosted app looks initialized when expected tenant is not
- app is reading PostgreSQL `public` instead of tenant schema

Check:
- `.env.runtime` exists
- `EnvironmentFile=` is present in `home-school-management.service`
- `PGOPTIONS` is quoted correctly for systemd consumption

Recovery:
- patch `.env.runtime`
- verify `PGOPTIONS=\"-c search_path=...\"`
- restart service
- recheck `/api/setup/status`

### D. Control-Plane Job Failure
Check:
- latest job in `/control/`
- job events and result detail
- audit trail in `/control/`

Recovery:
- determine whether failure is transient or structural
- use built-in retry flow for control-plane jobs when appropriate
- if deploy-related, verify file sync, host aliasing, SSH trust, and remote ownership first

### E. Bad Release Rollout
If the public app regresses after a backend-only release:
- redeploy the previously known-good backend files to `APP001`
- restart `home-school-management.service`
- re-run local and public health
- repeat the hosted smoke pass on the previous known-good version

## Release Gate
Treat a hosted release as acceptable only when:
- app service is active on `APP001`
- public `/health` is `200`
- login works
- domain smoke reads pass for the touched surfaces
- control plane still works if included in the release
- no unresolved service restart or module-load errors remain in journal output

## Validation Hooks

### `scripts\Test-HostedSmoke.ps1`
Runs the tenant-app login plus authenticated smoke reads for the currently served hosted runtime.

Required parameters:
- `-Username`
- `-Password`

Optional parameters:
- `-BaseUrl`
- `-Endpoints`

### `scripts\Invoke-HostedReleaseGate.ps1`
Runs the staged release gate in one command:
- APP001 local health over SSH
- public `/health`
- tenant-app smoke login and domain reads
- optional control-plane health and operator login/session validation

Required parameters:
- `-HostedUsername`
- `-HostedPassword`

Optional parameters:
- `-PublicBaseUrl`
- `-ControlBaseUrl`
- `-AppHost`
- `-AppPort`
- `-IncludeControlPlane`
- `-ControlUsername`
- `-ControlPassword`

## Rehearsed Release / Rollback Drill
The current release path has been exercised on staging with a controlled backend-only control-api change:
- deployed a tiny `control-api` health-route change to `APP001`
- restarted `home-school-management-control-api.service`
- ran `scripts\Invoke-HostedReleaseGate.ps1` successfully against the live staged app and control plane
- restored the previously committed control-api route file to `APP001`
- restarted `home-school-management-control-api.service` again
- reran `scripts\Invoke-HostedReleaseGate.ps1` successfully after rollback

This means the staged operator path is no longer just theoretical:
- small backend deploys can be validated through the scripted gate
- rollback to the prior committed file set can be revalidated through the same scripted gate

## Current Staged URLs
- Public app: `http://192.168.1.210/`
- Public health: `http://192.168.1.210/health`
- Control Center: `http://192.168.1.210/control/`
- Control API health: `http://192.168.1.210/control-api/health`
