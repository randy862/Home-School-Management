# Commercial Security Hardening Plan

Date: 2026-04-29
Status: Planning / pre-production security backlog
Owner: Product Architect

## Objective

Prepare Navigrader for a public commercial SaaS launch by identifying and prioritizing security hardening work across:

- application code
- tenant isolation
- authentication and authorization
- public web/API exposure
- Debian host patching
- Apache/TLS configuration
- PostgreSQL configuration and access control
- Stripe/webhook handling
- secrets management
- backup/restore security
- monitoring, logging, and incident response

This note is not a completed security audit. It defines the recommended security review program and the first areas that need attention before moving to a production AWS environment and marketing publicly.

## Security Target

Navigrader should be hardened to a commercial SaaS baseline:

- only authenticated/authorized users can access tenant data
- one tenant cannot access another tenant's data
- operator/control actions are permissioned, audited, and guarded
- public endpoints are protected against common web attacks
- secrets are not stored in code, logs, or public assets
- OS, Apache, Node.js, npm dependencies, and PostgreSQL are patched on a defined cadence
- backups are encrypted, tested, and access-controlled
- incidents can be detected, triaged, contained, and recovered from

## Initial Repo-Level Observations

These are preliminary observations from existing repo assets, not final findings.

1. Public HTTPS production posture is not yet fully documented.
   - `infra/apache/home-school-management.conf` is a port `80` staging-style config.
   - Production needs HTTPS-only, redirect from HTTP to HTTPS, HSTS, strong TLS settings, and secure cookies.

2. Systemd templates intentionally contain placeholders.
   - `infra/systemd/hsm-api.service` and `infra/systemd/hsm-control-api.service` include `CHANGEME` secrets and staging cookie settings.
   - Production needs a secrets-management pattern that keeps real secrets out of repo and process lists where possible.

3. Session hardening has begun.
   - Tenant and control sessions now have server-side inactivity limits and absolute lifetimes.
   - Production should still confirm secure cookie flags, SameSite behavior, logout behavior, and session revocation coverage.

4. Tenant isolation deserves a focused audit.
   - Current hosted/staged model uses PostgreSQL schemas and `PGOPTIONS` search paths.
   - The long-term target architecture recommends stronger tenant isolation, ideally database-per-tenant.
   - Before public SaaS launch, verify that every request resolves tenant context correctly and cannot drift to `public` or another tenant schema.

5. Dependency and OS patching are not yet formalized.
   - `server/package.json` includes `express`, `pg`, `dotenv`, and legacy `mssql`.
   - `control-api/package.json` includes `express`, `pg`, and `dotenv`.
   - Add npm audit/dependency review and Debian patch cadence to the production runbook.

6. Application security testing is not yet documented as a release gate.
   - Add repeatable checks for injection risks, auth bypass, IDOR, CSRF, XSS, CORS, webhook validation, and rate limiting.

## Recommended Hardening Workstreams

## 1. Application Code Security Review

### Goals

Identify vulnerabilities in the tenant app, control API, public SaaS signup flow, and frontend assets.

### Review Areas

- SQL injection
  - verify all PostgreSQL queries use parameterized values
  - audit any dynamic SQL, schema names, table names, order clauses, and search path handling
  - validate tenant schema identifiers are sanitized and never directly user-controlled
- Cross-site scripting
  - audit frontend rendering paths that use `innerHTML` or template strings
  - confirm all user-controlled display data is escaped before injection into DOM
  - review report rendering, dashboard rows, grade comments, course names, student names, tenant names, and control-plane audit messages
- CSRF
  - evaluate whether SameSite cookies are enough for the public threat model
  - consider CSRF tokens for state-changing routes, especially account, billing, operator, and lifecycle actions
- IDOR / authorization bypass
  - ensure routes enforce ownership/tenant context server-side
  - verify users cannot request or mutate records outside their role or tenant
  - verify student users cannot reach admin-only data
- Input validation
  - confirm every write endpoint normalizes, bounds, and rejects invalid input
  - add length limits for names, emails, notes, domains, slugs, and free text
  - reject unexpected fields where practical
- File/path safety
  - audit deployment, archive, export, and provisioning paths for path traversal and shell injection
  - avoid building shell commands from untrusted tenant/customer input
- Rate limiting and abuse controls
  - login attempts
  - setup/activation links
  - password changes
  - Stripe checkout/session creation
  - public signup/provisioning endpoints
- Error handling
  - prevent stack traces, SQL errors, secrets, or filesystem paths from reaching users
  - preserve useful internal logs without exposing sensitive details

### Suggested Tools

