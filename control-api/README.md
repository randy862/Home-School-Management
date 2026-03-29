# Control API

This directory is reserved for the future operator/control-plane API.

Planned responsibilities:
- operator authentication
- tenant registry
- tenant environment registry
- provisioning orchestration
- tenant runtime resolution and routing
- tenant lifecycle actions
- release tracking
- operator audit logging

Current planning references:
- `NOTES/control-plane-foundation.md`
- `NOTES/control-plane-schema-v1.md`
- `NOTES/control-plane-provisioning-workflow.md`
- `NOTES/operator-auth-session-contract.md`

Proposed first endpoint groups:
- `/api/operator/setup/*`
- `/api/operator/auth/*`
- `/api/control/tenants`
- `/api/control/environments`
- `/api/control/jobs`
- `/api/runtime/resolve`
- `/api/internal/runtime/resolve`

Current scaffolded assets:
- `package.json`
- `migrations/postgres/001_initial_control_plane.sql`
- `src/app.js`
- `src/routes/`
- `src/middleware/`
- `src/postgres-operator-store.js`
- `src/scripts/migrate-postgres.js`

Current implementation status:
- operator bootstrap status and first-operator bootstrap route
- operator login/logout/session bootstrap
- tenant/environment/job read routes
- tenant/environment/provisioning mutation routes with platform-admin enforcement
- public tenant-runtime resolution by host plus internal runtime-routing resolution
- in-process provisioning worker that claims queued jobs, records job events, runs tenant runtime migration/setup-token scripts, updates environment state, registers releases, and completes setup-token issuance metadata
- manual environment setup-state sync route: `POST /api/control/environments/:id/sync-setup`
