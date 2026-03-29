# Control-Plane Provisioning Workflow

## Purpose
Define the first end-to-end provisioning workflow that turns the current hosted single-tenant runtime into a repeatable tenant-environment lifecycle.

## Scope
- operator-triggered tenant creation
- environment provisioning
- release deployment
- first-run setup-token issuance
- readiness transition

## Workflow Summary
1. Create tenant record.
2. Create tenant environment record.
3. Queue provisioning job.
4. Allocate runtime resources.
5. Apply tenant runtime schema.
6. Deploy tenant app configuration and release metadata.
7. Issue first-run setup token.
8. Wait for tenant admin initialization.
9. Mark environment ready.

## Detailed Steps

### 1. Create Tenant
- Operator creates a tenant in the control plane.
- Control API writes:
  - `tenants`
  - primary `tenant_domains`
  - initial `tenant_environments` row with `status = pending`
- Control API writes an audit log entry.

### 2. Queue Provisioning Job
- Control API creates `provisioning_jobs` row:
  - `job_type = provision_environment`
  - `status = queued`
- Job payload should include:
  - tenant id
  - environment id
  - requested domain
  - target hosts
  - release/version target

### 3. Allocate Runtime Resources
- Worker moves job to `running`.
- Worker determines:
  - application host
  - web host
  - PostgreSQL host
  - tenant database name
- Worker updates `tenant_environments` with allocated runtime metadata.
- Worker writes progress events to `provisioning_job_events`.

### 4. Prepare Tenant Database
- Worker creates or allocates the tenant runtime database.
- Worker applies tenant runtime migrations.
- Worker verifies required tables exist.
- Worker records database readiness in job events.
- Current implementation note:
  - the staged control plane now creates the target schema in PostgreSQL and runs the tenant `server/` migration script against that schema directly on `APP001`

### 5. Deploy Tenant Runtime
- Worker copies the tenant app release to the target app/web hosts.
- Worker writes environment-specific config:
  - app base URL
  - database credentials
  - CORS origin
  - session config
- Worker restarts the tenant app service and verifies `/health`.
- Current implementation note:
  - the staged control plane now has an opt-in deployment executor that can copy `server/` into the configured app deploy directory, write `.env.runtime`, restart `home-school-management.service`, verify app health, and push `web/` assets to the configured web host over `scp`/`ssh`
  - cross-host execution still depends on trusted `APP001 -> WEB001` SSH access; the worker intentionally keeps strict host verification and fails closed if that trust path is not established

### 6. Register Release
- Worker writes `tenant_releases` row for the deployed version.
- Worker sets `tenant_environments.current_release_id`.

### 7. Issue Setup Token
- Worker or operator issues a first-run setup token through the tenant runtime CLI.
- Control plane records issuance metadata in `setup_tokens_issued`.
- Tenant runtime stores only the hashed token in its own database.
- Environment `setup_state` becomes `token_issued`.
- Current implementation note:
  - the staged control plane now runs the tenant `create-setup-token` CLI directly and writes the raw token to a locked-down artifact file on `APP001`, while the control plane stores only metadata and the artifact path

### 8. Tenant Admin Completes Initialization
- Tenant admin redeems the token through the tenant app first-run setup UI.
- Tenant runtime:
  - creates the first admin
  - marks tenant runtime initialized
  - starts the normal session
- Control plane should poll or receive confirmation that setup completed.
- Current implementation note:
  - the staged control plane now supports manual and background setup-state synchronization through an internal tenant runtime endpoint at `GET /api/internal/setup/status`
  - the preferred auth path is now a short-lived signed service token from the control plane, with legacy shared-key fallback left enabled only for staged cutover

### 9. Mark Environment Ready
- Control plane updates:
  - `tenant_environments.status = ready`
  - `tenant_environments.setup_state = initialized`
  - `tenant_environments.initialized_at = now`
- Provisioning job becomes `succeeded`.
- Audit log records the transition.

## Failure Handling

### Failure Principles
- Jobs must be resumable or safely rerunnable.
- Each major step should emit an event before and after side effects.
- A failed job should leave the latest successful step discoverable from control-plane state.

### Typical Failure Points
- database allocation failure
- migration failure
- app deploy failure
- health-check failure
- setup-token issuance failure
- tenant initialization never completed before token expiry

### Recovery Actions
- retry the same job when steps are idempotent
- issue a follow-up `deploy_release` or `issue_setup_token` job instead of mutating the original request blindly
- require operator acknowledgment before destructive cleanup or decommission actions

