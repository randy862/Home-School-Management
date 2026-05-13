# Security Lab Hardening Checklist

Date: 2026-05-12
Owner: QA & Release Agent

## Scope

Use this checklist to complete security hardening in the current lab environment before AWS/hosted-platform production exists.

Lab signoff means the code, service configuration, database access, backup/restore process, and role-bound API behavior have been proven in the lab. It does not sign off AWS security groups, public DNS/TLS, production monitoring, or public SaaS launch readiness.

## Lab Completion Criteria

- [ ] Hardened repo commits are deployed to the lab API/control API runtime.
- [ ] Lab runs with `APP_ENV=production` and `CONTROL_APP_ENV=production` when validating production-safe behavior.
- [ ] Tenant API and control API secrets are stored outside git.
- [ ] Secret files or environment stores are readable only by the service account or lab operator.
- [ ] Real Stripe live secrets are not used in lab unless intentionally testing live billing.
- [ ] `DB_CLIENT=postgres` is used for hardening validation.
- [ ] `LEGACY_STATE_SYNC_ENABLED=false` unless a specific legacy bridge test requires it.

## Lab Service And Host Checks

- [ ] API/control services run as non-admin users where the lab supports service users.
- [ ] Services start cleanly after restart.
- [ ] Service logs do not expose passwords, session tokens, Stripe secrets, internal auth secrets, or database URLs.
- [ ] CORS allowlist rejects an unlisted origin.
- [ ] Login/setup/bootstrap rate limits return `429` after repeated attempts.
- [ ] Tenant and operator cookies include `HttpOnly`, expected `SameSite`, and `Secure` when validating over HTTPS.
- [ ] Production 5xx responses return a generic error while logs keep diagnostic detail.

## Lab Database Checks

- [ ] Tenant API and control API use non-superuser PostgreSQL roles.
- [ ] Lab role grants are documented, even if they are less strict than the final production model.
- [ ] Tenant runtime cannot resolve without a tenant schema in PostgreSQL mode.
- [ ] Tenant schema identifiers are validated before generated search paths are used.
- [ ] `pg_hba.conf` or the lab firewall limits PostgreSQL to lab app/control hosts where possible.

## Lab Backup And Restore

- [ ] Create an encrypted PostgreSQL backup of the lab database.
- [ ] Restore the encrypted backup into an isolated lab restore database.
- [ ] Verify restored schema counts, tenant runtime rows, users, and representative academic records.
- [ ] Delete or rotate the restore-test database after validation.
- [ ] Record backup and restore commands, duration, and any failed objects.

## Lab Permission And IDOR Checks

- [ ] Student users cannot read another student's account, instructor, records, curriculum, schedule-block, or plan data.
- [ ] Student users receive `403` for tenant admin writes.
- [ ] Non-admin tenant users do not receive subscription, billing-event, upgrade, or export-request details.
- [ ] Under-permissioned control operators receive `403` for tenant, environment, job retry, operator, and commercial mutations.
- [ ] Internal commercial/control endpoints reject missing or invalid internal auth.
- [ ] Legacy `/api/state` returns disabled in production-style lab validation.

## Lab Smoke Gate

- [ ] Run the lab security gate:

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

- [ ] Tenant login succeeds.
- [ ] Operator login succeeds.
- [ ] Student-scoped dashboard data loads.
- [ ] Admin dashboard data loads.
- [ ] Account page loads for student and admin roles.
- [ ] Control tenant/environment/job views load for an authorized operator.
- [ ] Stripe webhook endpoint rejects unsigned payloads.
- [ ] `npm audit --omit=dev` remains clean for `server/`.
- [ ] `npm audit --omit=dev` remains clean for `control-api/`.

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