- `npm audit` for dependency vulnerability scan
- `rg`-based code audit for risky patterns:
  - `innerHTML`
  - `insertAdjacentHTML`
  - `eval`
  - `Function(`
  - `child_process`
  - SQL string interpolation
  - `PGOPTIONS`
  - `search_path`
  - `res.json(error`
  - `console.log` with tokens/secrets
- optional later: OWASP ZAP baseline scan against staging
- optional later: semgrep rules for JavaScript/Express/SQL injection patterns

## 2. Authentication And Session Hardening

### Current Baseline

- Backend-owned sessions exist for tenant app and control plane.
- Server-side inactivity expiration has been added.
- Control plane has operator permissions and lifecycle confirmations.

### Recommended Hardening

- Production cookies:
  - `Secure=true`
  - `HttpOnly=true`
  - `SameSite=Lax` or stricter where compatible
  - host/domain scoped as narrowly as possible
- Add login rate limiting and temporary lockout/throttling.
- Add password complexity/minimum length policy.
- Add password reset flow with expiring, single-use tokens.
- Add optional MFA for control-plane operators before public launch.
- Confirm logout revokes the exact session token server-side.
- Consider an operator session dashboard/revocation control.
- Audit session fixation risks around setup/login flows.

## 3. Authorization And Tenant Isolation

### Risks To Audit

- tenant resolver mistakes
- accidental fallback to PostgreSQL `public`
- schema search path drift
- control-plane actions against wrong tenant/environment
- unguarded route mutations
- broad legacy `/api/state` bridge exposure

### Recommended Controls

- Treat tenant identity as server-owned and derived from trusted hostname/control metadata.
- Never trust tenant identifiers from browser input for data scoping.
- Add explicit runtime guard that rejects requests if tenant resolution is missing or ambiguous.
- Add explicit runtime guard that rejects hosted PostgreSQL mode if search path/schema is unsafe.
- Continue reducing legacy bridge dependence in hosted mode.
- Audit all route groups for role/permission checks.
- Add tests/smoke checks that attempt cross-tenant access and verify denial.
- For AWS production, strongly consider database-per-tenant or at least dedicated DB users/roles per tenant.

## 4. Public Web And Apache Hardening

### Required Production Settings

