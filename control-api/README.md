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
- `/api/control/audit`
- `/api/control/environments/:id/deploy-release`
- `/api/control/environments/:id/suspend`
- `/api/control/environments/:id/resume`
- `/api/control/environments/:id/decommission`
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
- dedicated platform-admin release deployment route: `POST /api/control/environments/:id/deploy-release`
- dedicated platform-admin lifecycle routes: `POST /api/control/environments/:id/suspend`, `POST /api/control/environments/:id/resume`, and `POST /api/control/environments/:id/decommission`
- public tenant-runtime resolution by host plus internal runtime-routing resolution
- short-lived signed internal service-auth support for tenant-runtime setup synchronization and internal runtime-resolution routes, with legacy shared-key fallback available during staged rollout
- in-process provisioning worker that claims queued jobs, records job events, runs tenant runtime migration/setup-token scripts, can optionally perform app/web deployment steps with strict SSH trust, updates environment state, registers releases, and completes setup-token issuance metadata
- provisioning job recovery support with idempotent queueing, retry-attempt metadata, automatic transient-failure rescheduling, and manual `POST /api/control/jobs/:id/retry` creation of linked follow-up jobs
- authenticated filtered audit-log reads through `GET /api/control/audit`
- manual environment setup-state sync route: `POST /api/control/environments/:id/sync-setup`

Deployment-related environment variables:
- `CONTROL_INTERNAL_AUTH_SECRET=<shared-secret>` to sign short-lived internal service tokens used for tenant-runtime synchronization
- `CONTROL_INTERNAL_AUTH_ISSUER=control-plane`
- `CONTROL_INTERNAL_TENANT_RUNTIME_AUDIENCE=tenant-runtime-internal`
- `CONTROL_INTERNAL_RUNTIME_RESOLVE_AUDIENCE=control-plane-internal`
- `CONTROL_INTERNAL_AUTH_TTL_SECONDS=120`
- `CONTROL_INTERNAL_ALLOW_LEGACY_API_KEY=true` during staged cutover, then `false` after the shared-key path is retired
- `CONTROL_DEPLOYMENT_ENABLED=true` to enable real app/web deployment steps during `provision_environment`
- `CONTROL_DEPLOY_LOCAL_HOSTS=APP001,192.168.1.200,127.0.0.1,localhost` to tell the worker when the app host should be treated as local
- `CONTROL_HOST_ALIASES=APP001=192.168.1.200,WEB001=192.168.1.210,DB001=192.168.1.202` to resolve control-plane host labels on the worker host
- `CONTROL_DEPLOY_APP_DIR=/home/debian/apps/home-school-management/server`
- `CONTROL_DEPLOY_APP_SERVICE=hsm-api.service`
- `CONTROL_DEPLOY_APP_SERVICE_SCOPE=system`
- `CONTROL_DEPLOY_APP_SERVICE_USE_SUDO=true`
- `CONTROL_DEPLOY_APP_HEALTH_URL=http://127.0.0.1:3000/health`
- `CONTROL_DEPLOY_WEB_DIR=/var/www/home-school-management/web`
- `CONTROL_DEPLOY_WEB_HEALTH_URL=http://127.0.0.1/health`
- `CONTROL_DEPLOY_HEALTH_RETRIES=10`
- `CONTROL_DEPLOY_HEALTH_DELAY_MS=2000`
- `CONTROL_DEPLOY_SSH_USER=debian`
- `CONTROL_DEPLOY_SSH_PORT=22`
- `CONTROL_DEPLOY_SSH_CONNECT_TIMEOUT_SECONDS=10`

Commercial checkout / public-host environment variables:
- `STRIPE_PUBLISHABLE_KEY=<pk_test_...>` for the public checkout bootstrap response
- `STRIPE_SECRET_KEY=<sk_test_...>` for Stripe Checkout session creation
- `STRIPE_WEBHOOK_SECRET=<whsec_...>` for webhook signature verification
- `PUBLIC_APP_BASE_URL=https://navigrader.com` for public checkout and hosted tenant URL generation
- `PUBLIC_SIGNUP_STATUS_BASE_URL=https://navigrader.com` when signup-status should resolve from the same public host
- `PUBLIC_CHECKOUT_SUCCESS_URL=https://navigrader.com/signup-status.html?checkout=success`
- `PUBLIC_CHECKOUT_CANCEL_URL=https://navigrader.com/signup-status.html?checkout=cancel`
- `PUBLIC_DEFAULT_DOMAIN_SUFFIX=navigrader.com` so commercial provisioning allocates `*.navigrader.com` instead of `school.local`

Current commercial plan-code mapping:
- `starter_monthly` -> `Starter`
- `growth_monthly` -> `Extra Credit`
- `large_monthly` -> `Valedictorian`

The public-facing names can change without changing the internal plan codes, but the `commercial_plans.stripe_price_id` values must be mapped to those three internal codes correctly.

Current APP001 assumption:
- the tenant runtime is managed by system-level `systemd` units, not lingering user services
- the control-plane worker uses `sudo systemctl restart ...` for app restarts during hosted deployment automation
- if a legacy environment still uses user units, override `CONTROL_DEPLOY_APP_SERVICE_SCOPE=user` and `CONTROL_DEPLOY_APP_SERVICE_USE_SUDO=false`

Validation helper:
- `src/scripts/validate-deployment.js` manually exercises `tenant-runtime-automation.provisionEnvironment(...)` using environment metadata passed through env vars
