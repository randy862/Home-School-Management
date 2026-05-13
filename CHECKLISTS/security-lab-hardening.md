# Security Lab Hardening Checklist

Date: 2026-05-12
Owner: QA & Release Agent

## Scope

Use this checklist to complete security hardening in the current lab environment before AWS/hosted-platform production exists.

Lab signoff means the code, service configuration, database access, backup/restore process, and role-bound API behavior have been proven in the lab. It does not sign off AWS security groups, public DNS/TLS, production monitoring, or public SaaS launch readiness.

## Lab Completion Criteria

- [x] Hardened repo commits are deployed to the lab API/control API runtime.
- [x] Lab runs with `APP_ENV=production` and `CONTROL_APP_ENV=production` when validating production-safe behavior.
- [x] Tenant API and control API secrets are stored outside git.
- [x] Secret files or environment stores are readable only by the service account or lab operator.
- [ ] Real Stripe live secrets are not used in lab unless intentionally testing live billing.
- [x] `DB_CLIENT=postgres` is used for hardening validation.
- [x] `LEGACY_STATE_SYNC_ENABLED=false` unless a specific legacy bridge test requires it.

## Lab Service And Host Checks

- [x] API/control services run as non-admin users where the lab supports service users.
- [x] Services start cleanly after restart.
- [x] Service logs do not expose passwords, session tokens, Stripe secrets, internal auth secrets, or database URLs.
- [x] CORS allowlist rejects an unlisted origin.
- [x] Login/setup/bootstrap rate limits return `429` after repeated attempts.
- [x] Tenant and operator cookies include `HttpOnly`, expected `SameSite`, and `Secure` when validating over HTTPS.
- [x] Production 5xx responses return a generic error while logs keep diagnostic detail.

## Lab Database Checks

- [x] Tenant API and control API use non-superuser PostgreSQL roles.
- [x] Lab role grants are documented, even if they are less strict than the final production model.
- [x] Tenant runtime cannot resolve without a tenant schema in PostgreSQL mode.
- [x] Tenant schema identifiers are validated before generated search paths are used.
- [x] `pg_hba.conf` or the lab firewall limits PostgreSQL to lab app/control hosts where possible.

## Lab Backup And Restore

- [x] Create an encrypted PostgreSQL backup of the lab database.
- [x] Restore the encrypted backup into an isolated lab restore database.
- [x] Verify restored schema counts, tenant runtime rows, users, and representative academic records.
- [x] Delete or rotate the restore-test database after validation.
- [x] Record backup and restore commands, duration, and any failed objects.

Lab backup evidence, 2026-05-13:

- SQL001 encrypted backup: `/var/backups/home-school-management/appdb-20260513T010750Z.dump.enc`
- SHA-256: `590e2268ece71200a0adb2a766b53a2f926d1c08251083e748b7c9432df9e160`
- Restore database: `hsm_restore_20260513010750`, verified and dropped.
- Duration: 14 seconds.
- Verified metrics matched source and restore: `base_tables_non_system=541`, `control_tenant_environments=25`, `schemas_with_users=23`, `tenant_schemas=22`, `users_total=24`.
- Lab DB role note: tenant API and control API use `appuser`; `appuser` is not superuser, cannot create databases, and cannot create roles. This remains a shared lab application role, not the final split production least-privilege role model.
- SQL001 host-access note: `/etc/postgresql/17/main/pg_hba.conf` was backed up to `/etc/postgresql/17/main/pg_hba.conf.bak-20260513015337`, broad `192.168.1.0/24` and `fe80::/10` app access was removed, and TCP app access is limited to `appuser` from APP001 `192.168.1.200/32` with `scram-sha-256`. APP001 tenant/control DB probes and tenant/control health checks succeeded after reload.

## Lab Permission And IDOR Checks

