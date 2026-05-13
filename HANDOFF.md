# Session Handoff

Date: 2026-05-12

## Current Work

Production backend/platform security hardening.

Live URL: https://www.navigrader.com/

Preview URLs: https://www.navigrader.com/saas-preview.html and https://www.navigrader.com/saas-blended-preview.html

## Current State

First repo-level hardening pass from `NOTES/commercial-security-hardening-plan.md` is implemented locally.

Completed this batch:

- Added API security headers for tenant API and control API.
- Added CORS allowlist behavior instead of reflecting all request origins when configured.
- Added no-dependency in-memory rate limits for tenant login/setup, operator login/bootstrap, public checkout, and Stripe webhook ingress.
- Sanitized production 5xx route/error responses while preserving server-side logs.
- Made production cookie defaults infer `Secure=true`; systemd templates explicitly set secure cookies.
- Added setup/bootstrap password minimum length.
- Validated tenant schema identifiers before provisioning-generated `PGOPTIONS` and search paths.
- Added `infra/apache/home-school-management-production-ssl.conf`.
- Disabled directory indexes and denied dotfiles in existing Apache templates.
- Hardened systemd templates with dedicated users, external secret env files, and baseline sandboxing directives.
- Remediated npm audit finding in `server/package-lock.json`.
- Added `control-api/package-lock.json`; both npm audits now pass.
- Added security deployment, operational, and lab checklists for service users, secrets, Apache, DB roles, backup/restore, AWS-deferred controls, monitoring, incident response, and validation.
- Added `scripts/Invoke-LabSecurityGate.ps1` for lab security validation.
- Added `server/migrations/postgres/028_user_profile_fields_tenant_schemas.sql` to repair tenant-schema user profile columns when older lab databases only received the search-path scoped profile migration.
- Tightened tenant runtime resolution so hosted PostgreSQL requests fail closed without a resolved tenant schema; fallback runtime is host-bound and legacy state sync fails closed in production.
- Tightened control-plane environment job routes so queued jobs use the environment's server-side tenant ID and reject mismatched body tenant IDs.
- Scoped student instructor reads to assigned instructors and redacted instructor birthdate/background fields from student responses.
- Aligned tenant user creation and tenant account password changes to a 10-character minimum password policy.
- Restricted account subscription, upgrade, billing-event, and export-request data to tenant administrators and sanitized tenant app route 5xx responses.
- Control API routes now share production-safe route error handling across tenant, environment, job, operator, audit, runtime, and commercial endpoints.

Prior live SaaS polish remains deployed at `https://www.navigrader.com/`; see previous history if that workstream is reopened.

Current security commits include `6f9d8c8`, `495ea8a`, `9ff7129`, `7f6eb01`, `886b05f`, and `8bcaba2`; branch pushed to `origin/saas-modern-redesign`.

## Next Action

Deploy/pull current `origin/saas-modern-redesign` backend code to APP001 `192.168.1.200`, restart `hsm-api.service`, then rerun `scripts\Invoke-LabSecurityGate.ps1`.

## Risks

- Apex `https://navigrader.com/` DNS currently resolves to parking/forwarding IPs, not WEB001.
- Scratch assets remain intentionally untouched.
- Checkout uses live public plans and checkout endpoints through existing `saas.js`.
- In-memory rate limits are not a final distributed SaaS limiter.
- Lab gate passes tenant login/privacy/scoping/write-denial/legacy-state checks, then fails because live tenant API still reflects unlisted CORS origins.
- Lab PostgreSQL least privilege, encrypted backup/restore, incident checklist, and cross-tenant abuse tests remain open; AWS security groups are deferred until AWS exists.
- Route-by-route IDOR testing is started but not complete.

## Validation

- `node --check server\src\app.js; node --check server\src\middleware\security.js; node --check server\src\middleware\auth-context.js; node --check server\src\middleware\error-handler.js; node --check server\src\routes\auth-routes.js; node --check server\src\routes\setup-routes.js; node --check server\src\routes\state-routes.js; node --check server\src\config.js`
- `node --check control-api\src\app.js; node --check control-api\src\middleware\security.js; node --check control-api\src\middleware\auth-context.js; node --check control-api\src\middleware\error-handler.js; node --check control-api\src\routes\operator-auth-routes.js; node --check control-api\src\routes\public-saas-routes.js; node --check control-api\src\tenant-runtime-automation.js; node --check control-api\src\config.js`
- `npm.cmd audit --omit=dev` in `server/`
- `npm.cmd audit --omit=dev` in `control-api/`
- `git diff --check`
- `node --check server\src\middleware\tenant-runtime-context.js`
- Inline tenant runtime and legacy state fail-closed checks via `node -`
- Inline control-plane environment tenant/job binding and control API permission/error-sanitization checks via `node -`
- Inline scoped instructor route check via `node -`
- Inline tenant admin user password-minimum check via `node -`
- `node --check server\src\routes\account-routes.js; node --check server\src\routes\records-routes.js`
- Inline account, admin, records, and tenant app route role-scoping/error-sanitization checks via `node -`
