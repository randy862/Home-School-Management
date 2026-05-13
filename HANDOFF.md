# Session Handoff

Date: 2026-05-13

## Current Work

Production backend/platform security hardening in the lab environment.

## Current State

- Repo hardening pass from `NOTES/commercial-security-hardening-plan.md` is implemented on `saas-modern-redesign`.
- Lab tenant/control security gate has succeeded end-to-end against `https://192.168.1.210`.
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
- Latest APP001 deployed source backups use timestamped `.bak-*` copies beside replaced files.

## Next Action

Continue remaining `CHECKLISTS/security-lab-hardening.md` items:

1. Validate PostgreSQL host access controls (`pg_hba.conf` or lab firewall).
2. Run remaining UI/control smoke and Stripe unsigned-webhook rejection checks.
3. Run final lab gate/npm audits after any remaining changes.

## Risks

- AWS-only controls remain deferred until AWS/hosted production exists.
- Apex `https://navigrader.com/` DNS currently resolves away from WEB001.
- Untracked scratch assets remain intentionally untouched.
- In-memory rate limits are a lab/first-pass limiter, not final distributed SaaS abuse control.
- Lab uses shared non-superuser DB role `appuser`; final production should split least-privilege roles.

## Validation

- `node --check` on touched tenant API files passed.
- `git diff --check` passed for touched files.
- APP001 `hsm-api.service` restarted active after deploy.
- Tenant schema catch-up migration applied; active tenant has expected feature tables/columns.
- Fresh `hsm-api.service` log scan found no error/secret/token keyword matches after reruns.
- Control read-only mutation denial and internal-auth rejection probes passed.