- [x] Student users cannot read another student's account, instructor, records, curriculum, schedule-block, or plan data.
- [x] Student users receive `403` for tenant admin writes.
- [x] Non-admin tenant users do not receive subscription, billing-event, upgrade, or export-request details.
- [x] Under-permissioned control operators receive `403` for tenant, environment, job retry, operator, and commercial mutations.
- [x] Internal commercial/control endpoints reject missing or invalid internal auth.
- [x] Legacy `/api/state` returns disabled in production-style lab validation.

Lab IDOR evidence, 2026-05-13:

- Added and applied tenant-schema repair migrations `029_instructor_assignments_tenant_schemas.sql` and `030_tenant_schema_feature_catchup.sql` after route probes exposed older lab tenant schema drift.
- Deployed fixes for student-scoped PostgreSQL `SELECT DISTINCT` ordering in instructor, curriculum, and schedule-block reads.
- Redacted shared daily-break `studentIds` responses so a student sees only their own student ID.
- Temporary student probe against `tenant_auto_20260328200130` checked 22 authenticated read endpoints with no other-student ID leakage.
- Temporary student probe verified 10 tenant admin-write attempts returned `403`.
- Fresh `hsm-api.service` log scan after reruns found no error/secret/token keyword matches.

Lab control authorization evidence, 2026-05-13:

- Temporary read-only control operator with no `manageCustomers`, `manageEnvironments`, `manageOperations`, or `manageUsers` permissions logged in through the real control API.
- Verified 17 protected control mutations returned `403`, covering tenant, environment, provisioning/deploy/setup/lifecycle/archive/sync jobs, job retry, operator management, and commercial subscription actions.
- Verified 18 internal-auth rejection checks returned `401` for missing auth, invalid bearer JWT, and invalid legacy control-plane key across tenant setup status and internal commercial subscription endpoints.
- Fresh tenant/control log scan found no password/secret/token/auth header keyword leakage.
- Unsigned Stripe webhook probe against `/control-api/api/public/billing/webhook` returned `400` with `Missing Stripe signature header.`

## Lab Smoke Gate

- [x] Run the lab security gate:

```powershell
scripts\Invoke-LabSecurityGate.ps1 `
  -TenantBaseUrl "http://LAB-WEB-OR-API" `
  -TenantAdminUsername "..." `
  -TenantAdminPassword "..." `
  -TenantStudentUsername "..." `
  -TenantStudentPassword "..." `
  -ControlBaseUrl "http://LAB-CONTROL/control-api" `
  -ControlUsername "..." `
  -ControlPassword "..." `
  -RejectedOrigin "https://not-allowed.example" `
  -AllowInsecureTls
```

Use `-AllowInsecureTls` only when the lab redirects to HTTPS with a certificate this workstation does not trust.

- [x] Tenant login succeeds.
- [x] Operator login succeeds.
- [x] Student-scoped dashboard data loads.
- [x] Admin dashboard data loads.
- [x] Account page loads for student and admin roles.
- [x] Control tenant/environment/job views load for an authorized operator.
- [x] Stripe webhook endpoint rejects unsigned payloads.
- [x] `npm audit --omit=dev` remains clean for `server/`.
- [x] `npm audit --omit=dev` remains clean for `control-api/`.

Lab smoke evidence, 2026-05-13:

- Temporary tenant admin and student accounts each loaded 22 dashboard/account backing API endpoints successfully, then were deleted.
- Temporary full-permission control operator loaded 7 control view backing API endpoints successfully, then was deleted.
- Final `npm audit --omit=dev` returned `found 0 vulnerabilities` in both `server/` and `control-api/`.

## Deferred Until AWS / Hosted Production

- [ ] AWS security groups and subnet boundaries.
- [ ] Public DNS and production TLS certificate validation.
- [ ] Public WEB001/APP001/SQL001 network segmentation.
- [ ] Production-grade monitoring/alert routing.
- [ ] Production customer incident notification path.
- [ ] Final public launch security signoff.

## Signoff

- [ ] Lab hardening completed by:
- [ ] Date completed:
- [ ] Deferred AWS controls acknowledged:
