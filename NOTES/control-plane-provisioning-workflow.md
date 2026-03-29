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
  - the staged control plane now writes tenant runtime bundle artifacts on `APP001`, but host-to-host app/web deployment automation is still deferred until `APP001` has a trusted automation path to target hosts such as `WEB001`

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
  - the staged control plane now supports manual and background setup-state synchronization through a shared-key protected tenant runtime endpoint at `GET /api/internal/setup/status`

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
- `POST /api/control/environments/:id/setup-token`

### Jobs
- `GET /api/control/jobs`
- `GET /api/control/jobs/:id`

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
