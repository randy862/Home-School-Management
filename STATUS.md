# Current Status

Date: 2026-05-12

## Active Workstream

Production backend/platform security hardening.

## Current Focus

First repo-level commercial hardening pass from `NOTES/commercial-security-hardening-plan.md`.

## Completed Recently

- Modern app interface was promoted to production at `https://mitchell.navigrader.com/`.
- SaaS redesign branch `saas-modern-redesign` was fast-forwarded to the modern production baseline.
- Preview-only files `web/saas-preview.html` and `web/saas-preview.css` were added.
- Existing `web/saas.js` checkout and public plan-loading behavior is reused.
- The preview page was deployed to `https://www.navigrader.com/saas-preview.html`.
- Live `https://www.navigrader.com/` now serves `/saas.html` through a guarded WEB001 Apache rewrite.
- Tenant subdomain root pages, including `https://mitchell.navigrader.com/`, still serve the hosted workspace login.
- Blended production-layout preview remains available at `https://www.navigrader.com/saas-blended-preview.html`.
- The polished production-layout SaaS page is now live through `web/saas.html` plus `web/saas-polish.css?v=202605121350`.
- Hero/Problem treatment remains as approved, with the divider removed and CTA buttons centered over trust chips.
- Built For/Solution remain production-style cards.
- Joy, Why It Helps, How It Works, Pricing, FAQ, and bottom screenshots keep distinct cards with blended section titles.
- Bottom CTA uses updated production screenshot assets and corrected labels.
- Bottom CTA screenshots open in a larger click/keyboard preview modal.
- Live `saas.html` backup exists on WEB001:
  `/var/www/home-school-management/web/saas.html.bak-20260512-saas-polish`
- Latest pushed commits before this production polish: `75533f1`, `781fffd`.
- Security hardening pass applied:
  - API security headers for tenant API and control API.
  - CORS allowlist behavior instead of origin reflection when configured.
  - Rate limits on tenant login/setup, operator login/bootstrap, public checkout, and Stripe webhook ingress.
  - Production-safe 5xx error responses with server-side logging.
  - Production cookie defaults infer secure cookies in production.
  - Setup/bootstrap password minimum length added.
  - Tenant schema identifiers validated before provisioning-generated search paths.
  - Production Apache SSL template added.
  - Existing Apache templates disable directory indexes and deny dotfiles.
  - Systemd templates now use secure cookies, external secret env files, dedicated users, and hardening directives.
  - `server/package-lock.json` updated to remediate `path-to-regexp`; `control-api/package-lock.json` added.
- Added `CHECKLISTS/security-hardening-deployment.md` for APP001/WEB001/SQL001 hardening prerequisites and validation.
- Tenant runtime middleware now fails closed for unresolved PostgreSQL tenant contexts and only allows fallback runtime when the request matches the configured tenant app host.
- Control-plane environment job routes now derive tenant identity from the server-loaded environment and reject mismatched body tenant IDs.
- `GET /api/instructors` now scopes student users to assigned instructors only and redacts instructor birthdate/background fields for student responses.
- Tenant user creation and account password changes now use the same 10-character minimum as setup/operator flows.
- `GET /api/account` now withholds hosted subscription, upgrade, billing-event, and export-request details from non-admin users.
- Account routes now sanitize production 5xx responses instead of returning raw internal error messages.
- Records routes now sanitize production 5xx responses and retained student read scoping/admin-only writes under route-level checks.
- Legacy `/api/state` full-state sync now fails closed in production unless `LEGACY_STATE_SYNC_ENABLED=true` is explicitly set.
- Admin routes now sanitize production 5xx responses and retain route-level checks for student scoping/admin-only writes.
- Curriculum/calendar/grading routes now sanitize production 5xx responses; student schedule-block reads are scoped to assigned blocks.
- Control API routes now share production-safe route error handling across tenant, environment, job, operator, audit, runtime, and commercial endpoints.
- Added `CHECKLISTS/security-operational-hardening.md` for PostgreSQL roles, encrypted backup/restore, AWS security groups, monitoring, and incident response.
- Added `CHECKLISTS/security-lab-hardening.md` so lab hardening can be signed off while AWS-only controls remain deferred.
- Added `scripts/Invoke-LabSecurityGate.ps1` for lab health, login, privacy, permission, legacy-state, CORS, and optional control checks.
- Added `server/migrations/postgres/028_user_profile_fields_tenant_schemas.sql` to repair lab tenant schemas missing user profile columns required by current login queries.
- Lab database migration and lab tenant credential reset were applied manually during validation.
- Local hardening branch was pushed to `origin/saas-modern-redesign`.
- APP001 `.env.runtime` was updated to `APP_CORS_ORIGIN=https://192.168.1.210`; rejected-origin CORS probe now returns `403`.
- `scripts\Invoke-LabSecurityGate.ps1` succeeded against lab tenant/control APIs.
- Broad tenant/control route raw-error scan, syntax checks, and production npm audits are clean.

## Current Blockers

- None for scripted lab gate; APP001 live systemd service still needs reconciliation with the hardened template.

## Current Risks

- Apex `https://navigrader.com/` DNS currently resolves away from WEB001.
- Untracked scratch assets remain outside the current commit unless explicitly requested.
- Continue avoiding archive/ and NOTES/ unless the task requires them.
- In-memory rate limits are a first hardening step, not the final distributed SaaS abuse-control design.
- Lab PostgreSQL role/backup hardening and cross-tenant abuse tests remain open; AWS security groups remain deferred until AWS exists.

## Next Actions

1. Complete `CHECKLISTS/security-lab-hardening.md` against the lab environment.
2. Continue lab host/database/backup/deeper-IDOR hardening items not covered by the scripted gate.
3. Keep AWS-only controls deferred until the hosted platform exists.
