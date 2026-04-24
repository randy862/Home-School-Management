# Tenant Housekeeping And Lifecycle Management

## Purpose

Tenant cleanup should be handled as an operational lifecycle, not as a casual delete action. Billing failures, canceled subscriptions, test tenants, and stale provisioning experiments all need a safe path that protects customer data, keeps audit history, and still lets operators keep the platform tidy.

## Current Implementation State

The control-plane backend already supports tenant lifecycle jobs:

- `suspend_tenant`
- `resume_tenant`
- `decommission_tenant`

These are queued through environment operation endpoints:

- `POST /api/control/environments/:id/suspend`
- `POST /api/control/environments/:id/resume`
- `POST /api/control/environments/:id/decommission`

The lifecycle job executor currently:

- sets `tenants.status = suspended` for suspension
- restores `tenants.status = active` for resume
- sets `tenants.status = decommissioned` for decommission
- marks tenant environments as `degraded`, `ready`, or `archived`
- updates environment health state
- records job and audit history

The Control UI now exposes these existing lifecycle operations through the `Queue Operation` form. This first slice does not add hard-delete/purge behavior.

## Recommended Lifecycle

Use these tenant states operationally:

1. `active`
   - Customer is paid or otherwise approved for access.
   - Tenant runtime resolves normally.

2. `past_due` billing state
   - Stripe or the commercial layer reports failed renewal/payment trouble.
   - Tenant runtime should usually remain accessible during the payment grace period.
   - Tenant-facing and operator-facing warnings should be shown.

3. `suspended`
   - Access is blocked, but customer data remains live and recoverable.
   - This is the normal state after the billing grace period expires.
   - Payment restoration or operator action can resume the tenant.

4. `decommissioned`
   - Customer is no longer expected to resume soon.
   - Runtime access remains unavailable.
   - The environment is archived in Control.
   - Database should still be retained until the purge window expires.

5. `purged`
   - Future irreversible cleanup state.
   - Requires export/archive first.
   - Live schema/database can be dropped only after retention policy and operator confirmation.

## Suggested Timing Policy

Recommended default windows:

- Payment failure grace period: 14-30 days before suspension.
- Suspended retention: 60-90 days before decommission.
- Decommissioned retention: 180 days before purge.

For test tenants:

- Allow immediate decommission.
- Allow purge only when the tenant is explicitly marked as test/non-customer or when an operator types the tenant slug as confirmation.

## Data Retention Recommendation

Do not immediately drop a tenant database or schema when a subscription fails.

Preferred long-term purge flow:

1. Queue `decommission_tenant`.
2. Create an encrypted PostgreSQL dump/archive.
3. Store archive metadata in the control plane.
4. Mark the live tenant environment as purge-eligible.
5. Require a Super Admin purge action with typed tenant slug confirmation.
6. Drop the tenant schema/database.
7. Retain minimal metadata:
   - tenant id
   - slug
   - contact email
   - Stripe customer/subscription ids
   - lifecycle timestamps
   - archive location/checksum
   - audit trail

## Control UI First Slice

The first implemented slice exposes these operations:

- Provision Environment
- Deploy Release
- Issue Setup Token
- Suspend Customer Access
- Resume Customer Access
- Decommission Customer

Lifecycle operations include a notes field for reason/ticket context. Decommission is intentionally labeled as customer decommissioning, not deletion.

## Next Implementation Slice

Recommended next session continuation:

1. Add a dedicated tenant detail action panel:
   - Suspend Access
   - Resume Access
   - Decommission Customer
   - Export Tenant Data
   - Purge Tenant Data, disabled until supported

2. Add stronger operator confirmations:
   - decommission requires explicit confirmation
   - purge requires typing the tenant slug
   - purge requires Super Admin/full operations permission

3. Add commercial automation:
   - Stripe `past_due` starts a grace-period clock
   - grace-period expiry queues `suspend_tenant`
   - canceled/unpaid beyond retention queues or recommends `decommission_tenant`
   - restored payment queues `resume_tenant`

4. Add archive/export jobs:
   - PostgreSQL tenant dump
   - archive checksum
   - retention metadata
   - operator-visible artifact status

5. Add purge jobs:
   - only after archive success or explicit test-tenant bypass
   - drop schema/database
   - keep minimal control-plane record and audit history

## Safety Rules

- Never use hard delete as the normal failed-renewal path.
- Never purge before an export/archive exists for real customers.
- Never make a tenant routable unless status is `active`.
- Keep every lifecycle mutation as a queued/audited operation.
- Treat test-tenant cleanup as a distinct operational path so production customer retention rules stay conservative.