- HTTPS-only with valid certificate
- HTTP-to-HTTPS redirect
- HSTS after TLS is verified
- modern TLS protocol/cipher configuration
- request body size limits
- proxy timeout limits
- disable directory indexes
- deny dotfiles and unexpected file types
- security headers:
  - `Content-Security-Policy`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy`
  - `Permissions-Policy`
  - `X-Frame-Options` or CSP `frame-ancestors`
- separate access/error logs for:
  - tenant app
  - control plane
  - public SaaS/signup pages
- log rotation and retention policy

### Specific Repo Follow-Up

- Add production Apache template separate from the current staging `:80` config.
- Document the final production hostname and TLS termination decision in `RUNBOOKS/production-cutover.md`.
- Confirm `SESSION_COOKIE_SECURE=true` and `CONTROL_SESSION_COOKIE_SECURE=true` in production.

## 5. Debian / AWS Host Hardening

### OS Baseline

- use supported Debian release
- unattended security upgrades or a defined patch window
- SSH key-only access
- disable password SSH login
- disable root SSH login
- least-privilege sudo
- host firewall/security group rules:
  - public: only `80/443` to web tier
  - app tier: only required traffic from web/control tier
  - DB tier: only PostgreSQL from app/control hosts
  - SSH restricted to trusted admin IP/VPN
- systemd services run as dedicated non-login service users, not generic `debian`
- set file ownership/permissions for app directories and secret files
- consider `systemd` hardening options:
  - `NoNewPrivileges=true`
  - `PrivateTmp=true`
  - `ProtectSystem=full`
  - `ProtectHome=true`
  - `ReadWritePaths=` narrowed to required directories
  - `CapabilityBoundingSet=`

### Patch Cadence

Define:

- weekly security update check
- monthly maintenance window
- emergency patch process for critical CVEs
- post-patch smoke gate
- rollback/recovery expectations

## 6. PostgreSQL Hardening

### Required Controls

- private network only; no public PostgreSQL exposure
- strong unique DB credentials
- least-privilege DB roles
- separate control-plane and tenant privileges
- no superuser credentials in app services
- encrypted backups
- restore tests
- connection limits
- statement timeout / idle transaction timeout
- logging for auth failures and long-running queries
- `pg_hba.conf` locked down to app/control hosts

### Tenant Data Isolation

Before public launch, decide whether production will use:

1. database per tenant
2. schema per tenant with strict role/search-path guards
3. hybrid model for early launch, with migration path to database per tenant

The safest commercial direction remains database-per-tenant, but schema-per-tenant may be acceptable for early launch only if isolation guards and operational recovery are strong.

## 7. Stripe, Billing, And Webhook Security

### Required Controls

- verify Stripe webhook signatures on every webhook request
- no webhook state mutation without signature verification
- idempotency handling for repeated webhook events
- store Stripe IDs but avoid storing card/payment data
- protect billing/admin endpoints with tenant or operator auth
- verify checkout session belongs to intended plan/customer before provisioning
- distinguish test and live Stripe keys clearly
- no live Stripe secret in repo, logs, screenshots, or browser output
- restrict Stripe dashboard access to necessary operators

## 8. Secrets Management

### Needs Attention

Current repo templates use placeholders, which is appropriate, but production needs a specific secret delivery model.

Recommended production options:

- AWS Systems Manager Parameter Store
- AWS Secrets Manager
- encrypted `.env` files managed outside git for a first simple production step

Minimum requirements:

- no real secrets in git
- no secrets in Apache public directories
- file permissions restricted to service user/root
- rotate shared internal auth secrets before production
- separate staging/test/live Stripe secrets
- document who can access production secrets
- document rotation procedure

## 9. Logging, Monitoring, And Incident Response

### Required Visibility

- health checks for tenant app and control API
- service restart monitoring
- Apache 4xx/5xx trends
- failed login count
- operator action audit trail
- provisioning job failures
- Stripe webhook failures
- database backup success/failure
- disk space and certificate expiration

### Incident Response Docs

Existing control-plane and deployment recovery docs are a good start.

Add:

- security incident checklist
- suspected tenant data exposure procedure
- credential compromise procedure
- Stripe webhook incident procedure
- production emergency patch procedure
- customer communication draft process

## 10. Backup, Restore, And Data Retention

### Required Controls

- encrypted PostgreSQL backups
- backup access limited to operators who need it
- regular restore tests
- documented recovery point objective and recovery time objective
- tenant archive/export handling that does not leak data
- purge process with typed confirmation and audit trail
- paid customer export workflow that separates export generation from destructive purge

## 11. Recommended Audit Sequence

### Slice 1: Static Repo Security Audit

Deliver:

- dependency scan results
- risky-code-pattern inventory
- route/auth/authorization inventory
- frontend XSS surface inventory
- SQL dynamic-query inventory
- initial prioritized findings list

Acceptance criteria:

- every finding has severity, impacted file/path, risk explanation, and recommended fix
- no production changes are made without review

### Slice 2: Runtime Configuration Audit

Deliver:

- Apache staging vs production gap list
- systemd hardening gap list
- Debian patch posture checklist
- PostgreSQL access-control checklist
- AWS security group target design

Acceptance criteria:

- production AWS launch checklist includes all required settings
- staging config remains clearly separate from production config

### Slice 3: Authentication, Authorization, And Tenant Isolation Review

Deliver:

- route-by-route auth matrix
- tenant resolution and schema isolation review
- session/cookie security review
- control-plane permission review
- cross-tenant abuse test plan

Acceptance criteria:

- no route with tenant data is unauthenticated unless intentionally public
- no state-changing control operation lacks permission checks and audit logging
- tenant context cannot be supplied by untrusted browser input

### Slice 4: Web Security Testing

Deliver:

- OWASP ZAP or equivalent baseline scan against staging
- manual login/session/cookie tests
- CSRF/XSS/IDOR test notes
- rate-limit recommendations

Acceptance criteria:

- high/critical findings are fixed before public marketing launch
- medium findings are either fixed or explicitly accepted with a date

### Slice 5: Production AWS Hardening Checklist

Deliver:

- AWS network/security group plan
- instance patching model
- secrets model
- backup model
- monitoring/alerting model
- production cutover security signoff checklist

Acceptance criteria:

- no production cutover until security checklist is reviewed and signed off

## Initial Priority List

1. Add a formal static code/security audit pass before public launch.
2. Add a production Apache/TLS/security-header template.
3. Define AWS security group and private-network topology.
4. Confirm production cookie settings and session behavior.
5. Add login rate limiting.
6. Audit tenant resolution/search-path handling for cross-tenant risk.
7. Create a dependency and OS patch cadence.
8. Define production secrets management.
9. Add PostgreSQL least-privilege and backup/restore hardening.
10. Add a security incident checklist.

## Recommended Next Prompt

When ready to start the first real hardening pass:

```text
Pick up security hardening from NOTES/commercial-security-hardening-plan.md. Start with Slice 1: Static Repo Security Audit. Do not make functional changes yet. Produce a findings document with severity, impacted files, risk, and recommended fixes. Focus first on injection, XSS, CSRF, auth bypass, IDOR, tenant isolation, secrets exposure, and dependency risks.
```
