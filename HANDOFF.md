# Session Handoff

Date: 2026-05-13

## Current Work

Lab-hosted production readiness after completed security hardening.

## Current State

- Repo hardening pass from `NOTES/commercial-security-hardening-plan.md` is implemented on `saas-modern-redesign`.
- Lab hardening checklist is signed off for APP001/WEB001/SQL001.
- Added `RUNBOOKS/lab-production-readiness.md` as the source of truth for continuing app changes safely on top of the hardened lab baseline.
- APP001 and WEB001 deploy paths are recorded in the readiness runbook with `RUNBOOKS/hosted-deployment.md` as the detailed deployment reference.
- Final user-rerun tenant/control security gate succeeded end-to-end against `https://192.168.1.210`.
- APP001 tenant/control APIs run as dedicated service users with hardened systemd units and protected env files.
- SQL001 encrypted backup and isolated restore validation succeeded; restore DB was dropped.
- Lab rate-limit stress, cookie flag inspection, generic 5xx/log review, and incident checklist checks have passed.
- Added/applied tenant schema repair migrations:
  - `server/migrations/postgres/028_user_profile_fields_tenant_schemas.sql`
  - `server/migrations/postgres/029_instructor_assignments_tenant_schemas.sql`
  - `server/migrations/postgres/030_tenant_schema_feature_catchup.sql`
- Fixed student-scoped instructor/curriculum/schedule-block PostgreSQL queries that failed on `SELECT DISTINCT ... ORDER BY`.
- Redacted shared daily-break `studentIds` for student users.
- Deeper student probe passed:
  - 22 authenticated read endpoints checked with no other-student ID leakage.
  - 10 tenant admin-write attempts returned `403`.
- Temporary read-only control operator probe passed:
  - 17 protected control mutations returned `403`.
  - 18 internal-auth rejection checks returned `401`.
- Unsigned Stripe webhook probe returned `400`.
- SQL001 `pg_hba.conf` now limits TCP app DB access to `appuser` from APP001 `192.168.1.200/32` with `scram-sha-256`; backup is `/etc/postgresql/17/main/pg_hba.conf.bak-20260513015337`.
- Tenant admin/student API smoke and control view API smoke passed with temporary accounts.
- Final npm audits are clean for `server/` and `control-api/`.
- Lab Stripe secret classification confirmed test-mode key material and configured webhook secret.
- Latest APP001 deployed source backups use timestamped `.bak-*` copies beside replaced files.
- Public tenant-domain login CORS was repaired:
  - tenant API now supports configured wildcard origins such as `https://*.navigrader.com`
  - APP001 live runtime CORS includes lab IP, apex/www, and Navigrader tenant subdomains
  - `mitchell.navigrader.com` and `pj-cool.navigrader.com` now reach normal auth validation instead of blank `403`
  - `not-allowed.example` remains rejected with `403`
- User confirmed browser login works in both tenant domains after the CORS repair.
- User-rerun `scripts\Invoke-LabSecurityGate.ps1` succeeded after the CORS repair.
- `RUNBOOKS/lab-production-readiness.md` now documents rollback snapshot creation, exact APP001 rollback commands, exact WEB001 rollback commands, and the minimum monitoring/alerting baseline.
- Commercial signup recovery for `may122026.navigrader.com` completed:
  - original provisioning failed on hardened APP001 `.env.runtime` permissions
  - control worker now supports `CONTROL_DEPLOY_APP_RUNTIME_ENV_ENABLED=false`
  - retry provisioning succeeded with `runtimeEnvDeployed=false`
  - `hsm-control-api` was given locked-down SSH home `/var/lib/hsm-control-api` for WEB001 deployment automation
  - setup-token job succeeded, Postmark delivery was `sent`, and user confirmed admin setup/login worked

## Next Action

Continue non-blocking readiness work from `RUNBOOKS/lab-production-readiness.md`:

1. Record where operational secrets live and who can access them, without writing secret values into git.
2. Resolve or explicitly defer apex `https://navigrader.com/` DNS routing.
3. Plan production split of PostgreSQL least-privilege roles beyond the lab `appuser`.

## Risks

- AWS-only controls remain deferred until AWS/hosted production exists.
- Apex `https://navigrader.com/` DNS currently resolves away from WEB001.
- Untracked scratch assets remain intentionally untouched.
- In-memory rate limits are a lab/first-pass limiter, not final distributed SaaS abuse control.
- Lab uses shared non-superuser DB role `appuser`; final production should split least-privilege roles.
- Future app changes are allowed; rerun only the validation gates that match touched auth, API, DB, web, or infrastructure areas.

## Validation

- `node --check` on touched tenant API files passed.
- `git diff --check` passed for touched files.
- APP001 `hsm-api.service` restarted active after deploy.
- Tenant schema catch-up migration applied; active tenant has expected feature tables/columns.
- Fresh `hsm-api.service` log scan found no error/secret/token keyword matches after reruns.
- Control read-only mutation denial and internal-auth rejection probes passed.
- APP001 tenant/control DB probes and tenant/control health checks passed after SQL001 `pg_hba.conf` reload.
- APP001 `hsm-api.service` and `hsm-control-api.service` restarted active after public tenant-domain CORS repair.
- Browser tenant-login retry passed for both reported tenants, and the lab security gate succeeded after repair.
- Rollback and monitoring baseline documentation completed; no service changes were made for this docs-only step.
- `may122026.navigrader.com` health returned `200`; provisioning request reached `ready`; setup email was delivered and user completed admin setup.
