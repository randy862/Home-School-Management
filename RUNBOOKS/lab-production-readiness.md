# Lab-Hosted Production Readiness Runbook

Date started: 2026-05-13
Current readiness baseline: latest pushed `saas-modern-redesign` head.

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

Current provisioning deployment notes:

- Tenant API runtime resolution is host-based on this shared SaaS lab host.
- Control-plane provisioning writes tenant runtime bundles under `/home/debian/apps/home-school-management/runtime-bundles`.
- `CONTROL_DEPLOY_APP_RUNTIME_ENV_ENABLED=false` prevents new tenant provisioning from overwriting the shared tenant API `.env.runtime`.
- The `hsm-control-api` service user has `/var/lib/hsm-control-api` as its locked-down SSH home for WEB001 deployment automation.

## Operational Secret Custody

Do not write secret values into git, runbooks, tickets, screenshots, or chat transcripts. Record locations, owners, and access paths only.

Current lab secret locations:

- APP001 tenant API:
  - `/home/debian/apps/home-school-management/server/.env.runtime`
  - `/etc/home-school-management/hsm-api.env`
  - Access: `root`, `hsm-api` through systemd, and named operators with `sudo`.
  - Contents: PostgreSQL runtime credentials, tenant runtime identifiers, and tenant API internal-auth values.
  - Required permissions: owner/group `root:hsm-api` or tighter equivalent, mode `0640` or tighter.
- APP001 control API:
  - `/etc/home-school-management/hsm-control-api.env`
  - Access: `root`, `hsm-control-api` through systemd, and named operators with `sudo`.
  - Contents: `CONTROL_PG*`, Stripe keys, Stripe webhook secret, Postmark token, control internal-auth values, public checkout URLs, and deployment automation settings.
  - Required permissions: owner/group `root:hsm-control-api` or tighter equivalent, mode `0640` or tighter.
- APP001 provisioning runtime bundles:
  - `/home/debian/apps/home-school-management/runtime-bundles/*.env`
  - Access: `root`, `hsm-control-api`, and named operators with `sudo`.
  - Contents: generated tenant runtime env material. Treat as sensitive even when `CONTROL_DEPLOY_APP_RUNTIME_ENV_ENABLED=false` prevents overwrite of the shared tenant API `.env.runtime`.
- APP001 deployment SSH material:
  - `/var/lib/hsm-control-api`
  - Access: `root`, `hsm-control-api`, and named operators with `sudo`.
  - Contents: deployment automation SSH state for WEB001.
- WEB001 TLS and Apache secrets:
  - `/etc/letsencrypt/`
  - Apache private key/certificate material managed by Certbot.
  - Access: `root` and named operators with `sudo`.
- SQL001 database and backup secrets:
  - PostgreSQL role passwords live in host env files or the operator-controlled secret store, never git.
  - Backup encryption passphrases live outside git with the named operator.
  - Access: `root`, `postgres`, backup operator context, and named operators with `sudo`.
- External provider secrets:
  - Stripe, Postmark, DNS/DDNS, and domain registrar credentials live in their provider dashboards or the operator-controlled secret store.
  - Access: named operator accounts only; require MFA before public production.

Custody rules:

- Rotate affected secrets when a host, operator, or provider account is no longer trusted.
- Treat rollback snapshots and backups containing env files as secret-bearing artifacts.
- After any env, rollback, TLS, backup, or SSH change, verify owner/group and mode before restarting services.
- Before public production, choose a durable off-host secret store and document recovery access without storing values in git.

## Apex DNS Decision

Decision: explicitly deferred for the lab-hosted readiness baseline.

Current DNS check on 2026-05-13:

- `navigrader.com` resolves to `3.33.251.168` and `15.197.225.128`.
- `www.navigrader.com` is a CNAME to `navigrader.ddns.net`, which is the current lab public path.

Current operating rule:

- Use `https://www.navigrader.com/` as the canonical commercial signup/control public entrypoint for the lab.
- Use tenant domains such as `https://<tenant>.navigrader.com/` for tenant apps.
- Do not treat `https://navigrader.com/` as production-ready until apex DNS is either mapped to the same public edge as `www` or redirected to `www` over HTTPS.

Before public production:

