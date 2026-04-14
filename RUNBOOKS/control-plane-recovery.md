# Control-Plane Recovery Runbook

## Purpose
Respond to staged control-plane incidents involving:
- failed queued jobs
- retry decisions
- deployment-step failures
- setup-sync failures
- environment state drift

This runbook is for the current `/control/` and `control-api` model backed by queued jobs and operator audit history.

## First Triage

### 1. Identify The Affected Object
Determine whether the incident is centered on:
- a customer
- an environment
- a queued operation/job

Start from `/control/`:
- `Customers`
- `Environments`
- `Operations`

### 2. Open The Job Detail
For any operational failure, open the most relevant job in `Operations` and check:
- job type
- status
- attempts / retry timing
- event history
- result summary
- deployment section if present
- operator activity

### 3. Classify The Failure
Use the job detail to decide whether this is:
- transient
- deployment/configuration
- tenant-runtime setup state
- host/service outage
- operator input/model issue

## Job Handling Rules

### When To Retry
Retry when the failure looks transient:
- temporary host connectivity
- health probe timing
- momentary service unavailability
- file sync timing issue

Use the control-plane retry path rather than inventing a new job manually when possible.

### When Not To Retry Blindly
Do not keep retrying if the job detail shows a structural problem:
- missing remote file or directory
- host alias resolution failure
- SSH trust or permission failure
- service cannot start
- wrong runtime/schema configuration
- bad request payload or invalid environment metadata

Fix the underlying issue first, then retry.

### When To Rerun A Fresh Operation
Prefer a fresh operator action instead of repeated retries when:
- the original intent has changed
- environment metadata was corrected after failure
- the failure happened in an old job context that is now misleading

## Common Incident Patterns

### A. `provision_environment` Failed
Check in job detail:
- whether schema/runtime bundle steps completed
- whether app deploy completed
- whether web deploy completed
- whether release registration occurred

Likely causes:
- database routing issue
- runtime bundle/config issue
- deployment trust/permission issue
- service restart or health-check failure

Next checks:
- environment detail state
- app health on `APP001`
- public hosted health

### B. `deploy_release` Failed
Check:
- app deploy card
- web deploy card
- release registration event

Likely causes:
- partial file sync
- service restart failure
- web-host copy failure
- host reachability or permissions

Recovery:
- fix deploy-path issue
- rerun or retry the release job
- confirm `current_release_id` only after success

### C. `issue_setup_token` Succeeded But Environment Did Not Become Initialized
Check:
- setup token issuance event
- later setup-sync events
- environment `setupState`

Likely causes:
- tenant setup not actually completed yet
- internal setup-status sync failed
- runtime resolution/auth issue between control plane and tenant runtime

Recovery:
- verify tenant setup through hosted app
- run sync-setup path again if appropriate
- inspect internal service trust if sync keeps failing

### D. `suspend`, `resume`, or `decommission` Looks Wrong
Check:
- tenant status
- environment status
- runtime resolution behavior

Expected:
- suspended tenants should stop resolving publicly
- resumed tenants should resolve again
- decommissioned tenants should remain unavailable

If behavior does not match:
- inspect latest lifecycle job
- inspect runtime resolution result
- confirm the environment was not manually edited afterward

### E. Public Hosted App Is Broken After A Successful Job
This means the job may have succeeded at the control-plane level while the runtime is still unhealthy.

Check:
- public `/health`
- app service on `APP001`
- current tenant runtime/schema
- whether the latest deploy copied all expected files before restart

Treat this as a hosted runtime recovery issue after control-plane triage is complete.

## Escalation Path

### Stay In `/control/` When
- the issue is visible in job history
- retry timing/lineage is enough to explain what happened
- the operator can fix by retrying or rerunning with corrected metadata

### Move To Host-Level Checks When
- app/web deploy step failed
- public `/health` is not `200`
- service restart is suspected
- file sync or module path is suspected
- Apache proxy behavior suggests backend outage

## Host-Level Checks

### APP001
- `sudo systemctl status hsm-api.service --no-pager -l`
- `sudo journalctl -u hsm-api.service -n 80 --no-pager`
- `curl http://127.0.0.1:3000/health`

### Control API On APP001
- `sudo systemctl status hsm-control-api.service --no-pager -l`
- `sudo journalctl -u hsm-control-api.service -n 80 --no-pager`
- `curl http://127.0.0.1:3100/health`

### WEB001
- public `http://192.168.1.210/health`
- Apache proxy reachability to `APP001`

## Known Failure Lessons From Staging

### Restart Only After File Sync Completes
One real failure came from restarting the tenant app service before corrected remote files had fully copied. This created a false runtime mismatch even though the final file content was correct.

### Missing New Module Paths Cause Immediate Startup Failure
When a new module or directory is introduced, confirm it exists on `APP001` before restart.

### Public `503` Usually Means Backend First
A public `503` at `192.168.1.210` should first be treated as an `APP001` service or reachability problem, not a frontend-only issue.

### Runtime Schema Drift Can Masquerade As App Behavior Problems
If setup state or data looks wrong, verify `.env.runtime` and `PGOPTIONS` before assuming the latest release changed business logic.

## Recovery Exit Criteria
An incident is considered resolved only when:
- the relevant job failure is understood
- any needed retry/rerun has completed successfully
- public hosted health is back to normal if the tenant app was affected
- the environment state in `/control/` matches the actual runtime behavior
