# Security Operational Hardening Checklist

Date: 2026-05-12
Owner: QA & Release Agent

## Scope

Use this before public SaaS launch and before any production AWS cutover.

Applies to:

- `WEB001` public web and Apache reverse proxy
- `APP001` tenant API and control API services
- `SQL001` PostgreSQL data tier
- production secrets, backups, monitoring, and incident response

## PostgreSQL Least Privilege

- [ ] Confirm PostgreSQL is reachable only on the private network.
- [ ] Confirm app services do not use a superuser, database owner, or role with `CREATEDB`, `CREATEROLE`, or `REPLICATION`.
- [ ] Create separate roles for tenant API runtime, control API runtime, backup, and restore validation.
- [ ] Grant tenant API only the privileges required on tenant schemas.
- [ ] Grant control API only the privileges required on the control schema and provisioning metadata.
- [ ] Confirm tenant runtime cannot read or write the control schema except through approved internal APIs.
- [ ] Confirm control API cannot mutate tenant data directly outside provisioning, lifecycle, and audited commercial workflows.
- [ ] Set `statement_timeout`, `idle_in_transaction_session_timeout`, and connection limits for service roles.
- [ ] Review `pg_hba.conf`; allow PostgreSQL only from APP001/control hosts and administrator maintenance hosts.
- [ ] Confirm PostgreSQL auth-failure and long-query logs are enabled and rotated.

## Encrypted Backup And Restore

- [ ] Define backup owner, restore-test owner, RPO, and RTO.
- [ ] Store backup encryption keys outside git and outside the database host.
- [ ] Run a production-like encrypted backup:

```bash
pg_dump --format=custom --no-owner --no-privileges --file=/secure-backups/appdb-YYYYMMDD.dump appdb
gpg --symmetric --cipher-algo AES256 /secure-backups/appdb-YYYYMMDD.dump
shred -u /secure-backups/appdb-YYYYMMDD.dump
```

- [ ] Restrict backup file permissions to the backup operator/service account.
- [ ] Restore the encrypted backup into an isolated validation database, never over production:

```bash
gpg --decrypt /secure-backups/appdb-YYYYMMDD.dump.gpg > /tmp/appdb-restore-test.dump
createdb appdb_restore_test
pg_restore --dbname=appdb_restore_test --no-owner --no-privileges /tmp/appdb-restore-test.dump
shred -u /tmp/appdb-restore-test.dump
```

- [ ] Validate restore health with schema counts, sample tenant login data, commercial subscription rows, and migration metadata.
- [ ] Document restore duration and any failed objects.
- [ ] Rotate or delete restore-test databases after validation.

## AWS / Network Security Groups

- [ ] `WEB001` inbound: `80/tcp` and `443/tcp` from internet; `22/tcp` only from trusted admin IP/VPN.
- [ ] `APP001` inbound: tenant API/control API ports only from WEB001 or approved internal operators; SSH only from trusted admin IP/VPN.
- [ ] `SQL001` inbound: `5432/tcp` only from APP001/control API hosts; SSH only from trusted admin IP/VPN.
- [ ] Deny public database access.
- [ ] Restrict broad outbound rules where practical; document required package, Stripe, mail, DNS, and OS update destinations.
- [ ] Require key-only SSH and disable root/password SSH login on every host.
- [ ] Confirm host firewalls match AWS security group intent.
- [ ] Tag every security group with owner, environment, and review date.

## Monitoring And Alerting

- [ ] Alert on tenant API/control API service restarts and unhealthy health checks.
- [ ] Alert on Apache 5xx spikes, failed login spikes, and unexpected 403/401 changes.
- [ ] Alert on Stripe webhook failures and provisioning job failures.
- [ ] Alert on database backup failure, restore-test failure, disk pressure, and certificate expiration.
- [ ] Confirm logs do not contain passwords, session tokens, Stripe secrets, internal auth secrets, or database URLs.

## Incident Response

- [ ] Name incident lead, technical lead, communications owner, and customer-contact owner.
- [ ] Preserve Apache, service journal, control audit, Stripe webhook, and PostgreSQL logs before rotation.
- [ ] Contain suspected credential exposure by rotating affected session, internal auth, DB, Stripe, and mail secrets.
- [ ] Contain suspected tenant data exposure by disabling impacted tenant runtime or access paths while preserving evidence.
- [ ] Record exact first-seen time, detection source, affected tenants, affected data classes, and containment time.
- [ ] Prepare customer notification language and legal review path before public launch.
- [ ] Run a tabletop exercise for credential compromise and suspected cross-tenant data exposure.

## Signoff

- [ ] PostgreSQL least-privilege review signed off.
- [ ] Encrypted backup and restore test signed off.
- [ ] AWS/security group review signed off.
- [ ] Monitoring and incident-response review signed off.