1. Pick one canonical policy: apex redirects to `www`, or apex and `www` both serve the same site.
2. Update DNS with the registrar/DNS provider.
3. Ensure TLS covers both `navigrader.com` and `www.navigrader.com`.
4. Update `PUBLIC_APP_BASE_URL`, `PUBLIC_SIGNUP_STATUS_BASE_URL`, checkout success/cancel URLs, CORS allowlists, and monitoring targets.
5. Run `scripts\Invoke-HostedReleaseGate.ps1` and a real browser checkout smoke.

## Production PostgreSQL Role Split Plan

The lab currently uses shared non-superuser role `appuser`. That is acceptable for the current lab baseline, but production should split runtime, control, provisioning, migration, and backup permissions.

The application already supports separate env vars for the first split:

- Tenant API runtime: `PGUSER`, `PGPASSWORD`.
- Control API runtime: `CONTROL_PGUSER`, `CONTROL_PGPASSWORD`.
- Tenant runtime bundles generated by the control plane: `CONTROL_TENANT_PGUSER`, `CONTROL_TENANT_PGPASSWORD`.

Target roles:

- `hsm_tenant_app`: used by `hsm-api.service`; DML-only access to tenant schemas plus required sequence access; no DDL and no control schema ownership.
- `hsm_control_app`: used by `hsm-control-api.service`; DML-only access to the control schema and required sequences; no tenant data access beyond metadata needed for tenant routing/provisioning.
- `hsm_provisioner`: used only for controlled provisioning jobs; can create tenant schemas, create tenant tables, apply tenant grants, and register tenant domains; not used for normal web requests.
- `hsm_migrator`: used only during controlled migration windows; can apply schema changes to control and tenant schemas; not used by long-running services.
- `hsm_backup`: used by SQL001 backup automation; read-only access required for backup; no application write privileges.
- `hsm_readonly_audit`: optional break-glass read-only role for support investigations; disabled or tightly controlled until needed.

Implementation sequence:

1. Inventory current `appuser` grants and confirm all active schemas: control schema, `public`, and tenant schemas.
2. Create the new roles on SQL001 with generated passwords stored only in host env files or the operator-controlled secret store.
3. Grant least privilege to the new roles while leaving `appuser` active as rollback.
4. Configure APP001 tenant API with `PGUSER=hsm_tenant_app` and its password.
5. Configure APP001 control API with `CONTROL_PGUSER=hsm_control_app`, `CONTROL_PGPASSWORD`, `CONTROL_TENANT_PGUSER=hsm_tenant_app`, and `CONTROL_TENANT_PGPASSWORD`.
6. Run tenant/control health checks, tenant login, control login, fresh subscription provisioning, and `scripts\Invoke-LabSecurityGate.ps1`.
7. Update SQL001 `pg_hba.conf` to allow only the split roles from APP001 over TCP.
8. After one stable validation window, remove or disable `appuser` application access.

Defer actual role creation until the next database maintenance window because it changes live database credentials and rollback paths.

## Distributed Rate Limit Replacement Plan

Decision: keep the current in-memory limiters for the single-process lab baseline, but replace them before distributed/public production with a shared counter store.

Current implementation:

- Tenant API and control API each use `createRateLimiter(...)` from their local `src/middleware/security.js`.
- Counters live in a process-local JavaScript `Map`.
- Keys are currently client IP, HTTP method, and path.
- Counters reset when the service restarts and are not shared across multiple API processes or hosts.

Current endpoint coverage:

- Tenant API:
  - `POST /api/auth/login`: 10 requests per 15 minutes.
  - `POST /api/setup/initialize`: 5 requests per hour.
- Control API:
  - `POST /api/operator/auth/login`: 10 requests per 15 minutes.
  - `POST /api/operator/setup/bootstrap`: 5 requests per hour.
  - `POST /api/public/checkout/session`: 20 requests per 15 minutes.
  - `POST /api/public/billing/webhook`: 120 requests per minute.

Production target:

- Use Redis, Valkey, or a managed Redis-compatible service as the shared rate-limit store.
- All tenant/control API instances must use the same store so counters survive service restarts and apply consistently across multiple app servers.
- Keep an application-level limiter even if an edge/WAF limiter is added later; edge limits catch broad floods, application limits understand auth, tenant, checkout, and setup context.

