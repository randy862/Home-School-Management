# Lab-Hosted Production Readiness Runbook

Date started: 2026-05-13
Current readiness baseline commit: `19f4162`

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
- [ ] Record where operational secrets live and who can access them, without writing secret values into git.
- [x] Decide the minimum monitoring/alerting baseline for APP001, WEB001, and SQL001.
- [x] Decide the minimum disk, certificate, service, and database health checks.
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
