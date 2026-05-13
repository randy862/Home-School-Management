# Lab-Hosted Production Readiness Runbook

Date started: 2026-05-13
Current readiness baseline commit: `bea748a`

## Purpose

Prepare the current APP001/WEB001/SQL001 lab-hosted platform for continued production-readiness work while app changes continue.

This is not a launch freeze. It is the operating foundation for making future changes safely, with clear validation and rollback expectations.

## Scope

Current lab-hosted topology:

- `WEB001`: Apache, public web assets, TLS/reverse proxy path.
- `APP001`: tenant API and control API services.
- `SQL001`: PostgreSQL runtime database.
- Active branch: `saas-modern-redesign`.
- Lab tenant/control public test target: `https://192.168.1.210`.

AWS/public-production controls remain deferred until AWS or another hosted production target exists.

## Foundation Completed

- [x] Lab security hardening checklist is signed off.
- [x] Final tenant/control lab security gate succeeded after hardening.
- [x] APP001 tenant/control APIs run as dedicated service users.
- [x] APP001 tenant/control systemd units and env files are hardened for the lab.
- [x] SQL001 PostgreSQL app access is restricted to APP001 over TCP.
- [x] SQL001 encrypted backup and isolated restore validation succeeded.
- [x] Tenant admin/student API smoke passed with temporary accounts.
- [x] Control view API smoke passed with temporary operator.
- [x] Server and control API npm audits are clean.
- [x] Stripe lab secret check confirmed test-mode key material and configured webhook secret.
- [x] Existing validation scripts are identified:
  - `scripts\Invoke-LabSecurityGate.ps1`
  - `scripts\Invoke-HostedReleaseGate.ps1`
  - `scripts\Test-HostedSmoke.ps1`
  - `scripts\Test-HostedWorkflow.ps1`

## Working Rule For Future App Changes

App changes may continue on top of this baseline.

For each future change, rerun only the checks that match the affected area. Rerun the full lab security gate when a change touches auth, authorization, CORS, cookies, tenant isolation, student scoping, control auth, service configuration, database access, or reverse proxy behavior.

Docs-only changes do not require service redeploy or the lab security gate.

## Current Deploy Path References

The detailed staged deployment process remains in `RUNBOOKS/hosted-deployment.md`.

Current deploy paths captured there:

- APP001 tenant backend: `/home/debian/apps/home-school-management/server`
- APP001 tenant service: `hsm-api.service`
- APP001 control API: `/home/debian/apps/home-school-management/control-api`
- APP001 control service: `hsm-control-api.service`
- WEB001 tenant web assets: `/var/www/home-school-management/web`
- WEB001 Control Center assets: `/var/www/home-school-management/control`
- WEB001 Apache site: `home-school-management.conf`

Use this runbook to track readiness status. Use `RUNBOOKS/hosted-deployment.md` for the step-by-step deploy and recovery procedure until a more automated release path replaces it.

## Change Classes And Required Gates

### UI-only web changes

- Build or static-check the web change using the repo's current web workflow.
- Deploy web assets to WEB001 if the change is being promoted.
- Run `scripts\Test-HostedSmoke.ps1` or equivalent browser smoke after deploy.

### Tenant API changes

- Run syntax/tests appropriate to touched backend files.
- Apply any required PostgreSQL migration in lab before validation.
- Restart APP001 tenant API.
- Run `scripts\Invoke-LabSecurityGate.ps1` if auth, authorization, tenant data, student data, cookies, CORS, or security-sensitive responses changed.

### Control API changes

- Run syntax/tests appropriate to touched control files.
- Restart APP001 control API.
- Run `scripts\Invoke-LabSecurityGate.ps1` if operator auth, internal auth, control mutations, Stripe webhook handling, or control routing changed.

### Database changes

- Confirm migration is idempotent or has a documented rollback/repair path.
- Apply migration to lab PostgreSQL.
- Confirm affected tenant schemas when the migration touches tenant-owned tables.
- Run targeted app smoke plus `scripts\Invoke-LabSecurityGate.ps1` when auth, user, student, or tenant isolation tables are affected.

### Deployment, Apache, DNS, or TLS changes

- Record previous known-good commit/config before changing the host.
- Apply the change during a controlled window.
- Run `scripts\Invoke-HostedReleaseGate.ps1`.
- Run `scripts\Test-HostedWorkflow.ps1` when the change could affect broad user workflows.
- Review current service journals for unresolved startup/runtime failures.

## Non-Blocking Readiness Work

- [x] Document the exact current deploy path for APP001 backend changes.
- [x] Document the exact current deploy path for WEB001 web asset changes.
- [ ] Document the exact rollback command sequence for APP001 services.
- [ ] Document the exact rollback command sequence for WEB001 assets/Apache config.
- [ ] Record where operational secrets live and who can access them, without writing secret values into git.
- [ ] Decide the minimum monitoring/alerting baseline for APP001, WEB001, and SQL001.
- [ ] Decide the minimum disk, certificate, service, and database health checks.
- [ ] Resolve or explicitly defer apex `https://navigrader.com/` DNS routing.
- [ ] Plan production split of PostgreSQL least-privilege roles beyond the lab `appuser`.
- [ ] Plan replacement for in-memory rate limits when the app moves to distributed/public production.

## Launch-Time Items To Defer

- [ ] Final public production hostname and TLS cutover.
- [ ] Final live Stripe secret setup and live billing verification.
- [ ] Final production backup retention signoff.
- [ ] Final production restore test.
- [ ] Final AWS/public-hosting security controls.
- [ ] Final go/no-go cutover signoff.

## Release Evidence Template

Use this short record after meaningful app or infrastructure changes:

- Date:
- Change summary:
- Commit deployed:
- Hosts touched:
- Database migration applied:
- Validation run:
- Result:
- Rollback point:
- Follow-up risks:

## Exit Criteria

The lab-hosted setup is considered production-ready for continued iteration when:

- deployment and rollback paths are documented for APP001 and WEB001
- monitoring/alerting minimums are chosen
- operational secret locations are documented without exposing values
- current DNS/TLS decisions are recorded
- the relevant validation gates pass after each promoted change