Required limiter dimensions:

- Client IP for anonymous public traffic.
- Username plus IP for tenant login and control operator login.
- Tenant host plus IP for tenant-scoped endpoints.
- Requested tenant label, account name, owner email, and IP for checkout session creation.
- Stripe webhook source IP/path plus signature verification result metrics for webhook abuse visibility.
- Setup token or setup target plus IP for setup flows.

Implementation sequence:

1. Add a small rate-limit store abstraction used by both `server/` and `control-api/`.
2. Support `RATE_LIMIT_STORE=memory` for lab/default local development and `RATE_LIMIT_STORE=redis` for production.
3. Add Redis connection settings through env files only, for example `RATE_LIMIT_REDIS_URL` or host/port/password variables.
4. Preserve the current endpoint limits as the first Redis-backed policy.
5. Add stricter failed-auth counters keyed by username plus IP for tenant and control login.
6. Add logging for limit hits without logging passwords, tokens, Stripe signatures, or secret values.
7. Add operational metrics or daily log review for repeated `429` responses by endpoint and source.
8. Validate with a two-process test: start two API instances against the same Redis store and confirm the combined request count hits one shared limit.
9. Keep the existing lab stress check as a regression gate, then add a distributed limiter smoke before public production.

Failure behavior:

- Auth, setup, and checkout endpoints should fail closed or return a short retry response if the shared limiter is unavailable.
- Stripe webhook limiting should avoid dropping valid Stripe delivery silently; if the limiter backend is unavailable, log loudly and rely on signature verification plus Stripe retry behavior.
- Any limiter-store outage in production should trigger an operator alert.

Defer implementation until a distributed/public production target is chosen. The current single-process lab can continue with the in-memory limiter as long as the risk remains documented.

## Rollback Snapshot Before A Promoted Change

Create a rollback snapshot before any promoted backend, control API, web asset, Apache, or systemd change.

When both APP001 and WEB001 are touched, use the same `ROLLBACK_ID` on both hosts. Keep the printed `ROLLBACK_ID` with the release evidence.

```sh
ROLLBACK_ID=$(date +%Y%m%d%H%M%S)
echo $ROLLBACK_ID
```

For an APP001 change:

```sh
sudo mkdir -p /home/debian/rollback/hsm/$ROLLBACK_ID/app001
sudo tar -C /home/debian/apps/home-school-management -czf /home/debian/rollback/hsm/$ROLLBACK_ID/app001/server.tgz server
sudo tar -C /home/debian/apps/home-school-management -czf /home/debian/rollback/hsm/$ROLLBACK_ID/app001/control-api.tgz control-api
sudo cp /home/debian/apps/home-school-management/server/.env.runtime /home/debian/rollback/hsm/$ROLLBACK_ID/app001/env.runtime
sudo cp /etc/systemd/system/hsm-api.service /home/debian/rollback/hsm/$ROLLBACK_ID/app001/hsm-api.service
sudo cp /etc/systemd/system/hsm-control-api.service /home/debian/rollback/hsm/$ROLLBACK_ID/app001/hsm-control-api.service
sudo chown -R root:root /home/debian/rollback/hsm/$ROLLBACK_ID
sudo chmod -R go-rwx /home/debian/rollback/hsm/$ROLLBACK_ID
```

For a WEB001 change:

```sh
sudo mkdir -p /home/debian/rollback/hsm/$ROLLBACK_ID/web001
sudo tar -C /var/www/home-school-management -czf /home/debian/rollback/hsm/$ROLLBACK_ID/web001/web.tgz web
sudo tar -C /var/www/home-school-management -czf /home/debian/rollback/hsm/$ROLLBACK_ID/web001/control.tgz control
sudo cp /etc/apache2/sites-available/home-school-management.conf /home/debian/rollback/hsm/$ROLLBACK_ID/web001/home-school-management.conf
sudo cp /etc/apache2/sites-available/home-school-management-le-ssl.conf /home/debian/rollback/hsm/$ROLLBACK_ID/web001/home-school-management-le-ssl.conf
sudo apachectl configtest
sudo chown -R root:root /home/debian/rollback/hsm/$ROLLBACK_ID
sudo chmod -R go-rwx /home/debian/rollback/hsm/$ROLLBACK_ID
```

