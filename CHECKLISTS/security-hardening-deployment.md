# Security Hardening Deployment Checklist

Date: 2026-05-12
Owner: QA & Release Agent

## Scope

Use this checklist before deploying the current security hardening baseline.

Applies to:

- `APP001` tenant API and control API services
- `WEB001` Apache reverse proxy
- `SQL001` PostgreSQL access assumptions

## APP001 Prerequisites

- [ ] Create dedicated service users:

```bash
sudo useradd --system --home /var/lib/hsm-api --create-home --shell /usr/sbin/nologin hsm-api || true
sudo useradd --system --home /var/lib/hsm-control-api --create-home --shell /usr/sbin/nologin hsm-control-api || true
```

- [ ] Create the external secret directory:

```bash
sudo install -d -m 0700 -o root -g root /etc/home-school-management
```

- [ ] Create `/etc/home-school-management/hsm-api.env` with production values:

```text
PGUSER=...
PGPASSWORD=...
PGSSLMODE=disable
CONTROL_PLANE_INTERNAL_AUTH_SECRET=...
```

- [ ] Create `/etc/home-school-management/hsm-control-api.env` with production values:

```text
CONTROL_PGUSER=...
CONTROL_PGPASSWORD=...
CONTROL_PGSSLMODE=disable
CONTROL_INTERNAL_AUTH_SECRET=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PUBLISHABLE_KEY=...
CONTROL_MAIL_POSTMARK_SERVER_TOKEN=...
```

- [ ] Lock down the secret files:

```bash
sudo chown root:root /etc/home-school-management/hsm-api.env /etc/home-school-management/hsm-control-api.env
sudo chmod 0600 /etc/home-school-management/hsm-api.env /etc/home-school-management/hsm-control-api.env
```

- [ ] Confirm `hsm-control-api` can read required app files and write runtime bundles.
- [ ] If deployment automation stays enabled, configure `hsm-control-api` SSH access to `WEB001` and any remote app target.
- [ ] Preload `known_hosts` for deployment targets; do not rely on interactive SSH prompts.
- [ ] Confirm `CONTROL_DEPLOY_LOCAL_HOSTS` and `CONTROL_HOST_ALIASES` still match APP001/WEB001/SQL001.

## WEB001 Prerequisites

- [ ] Confirm Apache modules are enabled:

```bash
sudo a2enmod ssl headers proxy proxy_http rewrite
```

- [ ] Confirm certificates exist for the configured names:

```bash
sudo test -f /etc/letsencrypt/live/www.navigrader.com/fullchain.pem
sudo test -f /etc/letsencrypt/live/www.navigrader.com/privkey.pem
```

- [ ] Validate Apache syntax before reload:

```bash
sudo apachectl configtest
```

- [ ] Verify HTTP redirects preserve tenant subdomains.
- [ ] Verify `https://www.navigrader.com/` serves `/saas.html`.
- [ ] Verify tenant subdomains still serve the hosted workspace login.

## SQL001 Prerequisites

- [ ] Confirm PostgreSQL is not publicly exposed.
- [ ] Confirm `pg_hba.conf` allows only expected APP001/control connections.
- [ ] Confirm tenant API and control API use non-superuser DB roles.
- [ ] Confirm backup encryption and restore-test owner are known before cutover.
- [ ] Complete `CHECKLISTS/security-operational-hardening.md` for PostgreSQL roles, encrypted backup/restore, AWS security groups, monitoring, and incident response.

## Post-Deploy Validation

- [ ] `scripts\Invoke-HostedReleaseGate.ps1`
- [ ] `scripts\Test-HostedWorkflow.ps1` when broad workflow validation is required
- [ ] Tenant login sets `Secure`, `HttpOnly`, and expected `SameSite` cookie attributes.
- [ ] Operator login sets `Secure`, `HttpOnly`, and expected `SameSite` cookie attributes.
- [ ] Cross-origin requests from an unlisted origin are rejected.
- [ ] Login throttling returns `429` after repeated failed attempts.
- [ ] Stripe webhook signature validation still rejects unsigned payloads.
- [ ] Student users cannot read another student's account, instructor, records, curriculum, schedule-block, or plan data.
- [ ] Non-admin tenant users receive `403` for tenant admin writes.
- [ ] Under-permissioned control operators receive `403` for tenant, environment, job retry, operator, and commercial mutations.
- [ ] Apache response headers include HSTS, nosniff, referrer policy, permissions policy, and frame protection.
- [ ] Current service journals show no unresolved startup, permission, or module errors.

## Rollback Trigger

Roll back immediately if tenant login, operator login, checkout creation, webhook processing, or hosted release gate validation fails after reasonable immediate correction attempts.
