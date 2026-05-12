# Session Handoff

Date: 2026-05-12

## Current Work

Production backend/platform security hardening.

Live URL: https://www.navigrader.com/

Preview URLs:

- https://www.navigrader.com/saas-preview.html
- https://www.navigrader.com/saas-blended-preview.html

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
- Added `CHECKLISTS/security-hardening-deployment.md` for service-user, secret-file, Apache, DB, and post-deploy validation prerequisites.
- Tightened tenant runtime resolution so hosted PostgreSQL requests fail closed without a resolved tenant schema; fallback runtime is host-bound when `TENANT_APP_BASE_URL` is configured.

Prior live SaaS polish remains deployed at `https://www.navigrader.com/`; see previous history if that workstream is reopened.

Current commits:

- `75533f1 Add SaaS landing preview redesign`
- `781fffd Update SaaS preview hero imagery`

## Next Action

Use `CHECKLISTS/security-hardening-deployment.md` to prepare production prerequisites, then run the hosted release gate against the target environment after deploy.

## Risks

- Apex `https://navigrader.com/` DNS currently resolves to parking/forwarding IPs, not WEB001.
- Scratch assets remain intentionally untouched.
- Checkout uses live public plans and checkout endpoints through existing `saas.js`.
- In-memory rate limits are not a final distributed SaaS limiter.
- PostgreSQL least privilege, encrypted backup/restore, AWS security groups, incident checklist, and cross-tenant abuse tests remain open.
- Route-by-route IDOR testing is started but not complete.

## Validation

- `node --check server\src\app.js; node --check server\src\middleware\security.js; node --check server\src\middleware\auth-context.js; node --check server\src\middleware\error-handler.js; node --check server\src\routes\auth-routes.js; node --check server\src\routes\setup-routes.js; node --check server\src\config.js`
- `node --check control-api\src\app.js; node --check control-api\src\middleware\security.js; node --check control-api\src\middleware\auth-context.js; node --check control-api\src\middleware\error-handler.js; node --check control-api\src\routes\operator-auth-routes.js; node --check control-api\src\routes\public-saas-routes.js; node --check control-api\src\tenant-runtime-automation.js; node --check control-api\src\config.js`
- `npm.cmd audit --omit=dev` in `server/`
- `npm.cmd audit --omit=dev` in `control-api/`
- `git diff --check`
- `node --check server\src\middleware\tenant-runtime-context.js`
- Inline tenant runtime fail-closed check via `node -`