## APP001 Rollback Commands

Use when a tenant API, control API, runtime bundle, or APP001 systemd deploy regresses.

Replace `<rollback-id>` with the saved `ROLLBACK_ID`.

```sh
cd /home/debian/apps/home-school-management
ROLLBACK_ID=<rollback-id>
FAILED_ID=$(date +%Y%m%d%H%M%S)

sudo systemctl stop hsm-api.service hsm-control-api.service
sudo mkdir -p /home/debian/rollback/hsm/$ROLLBACK_ID/app001/failed-$FAILED_ID
sudo mv server /home/debian/rollback/hsm/$ROLLBACK_ID/app001/failed-$FAILED_ID/server
sudo mv control-api /home/debian/rollback/hsm/$ROLLBACK_ID/app001/failed-$FAILED_ID/control-api

sudo tar -C /home/debian/apps/home-school-management -xzf /home/debian/rollback/hsm/$ROLLBACK_ID/app001/server.tgz
sudo tar -C /home/debian/apps/home-school-management -xzf /home/debian/rollback/hsm/$ROLLBACK_ID/app001/control-api.tgz
sudo cp /home/debian/rollback/hsm/$ROLLBACK_ID/app001/env.runtime /home/debian/apps/home-school-management/server/.env.runtime
sudo cp /home/debian/rollback/hsm/$ROLLBACK_ID/app001/hsm-api.service /etc/systemd/system/hsm-api.service
sudo cp /home/debian/rollback/hsm/$ROLLBACK_ID/app001/hsm-control-api.service /etc/systemd/system/hsm-control-api.service
sudo chown root:hsm-api /home/debian/apps/home-school-management/server/.env.runtime
sudo chmod 640 /home/debian/apps/home-school-management/server/.env.runtime

sudo systemctl daemon-reload
sudo systemctl restart hsm-api.service hsm-control-api.service
sudo systemctl is-active hsm-api.service
sudo systemctl is-active hsm-control-api.service
curl -s http://127.0.0.1:3000/health
curl -s http://127.0.0.1:3100/health
```

After APP001 rollback, run from the workstation:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Invoke-LabSecurityGate.ps1 `
  -TenantBaseUrl $env:LAB_TENANT_BASE_URL `
  -TenantAdminUsername $env:LAB_TENANT_ADMIN_USERNAME `
  -TenantAdminPassword $env:LAB_TENANT_ADMIN_PASSWORD `
  -TenantStudentUsername $env:LAB_TENANT_STUDENT_USERNAME `
  -TenantStudentPassword $env:LAB_TENANT_STUDENT_PASSWORD `
  -ControlBaseUrl $env:LAB_CONTROL_BASE_URL `
  -ControlUsername $env:LAB_CONTROL_USERNAME `
  -ControlPassword $env:LAB_CONTROL_PASSWORD `
  -RejectedOrigin $env:LAB_REJECTED_ORIGIN `
  -AllowInsecureTls
```

## WEB001 Rollback Commands

Use when a web asset, Control Center asset, Apache config, DNS, or TLS deploy regresses.

Replace `<rollback-id>` with the saved `ROLLBACK_ID`.

```sh
ROLLBACK_ID=<rollback-id>
FAILED_ID=$(date +%Y%m%d%H%M%S)

sudo mkdir -p /home/debian/rollback/hsm/$ROLLBACK_ID/web001/failed-$FAILED_ID
sudo mv /var/www/home-school-management/web /home/debian/rollback/hsm/$ROLLBACK_ID/web001/failed-$FAILED_ID/web
sudo mv /var/www/home-school-management/control /home/debian/rollback/hsm/$ROLLBACK_ID/web001/failed-$FAILED_ID/control

sudo tar -C /var/www/home-school-management -xzf /home/debian/rollback/hsm/$ROLLBACK_ID/web001/web.tgz
sudo tar -C /var/www/home-school-management -xzf /home/debian/rollback/hsm/$ROLLBACK_ID/web001/control.tgz
sudo cp /home/debian/rollback/hsm/$ROLLBACK_ID/web001/home-school-management.conf /etc/apache2/sites-available/home-school-management.conf
sudo cp /home/debian/rollback/hsm/$ROLLBACK_ID/web001/home-school-management-le-ssl.conf /etc/apache2/sites-available/home-school-management-le-ssl.conf

