# Control-Plane Runtime Routing

## Purpose
Define how the control plane resolves an incoming tenant hostname to the tenant/environment runtime record, and how internal callers retrieve non-public database routing metadata without exposing that data on public endpoints.

## Public Resolution
- Endpoint: `GET /api/runtime/resolve`
- Inputs:
  - `Host` header by default
  - optional `?host=...`
  - optional `?environmentKey=...`
- Returns:
  - `tenantId`
  - `tenantSlug`
  - `tenantDisplayName`
  - `environmentId`
  - `environmentKey`
  - `environmentDisplayName`
  - `status`
  - `setupState`
  - `appBaseUrl`
  - `resolvedHost`
  - `resolvedBy`

## Internal Resolution
- Endpoint: `GET /api/internal/runtime/resolve`
- Auth:
  - `x-control-plane-key: <CONTROL_INTERNAL_API_KEY>`
  - if no shared key is configured yet, a signed-in `platform_admin` session may use the route for controlled staging validation
- Purpose:
  - returns the same tenant/environment identity data as the public endpoint
  - adds runtime routing metadata needed by trusted infrastructure callers
- Additional fields:
  - `appHost`
  - `webHost`
  - `databaseHost`
  - `databaseName`
  - `databaseSchema`
  - `lastHealthStatus`
  - `lastHealthCheckAt`

## Resolution Rules
- Match `tenant_domains.domain` against the normalized request host.
- Join to `tenant_environments` through `tenant_id`.
- Ignore:
  - `tenants.status = decommissioned`
  - `tenant_environments.status = archived`
- Prefer environments in this order:
  1. `production`
  2. `staging`
  3. any other environment key
- Within that, prefer:
  1. `ready`
  2. `provisioning`
  3. `pending`
  4. `degraded`

## Current Boundary
- This slice resolves runtime identity and database-routing metadata.
- It does not yet mint tenant runtime secrets or create tenant-specific connection users.
- Those secrets remain part of the later provisioning-execution work.
