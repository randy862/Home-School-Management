# Current Status

Date: 2026-05-13

## Active Workstream

Production backend/platform security hardening.

## Current Focus

Completing `CHECKLISTS/security-lab-hardening.md` against APP001/WEB001/SQL001.

## Completed Recently

- SaaS redesign branch `saas-modern-redesign` remains the active hardening branch.
- Live SaaS polish remains deployed at `https://www.navigrader.com/`; tenant app remains at `https://mitchell.navigrader.com/`.
- Tenant/control APIs have security headers, CORS allowlists, production-safe 5xx responses, secure cookie defaults, and rate limits.
- Tenant runtime fails closed when PostgreSQL tenant schema resolution fails.
- Control environment jobs derive tenant identity from server-loaded environment rows.
- Student account/subscription/admin data is role-scoped.
- Legacy `/api/state` fails closed unless explicitly enabled.
- APP001 tenant/control services run as `hsm-api` and `hsm-control-api` with hardened systemd units and protected env files.
- SQL001 encrypted backup/restore validation succeeded and restore DB was dropped.
- Lab security gate succeeded against tenant and control APIs.
- Lab rate-limit, cookie, log-secret, and incident checklist checks passed.
- Added/applied tenant schema repair migrations `028`, `029`, and `030`.
- Fixed student-scoped PostgreSQL read queries that failed under `SELECT DISTINCT ... ORDER BY`.
- Redacted shared daily-break `studentIds` from student responses.
- Deeper student IDOR probe passed for 22 read endpoints and 10 admin-write denials.
- Read-only control operator probe passed for 17 protected mutation denials.
- Internal-auth rejection probe passed for 18 missing/invalid-auth checks.
- SQL001 PostgreSQL TCP app access is limited in `pg_hba.conf` to `appuser` from APP001 `192.168.1.200/32`; tenant/control DB probes and health checks passed after reload.

## Current Blockers

- None for tenant student-scope validation.

## Current Risks

- AWS controls remain deferred until AWS/hosted production exists.
- Apex `https://navigrader.com/` DNS currently resolves away from WEB001.
- Untracked scratch assets remain outside current security commits unless explicitly requested.
- In-memory rate limits are not final distributed SaaS abuse control.
- Lab DB uses shared non-superuser `appuser`; production should use split least-privilege roles.

## Next Actions

1. Run UI/control smoke and Stripe unsigned-webhook rejection.
2. Run final lab gate and npm audits after any remaining changes.