sudo apachectl configtest
sudo systemctl reload apache2
sudo systemctl is-active apache2
curl -k -s https://127.0.0.1/health -H 'Host: mitchell.navigrader.com'
curl -k -s https://127.0.0.1/control-api/health -H 'Host: mitchell.navigrader.com'
```

After WEB001 rollback, run from the workstation:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Invoke-LabSecurityGate.ps1 `
  -TenantBaseUrl $env:LAB_TENANT_BASE_URL `
  -TenantAdminUsername $env:LAB_TENANT_ADMIN_USERNAME `
  -TenantAdminPassword $env:LAB_TENANT_ADMIN_PASSWORD `
  -TenantStudentUsername $env:LAB_TENANT_STUDENT_USERNAME `
  -TenantStudentPassword $env:LAB_TENANT_STUDENT_PASSWORD `
  -ControlBaseUrl $env:LAB_CONTROL_BASE_URL `
  -ControlUsername $env:LAB_CONTROL_USERNAME `
  -ControlPassword $env:LAB_CONTROL_PASSWORD `
  -RejectedOrigin $env:LAB_REJECTED_ORIGIN `
  -AllowInsecureTls
```

## Minimum Monitoring And Alerting Baseline

This is the chosen minimum baseline for the lab-hosted production path. Manual checks are acceptable in the lab, but these same checks must be automated before a public production launch.

### Availability

- Check every 5 minutes:
  - `https://mitchell.navigrader.com/health`
  - `https://pj-cool.navigrader.com/health`
  - `https://192.168.1.210/control-api/health`
- Warning: one failed check.
- Critical: two consecutive failed checks or any public `5xx`.

### APP001

- Check every 5 minutes:
  - `systemctl is-active hsm-api.service`
  - `systemctl is-active hsm-control-api.service`
  - `curl -s http://127.0.0.1:3000/health`
  - `curl -s http://127.0.0.1:3100/health`
- Critical: either service inactive, restart-looping, or local health fails twice.
- Review daily until automated:
  - `sudo journalctl -u hsm-api.service -u hsm-control-api.service --since today --no-pager`

### WEB001

- Check every 5 minutes:
  - `systemctl is-active apache2`
  - public tenant health through Apache.
- Warning: Apache reload/config drift or TLS certificate expires within 14 days.
- Critical: Apache inactive, config test fails, public health fails twice, or TLS certificate expires within 7 days.
- Review daily until automated:
  - Apache error logs for current `5xx`, proxy, certificate, or permission failures.

### SQL001

- Check every 5 minutes:
  - `systemctl is-active postgresql`
  - `pg_isready -h 127.0.0.1 -p 5432`
- Warning: backup age exceeds 24 hours, disk exceeds 80%, or connection failures begin.
- Critical: PostgreSQL inactive, `pg_isready` fails twice, backup age exceeds 48 hours, or disk exceeds 90%.
- Restore validation: perform at least monthly and before any real production cutover.

### Cross-Host

- Warning: root filesystem exceeds 80% on APP001, WEB001, or SQL001.
- Critical: root filesystem exceeds 90% on any host.
- Warning: `npm audit --omit=dev` finds moderate issues in `server/` or `control-api/`.
- Critical: `npm audit --omit=dev` finds high or critical issues.
- Alert destination for the lab: operator-visible terminal/email is acceptable.
- Alert destination before public production: automated email or SMS/push to the named operator.

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
- [x] Document the exact rollback command sequence for APP001 services.
- [x] Document the exact rollback command sequence for WEB001 assets/Apache config.
- [x] Record where operational secrets live and who can access them, without writing secret values into git.
- [x] Decide the minimum monitoring/alerting baseline for APP001, WEB001, and SQL001.
- [x] Decide the minimum disk, certificate, service, and database health checks.
- [x] Resolve or explicitly defer apex `https://navigrader.com/` DNS routing.
- [x] Plan production split of PostgreSQL least-privilege roles beyond the lab `appuser`.
- [x] Plan replacement for in-memory rate limits when the app moves to distributed/public production.

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