## State Model

### Tenant Status
- `draft`
- `provisioning`
- `active`
- `suspended`
- `decommissioned`

### Environment Status
- `pending`
- `provisioning`
- `ready`
- `degraded`
- `archived`

### Setup State
- `uninitialized`
- `token_issued`
- `initialized`

## Boundary Between Control Plane And Tenant Runtime

### Control Plane Owns
- operator auth
- tenant registry
- environment allocation metadata
- provisioning jobs and events
- release history
- audit log

### Tenant Runtime Owns
- tenant users
- tenant sessions
- tenant setup-token hashes
- tenant instructional data
- tenant-facing health and domain APIs

## Recommended First API Surface For `control-api/`

### Operator Auth
- `POST /api/operator/auth/login`
- `POST /api/operator/auth/logout`
- `GET /api/operator/me`

### Tenant Registry
- `GET /api/control/tenants`
- `POST /api/control/tenants`
- `GET /api/control/tenants/:id`
- `PATCH /api/control/tenants/:id`

### Environments
- `POST /api/control/tenants/:id/environments`
- `GET /api/control/environments/:id`
- `POST /api/control/environments/:id/provision`
- `POST /api/control/environments/:id/deploy-release`
- `POST /api/control/environments/:id/setup-token`
- `POST /api/control/environments/:id/suspend`
- `POST /api/control/environments/:id/resume`
- `POST /api/control/environments/:id/decommission`

### Jobs
- `GET /api/control/jobs`
- `GET /api/control/jobs/:id`
- `POST /api/control/jobs/:id/retry`
- `GET /api/control/audit`

## Recovery Model

- Each provisioning job tracks `attempt_count`, `max_attempts`, `last_attempt_at`, and `next_attempt_at`.
- Automatic retry reuses the same job record only for transient failures and only while `attempt_count < max_attempts`.
- Automatic retry appends `retry_pending` and `retry_scheduled` events before moving the job back to `queued`.
- Terminal failure still lands on the same job record with the final error plus full event history.
- Manual operator retry creates a new queued child job linked by `retry_of_job_id` instead of rewriting the failed job in place.
- Idempotency keys apply at queue time: the same intent returns the existing queued/running/completed job, while a conflicting request using the same key is rejected.

## Release Deployment Follow-Up

- `deploy_release` is now the first post-provisioning lifecycle job.
- It reuses the deployment executor and release registration path without rerunning schema creation, migrations, or setup-token issuance.
- The control plane records a fresh `tenant_releases` row, updates `tenant_environments.current_release_id`, and keeps the environment in `ready` on success.
- The current staged validation path is:
  - queue `POST /api/control/environments/:id/deploy-release`
  - wait for app/web deployment events
  - confirm `release_registered`
  - confirm the environment record now points to the new `current_release_id`

## Tenant Lifecycle Follow-Up

- `suspend_tenant`, `resume_tenant`, and `decommission_tenant` now run as queued jobs against a target environment.
- `suspend_tenant`:
  - sets `tenants.status = suspended`
  - sets `tenant_environments.status = degraded`
  - marks environment health as `suspended`
  - makes runtime resolution return `404` because only active tenants remain routable
- `resume_tenant`:
  - restores `tenants.status = active`
  - restores `tenant_environments.status = ready`
  - marks environment health as `healthy`
  - restores runtime resolution for the tenant domain
- `decommission_tenant`:
  - sets `tenants.status = decommissioned`
  - sets `tenant_environments.status = archived`
  - marks environment health as `decommissioned`
  - leaves runtime resolution unavailable for the tenant domain

## Observability Follow-Up

- `GET /api/control/audit` now exposes recent operator activity with filters for tenant, target type, target id, action type, and result count.
- The `/control/` UI now uses that feed to show `Operator Activity` on tenant, environment, and job detail views.
- Job detail now also surfaces support-oriented diagnostics:
  - current attempt vs maximum attempts
  - next retry timing when automatic retry is scheduled
  - retry lineage through `retry_of_job_id`
  - a simplified failure classification and operator guidance summary
- This does not replace deeper logs yet, but it gives operators and support a usable first-line history without reading raw JSON first.

## First UI Surface For `admin/`
- tenant list
- tenant detail with environment cards
- provisioning job timeline
- environment health/setup state
- action panel for:
  - provision environment
  - issue setup token
  - suspend tenant
  - resume tenant
