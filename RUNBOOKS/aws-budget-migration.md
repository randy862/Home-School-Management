# AWS Budget Migration Plan

## Purpose

This runbook documents the first proof-of-concept AWS move for Navigrader.

The goal is not to build the final ideal cloud architecture on day one. The goal is to move the current working lab design into AWS with the lowest practical monthly cost while preserving the same mental model:

- `WEB001` serves public web traffic and proxies API requests
- `APP001` runs the tenant API and control API
- `SQL001` runs PostgreSQL
- `MAINT001` is a small maintenance/jumpbox/Codex-capable Linux node

This is the launch-validation architecture. It is intended to prove whether the business can attract subscribers and revenue before moving to a more managed, higher-cost AWS design.

## Current AWS Build State

Last updated: 2026-05-28

Region:

- `us-east-2`

Account:

- AWS account ID appears in resource names as `016365604963`

Network:

- VPC: `navigrader-prod-vpc`
- VPC CIDR: `10.40.0.0/16`
- public subnet: `10.40.0.0/20`
- private subnet: `10.40.128.0/20`
- Internet Gateway: attached to `navigrader-prod-vpc`
- S3 Gateway VPC Endpoint: active for private S3 backup traffic
- NAT Gateway: no active NAT Gateway; temporary validation gateway `navigrader-temp-private-egress` was deleted after reset/login smoke validation

Servers:

| Server | State | Network | Notes |
| --- | --- | --- | --- |
| `MAINT001` | created and updated | public subnet | SSH jumpbox/admin host, public SSH restricted by security group. |
| `WEB001` | created and updated | public subnet | Elastic IP associated, Apache installed, static web/admin assets deployed, public HTTP verified. |
| `APP001` | created and updated | private subnet | Private IP `10.40.131.149`, Node/npm installed, app source staged, `navigrader` service user/directories created. |
| `SQL001` | created and updated | private subnet | Private IP `10.40.138.78`, PostgreSQL 17 installed, `appdb` and `navigrader_app` created, APP001 database login verified. |
| `TEMP-NAT` | terminated after bootstrap | public subnet | Used to install private server packages; private subnet `0.0.0.0/0` route was removed after bootstrap. Recreate only for future private update/download windows. |
| `navigrader-temp-private-egress` | deleted after validation | public subnet | Created for AWS validation mail delivery from private APP001; deleted after validation and temporary Elastic IP was released. |

Security posture:

- `WEB001` accepts public `80/443`.
- `MAINT001` accepts SSH from the administrator's current public IP.
- `APP001` has no public IP.
- `SQL001` has no public IP.
- PostgreSQL access is private only.
- `APP001` can connect to `SQL001:5432`.
- `WEB001` will later proxy API traffic to `APP001:3000` and `APP001:3100`.

Backup posture:

- S3 backup bucket: `navigrader-prod-backups-016365604963-us-east-2-an`
- `SQL001` IAM role: `navigrader-prod-sql001-backup-role`
- S3 write/list under `postgres/` verified from `SQL001` using the IAM role, with no access keys stored on the server.
- Logical `pg_dump` backup to S3 is configured and restore-tested once.
- pgBackRest WAL/PITR backup to S3 is configured and first full backup completed.
- Manual initial EBS snapshots are complete for `MAINT001`, `WEB001`, `APP001`, and `SQL001`.
- Data Lifecycle Manager policy `SQL001` / `navigrader-sql001-ebs-snapshots` is enabled for volumes tagged `BackupPlan=navigrader-sql-daily`.
- Data Lifecycle Manager policy `Core-Weekly` / `navigrader-core-weekly-ebs-snapshots` is enabled for volumes tagged `BackupPlan=navigrader-core-weekly`.

Deployment posture:

- `APP001` has tracked `server/`, `control-api/`, and systemd template files staged under `/home/debian/apps/home-school-management/`.
- `APP001` has system users `hsm-api` and `hsm-control-api`, and `server/` plus `control-api/` production dependencies are installed.
- `APP001` runtime env files are installed, PostgreSQL app password was rotated, tenant/control migrations completed, and `hsm-api.service` plus `hsm-control-api.service` are active.
- `WEB001` has tracked `web/` and `admin/` static assets deployed under `/var/www/home-school-management/`.
- `WEB001` Apache site `navigrader-aws-http.conf` proxies API paths to `APP001` at `10.40.131.149`.
- AWS `WEB001` public HTTP was verified at `http://18.188.35.157/`, `/terms/`, `/control/`, `/health`, and `/control-api/health`.
- The temporary bootstrap private route was removed after dependency installation.
- A temporary NAT Gateway route was added for validation mail delivery, then removed after validation: private route table `rtb-01e7fa93185f5ddf` should no longer route `0.0.0.0/0` to NAT.
- AWS validation tenant host `aws-validation.navigrader.com` maps to tenant `tenant-aws-validation`, environment `env-aws-validation-production`, and schema `tenant_aws_validation`.
- Host-header validation through `WEB001` returns tenant setup status and runtime resolution for `aws-validation.navigrader.com`.
- AWS APP001/WEB001 were updated from branch `saas-modern-redesign` at `cb7b057`; AWS WEB001 still needs later web assets, including the `Schedule Items Open` gauge, Grade Search `Course/Class/Block` filter, and dropdown clipping hotfix, before go-live validation.
- AWS SQL001 migration `032_password_reset_tokens.sql` was applied to `public` and `tenant_aws_validation`.
- AWS rollback bundle root for this deploy: `/home/admin/rollback/hsm/aws-cb7b057-202605272003/`.
- AWS tenant API/control API runtime mail values are configured for `http://aws-validation.navigrader.com` with Postmark `allowlist_only`.
- AWS validation tenant is initialized with admin `awsadmin`.
- DNS for `aws-validation.navigrader.com` now points to AWS `18.188.35.157`; the temporary local Windows hosts override was removed after normal DNS resolved correctly.
- AWS APP001 CORS was updated to allow `http://aws-validation.navigrader.com`; rollback env backup: `/home/admin/rollback/hsm/aws-validation-cors-202605280150/app001/hsm-api.env.before`.
- AWS validation password reset email delivery and reset-complete were validated successfully for `awsadmin`.

Completed pause/cost-control actions:

- temporary private subnet route `0.0.0.0/0 -> TEMP-NAT ENI` removed
- `TEMP-NAT` terminated
- servers were stopped for cost control while pausing AWS buildout, then restarted for validation on 2026-05-27

Immediate resume point:

1. If EC2 instances were stopped for cost control, restart the needed AWS hosts.
2. Deploy AWS WEB001 web assets from the latest `saas-modern-redesign` branch so the `Schedule Items Open` gauge and Grade Search `Course/Class/Block` filter/dropdown hotfix are present.
3. Smoke login, Attendance Search, School Day Scheduled Item filtering, Grade Search `Course/Class/Block` filtering, Open Items Today gauge, and Past Due Schedule Items gauge.
4. After the next scheduled DLM window, verify automated snapshots appear for both enabled lifecycle policies.
5. Continue DNS/TLS planning.

## AWS Audit And Journaling Reality

AWS records many control-plane actions automatically through CloudTrail Event history. This includes actions such as launching EC2 instances, changing route tables, creating buckets, attaching IAM roles, and changing security groups. Event history is useful for recent review, but it is not a complete long-term audit archive by itself.

Current audit coverage:

- AWS CloudTrail Event history should show recent AWS management events.
- AWS IAM role assumption is visible for `SQL001` S3 access.
- S3 bucket-level management activity is visible as management events.
- The repository `HANDOFF.md`, `STATUS.md`, and this runbook record the operational build decisions.

Not yet configured:

- Long-term CloudTrail trail delivery to S3.
- AWS Config resource inventory/history.
- CloudWatch Agent log shipping from EC2.
- S3 data-event logging for individual backup object reads/writes.
- Centralized OS command/session recording.

Important limits:

- AWS does not automatically journal every shell command run over SSH.
- PostgreSQL config edits and package installs are visible on the instance through shell history, package logs, system logs, and this runbook, but they are not all CloudTrail events.
- CloudTrail Event history is a recent activity tool; create a trail if long-term audit retention is required.

Recommended before full production:

1. Create an account-level CloudTrail trail for management events delivered to S3.
2. Enable AWS Config for EC2, VPC, IAM, S3, and security group resources if budget allows.
3. Install CloudWatch Agent on `WEB001`, `APP001`, and `SQL001` with short retention.
4. Add explicit backup success/failure monitoring.
5. Keep this runbook and `HANDOFF.md` current after each infrastructure session.

## Target Starting Shape

```text
Internet
  |
  | HTTPS
  v
AWS WEB001 - Debian EC2, Apache, TLS, static assets, reverse proxy
  |
  | private network traffic
  v
AWS APP001 - Debian EC2, Node.js tenant API and control API
  |
  | private PostgreSQL traffic
  v
AWS SQL001 - Debian EC2, PostgreSQL

MAINT001 - Debian EC2 maintenance/jumpbox/Codex node

TEMP-NAT - short-lived public EC2 NAT instance for update/download windows only
```

## Server Roles

### WEB001

Recommended starting role:

- public-facing Debian Linux EC2 instance
- Apache virtual host
- TLS certificate management
- static tenant app assets
- public SaaS pages
- legal pages
- Control Center static assets
- reverse proxy for:
  - `/api/` to `APP001:3000`
  - `/health` to `APP001:3000/health`
  - `/control-api/` to `APP001:3100`

This mirrors current lab `WEB001`.

### APP001

Recommended starting role:

- private Debian Linux EC2 instance
- Node.js tenant app API on port `3000`
- Node.js control API on port `3100`
- systemd services:
  - `hsm-api.service`
  - `hsm-control-api.service`
- runtime environment files and secrets
- provisioning/runtime automation that currently assumes known hosts and SSH paths

This mirrors current lab `APP001`.

### SQL001

Recommended starting role:

- private Debian Linux EC2 instance
- PostgreSQL
- `appdb`
- tenant schemas
- control-plane schema
- database backups/snapshots

This mirrors current lab `SQL001`.

This is cheaper than managed RDS at launch, but it makes database patching, backup verification, restore drills, monitoring, and storage planning your responsibility.

### MAINT001

Recommended starting role:

- small Debian Linux EC2 instance
- administration jumpbox
- Git checkout / release tools
- AWS CLI
- PostgreSQL client tools
- smoke/release scripts
- optional Codex CLI environment

This avoids needing a more expensive Windows jumpbox. Codex can also remain local on the laptop over secure connectivity if that is more comfortable.

### TEMP-NAT

Recommended starting role:

- temporary Debian Linux EC2 instance in the public subnet
- used only during patch, package install, and component download windows
- provides outbound internet access for private servers without paying for an always-on NAT Gateway
- stopped or terminated after the maintenance window

Private servers such as `APP001` and `SQL001` should normally have no general outbound internet route. They can still use an S3 Gateway VPC Endpoint for backup traffic without a NAT Gateway.

## Suggested Low-Cost EC2 Sizing

Starting point for proof of concept:

| Server | Suggested Class | Notes |
| --- | --- | --- |
| `WEB001` | `t4g.nano` or `t4g.micro` | Apache/static/proxy workload should be light. |
| `APP001` | `t4g.micro` or `t4g.small` | Start micro if traffic is very low; small gives safer memory headroom for Node services. |
| `SQL001` | `t4g.micro` or `t4g.small` | Start small if budget permits; PostgreSQL benefits from memory. |
| `MAINT001` | `t4g.nano` or stopped `t4g.micro` | Run only when needed if cost pressure is high. |

Architecture preference:

- public subnet: `WEB001`
- public subnet: `MAINT001`
- public subnet during maintenance only: `TEMP-NAT`
- private subnet: `APP001`, `SQL001`
- security groups should allow only required traffic
- `SQL001` should never be internet-facing

If using ARM-based `t4g` instances, confirm all required packages and Node.js runtime are available for Debian ARM64. If not, use comparable `t3`/`t4` x86 instances at slightly higher cost.

## Network Model

Minimum security group intent:

| Source | Destination | Ports | Purpose |
| --- | --- | --- | --- |
| Internet | `WEB001` | `80`, `443` | Public web traffic and TLS renewal |
| Your IP or VPN | `MAINT001` | `22` | Administrative SSH |
| `MAINT001` | `WEB001` | `22` | Deploy web assets and inspect Apache |
| `MAINT001` | `APP001` | `22` | Deploy backend/control API and inspect services |
| `MAINT001` | `SQL001` | `22`, `5432` | Admin and database maintenance |
| `WEB001` | `APP001` | `3000`, `3100` | Tenant API and control API proxy |
| `APP001` | `SQL001` | `5432` | Application database access |

Avoid direct public SSH to every server if possible. Prefer one controlled administrative path through `MAINT001` or a VPN.

## Private Server Egress Model

Budget launch should avoid an always-on NAT Gateway.

Normal operating state:

- `WEB001` has public internet access for customer traffic, TLS renewal, and Apache updates
- `MAINT001` has public SSH access restricted to the administrator's current public IP
- `APP001` and `SQL001` are private-only
- S3 backup traffic uses an S3 Gateway VPC Endpoint
- no default `0.0.0.0/0` internet route exists from private subnets

Maintenance/update state:

1. Start or launch `TEMP-NAT` in the public subnet.
2. Disable source/destination check on `TEMP-NAT`.
3. Enable IPv4 forwarding and NAT masquerading on `TEMP-NAT`.
4. Temporarily add a private subnet route:
   - destination: `0.0.0.0/0`
   - target: `TEMP-NAT` instance or network interface
5. Run package updates and component downloads on `APP001` and `SQL001`.
6. Remove the temporary private subnet default route.
7. Stop or terminate `TEMP-NAT`.

Use this path for Debian updates, Node.js installation, npm dependency downloads, PostgreSQL package updates, pgBackRest installation, AWS CLI installation, and other one-time bootstrap downloads.

## Migration Phases

### Phase 1: AWS Foundation

Create:

- VPC
- public and private subnets
- internet gateway
- route tables
- S3 Gateway VPC Endpoint for backup traffic without NAT Gateway charges
- security groups
- EC2 instances:
  - `WEB001`
  - `APP001`
  - `SQL001`
  - `MAINT001`
- temporary NAT instance pattern:
  - launch/start `TEMP-NAT` only during update/download windows
  - route private subnet outbound traffic through it only during maintenance
  - stop/terminate it after use
- EBS volumes sized for each server
- Elastic IP or DNS target for `WEB001`

Initial goal:

- all four servers can be reached through the intended admin path
- `WEB001` can reach `APP001`
- `APP001` can reach `SQL001`
- `MAINT001` can administer all hosts
- private servers can temporarily reach package repositories through `TEMP-NAT`
- S3 backup paths work through the S3 Gateway VPC Endpoint

### Phase 2: Base Server Build

On each Debian server:

- start `TEMP-NAT` and add the temporary private subnet egress route when private servers need updates or downloads
- apply operating system updates
- create service users
- configure SSH
- configure host firewalls where used
- set hostnames
- install common tools
- remove the temporary egress route and stop/terminate `TEMP-NAT` after updates and downloads finish

On `WEB001`:

- install Apache
- enable required Apache modules:
  - `ssl`
  - `headers`
  - `proxy`
  - `proxy_http`
  - `rewrite`
- deploy the Apache site config based on the current production SSL template

On `APP001`:

- install Node.js
- install app dependencies
- deploy tenant API and control API code
- configure systemd services
- configure runtime environment files

On `SQL001`:

- install PostgreSQL
- configure database users
- create `appdb`
- restore or migrate current schemas/data
- configure database backups

On `MAINT001`:

- install Git
- install AWS CLI
- install PostgreSQL client tools
- install PowerShell if desired for existing release scripts
- install Codex tooling if using this as the Codex node

### Phase 3: Database Migration

Recommended first approach:

1. Take a fresh PostgreSQL dump from current `SQL001`.
2. Restore it to AWS `SQL001`.
3. Verify:
   - control schema exists
   - tenant schemas exist
   - users/roles are correct
   - migrations are current
4. Point AWS `APP001` runtime config to AWS `SQL001`.
5. Start services and validate health.

Do not cut public DNS over until the AWS database restore has been tested.

### Phase 4: App and Web Deployment

On `APP001`:

- deploy `/server`
- deploy `/control-api`
- configure:
  - tenant app environment
  - control API environment
  - session secrets
  - Stripe secrets
  - Postmark/mail settings
  - PostgreSQL connection settings
  - runtime tenant schema settings
- start:
  - `hsm-api.service`
  - `hsm-control-api.service`

On `WEB001`:

- deploy `/web`
- deploy `/admin` to the control path
- configure Apache reverse proxy to AWS `APP001`
- configure TLS certificate
- confirm:
  - `/health`
  - `/terms`
  - `/privacy`
  - `/control/`
  - `/control-api/health`

### Phase 5: DNS and TLS

Plan DNS cutover carefully:

- lower DNS TTL before cutover
- issue or validate TLS certificate for Navigrader hostnames
- point selected proof-of-concept hostname to AWS `WEB001`
- validate public HTTPS from outside AWS
- keep rollback path to lab available until AWS validation passes

Preferred initial strategy:

- use a temporary AWS validation hostname first
- only move real customer-facing DNS after release gates pass

### Phase 6: Validation

Run release checks against the AWS public base URL:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Invoke-HostedReleaseGate.ps1 `
  -PublicBaseUrl https://<aws-validation-hostname>
```

Also validate:

- tenant admin login
- smoke tenant login
- account/profile opens
- dashboard opens
- school day opens
- attendance/grade read paths work
- control center operator login works
- Stripe webhook endpoint is reachable
- signup status page loads
- data export status page loads

For broader confidence, run hosted workflow validation if the AWS environment has safe smoke data.

### Phase 7: Cutover

Cutover only when:

- AWS release gate passes
- control plane health passes
- database restore is verified
- current lab rollback path is known
- DNS rollback plan is known
- Stripe webhook endpoint has been updated/tested
- email sending mode is confirmed

### Phase 8: Commercial Production Hardening

Before accepting real paid customers on AWS, complete these production gates:

1. Secrets and environment files
   - Store runtime secrets only on servers or in a managed secret store.
   - Do not commit database passwords, session secrets, Stripe secrets, Postmark secrets, smoke credentials, or private keys.
   - Rotate any credential that was exposed during setup or chat.

2. Database and migrations
   - Restore current production data into AWS `SQL001`.
   - Apply all required migrations.
   - Verify tenant schemas and control schema.
   - Run read-only smoke checks first.
   - Take a pre-cutover pgBackRest backup and logical dump.

3. Application services
   - Deploy tenant API and control API to `APP001`.
   - Create systemd services for both APIs.
   - Confirm services restart cleanly after reboot.
   - Confirm logs are readable without exposing secrets.

4. Web layer
   - Deploy public SaaS pages, tenant app assets, legal pages, and Control Center assets to `WEB001`.
   - Configure Apache virtual hosts.
   - Configure reverse proxy to `APP001`.
   - Add TLS certificates after DNS validation hostname is ready.

5. Payments and email
   - Configure Stripe live/test mode intentionally.
   - Update Stripe webhook endpoint to the AWS hostname only after AWS validation passes.
   - Configure Postmark or mail provider settings outside the repo.
   - Run safe test events before live traffic.

6. Backup and disaster recovery
   - Confirm logical backup cron uploads to S3.
   - Confirm pgBackRest full/differential backups run on schedule.
   - Confirm WAL archiving remains healthy.
   - Confirm DLM-created EBS snapshots appear for `SQL001`, `APP001`, `WEB001`, and `MAINT001`.
   - Complete one pgBackRest restore drill to a separate recovery database/server.

7. Monitoring
   - Add health checks for public `/health`.
   - Add disk usage checks for `SQL001`.
   - Add backup failure alerts.
   - Add SSL expiration reminder or monitoring.
   - Add basic EC2 status alarms.

8. Security
   - Confirm no public PostgreSQL access.
   - Confirm private subnet has no normal `0.0.0.0/0` route.
   - Confirm `TEMP-NAT` is terminated when not in use.
   - Confirm SSH is limited to the admin IP or a better VPN/bastion path.
   - Confirm AWS root MFA and non-root admin access remain in place.

9. Release validation
   - Run hosted release gate against AWS validation hostname.
   - Run tenant login smoke.
   - Run Control Center smoke.
   - Run dashboard load check.
   - Run legal page check.
   - Validate export/status pages.

10. Cutover readiness
    - Lower DNS TTL before cutover.
    - Freeze writes or schedule a maintenance window.
    - Take final database backup.
    - Restore/apply final data if needed.
    - Flip DNS.
    - Run production smoke immediately after DNS resolves.
    - Keep old lab rollback path available until AWS stability is proven.

### Phase 9: Post-Go-Live Stabilization

For the first 24-72 hours after production cutover:

- avoid unrelated feature releases
- watch application logs
- watch PostgreSQL logs
- watch disk usage
- verify scheduled backups are running
- verify WAL files are reaching S3
- keep rollback information available
- record incidents and fixes in `HANDOFF.md`/`STATUS.md`

Do not decommission the previous environment until AWS has passed a full business cycle of validation and backups have been restore-tested.

## Backup Strategy For Budget Launch

Because this plan runs PostgreSQL on EC2, backups must be explicit.

Minimum starting backup model:

- nightly `pg_dump` from `SQL001`
- encrypted backup artifact
- stored off the instance, preferably S3
- regular EBS snapshots for `SQL001`
- documented restore test

Do not rely only on the live EBS volume. A deleted/corrupt database on the instance is not a backup.

Better budget model:

- nightly logical PostgreSQL dump to S3
- EBS snapshots for the SQL volume
- lifecycle retention policy
- monthly restore drill to a temporary database/server

Implemented starting model:

- S3 bucket: `navigrader-prod-backups-016365604963-us-east-2-an`
- SQL001 IAM role: `navigrader-prod-sql001-backup-role`
- logical backup script: `/usr/local/sbin/navigrader-pg-dump-backup.sh`
- logical backup S3 path: `postgres/logical/`
- logical backup schedule: daily at `07:15 UTC`
- logical restore test: completed once into a temporary database
- WAL/PITR tool: pgBackRest 2.55.1
- pgBackRest config: `/etc/pgbackrest.conf`
- pgBackRest stanza: `main`
- pgBackRest S3 path: `postgres/pgbackrest/`
- PostgreSQL WAL archive command: `pgbackrest --stanza=main archive-push %p`
- pgBackRest validation: `pgbackrest check` completed successfully
- first full physical backup: `20260526-002743F`
- pgBackRest schedule:
  - weekly full backup Sunday at `06:30 UTC`
  - differential backup Monday-Saturday at `06:30 UTC`
- initial manual EBS snapshots: completed for `MAINT001`, `WEB001`, `APP001`, and `SQL001`
- EBS snapshot policy `SQL001`: targets `BackupPlan=navigrader-sql-daily`, enabled
- EBS snapshot policy `Core-Weekly`: targets `BackupPlan=navigrader-core-weekly`, enabled

Future managed model:

- replace self-managed `SQL001` with Amazon RDS for PostgreSQL
- use automated backups, point-in-time recovery, maintenance windows, monitoring, and managed patching

## Logging and Monitoring For Budget Launch

Minimum:

- systemd journal on `APP001`
- Apache access/error logs on `WEB001`
- PostgreSQL logs on `SQL001`
- CloudWatch basic EC2 metrics
- manual release gate after deploys

Recommended low-cost improvement:

- install CloudWatch Agent on `WEB001`, `APP001`, and `SQL001`
- ship selected logs:
  - Apache access/error logs
  - `hsm-api.service` logs
  - `hsm-control-api.service` logs
  - PostgreSQL logs
- create basic alarms:
  - high CPU
  - low disk space
  - instance status check failure
  - `/health` external monitor failure

Keep retention short at launch, such as 7-14 days, to control cost.

## Cost-Control Levers

Ways to keep the first AWS build cheap:

- use small burstable EC2 instances
- use Debian Linux instead of Windows for `MAINT001`
- stop `MAINT001` when not needed
- keep EBS volumes right-sized
- use short CloudWatch log retention
- delay RDS until revenue justifies it
- use S3 lifecycle rules for backups
- avoid NAT Gateway unless absolutely required
- use a temporary NAT instance for private-server updates and downloads
- avoid managed load balancer at first if Apache on `WEB001` is enough

Avoiding NAT Gateway matters because NAT Gateway can cost more than the smallest servers in a budget proof-of-concept environment. The temporary NAT instance should not be left running outside maintenance windows.

When pausing work before AWS is live:

- stop `APP001`
- stop `SQL001`
- stop `WEB001` unless public Apache testing must remain available
- stop `MAINT001` last
- terminate `TEMP-NAT`
- do not release the `WEB001` Elastic IP unless losing that stable IP is acceptable

Stopped EC2 instances do not accrue compute charges, but EBS volumes and allocated Elastic IP addresses still incur charges.

## Known Tradeoffs

This budget AWS design is intentionally not the final ideal SaaS architecture.

Accepted tradeoffs:

- PostgreSQL remains self-managed on EC2
- failover is manual
- database patching is manual
- private-server internet egress is manual and temporary
- backups require active discipline
- no managed load balancer at the first stage
- no S3-backed export storage at the first stage unless added separately
- provisioning automation still assumes known hosts and SSH paths

Do not mistake "cheap launch architecture" for "finished cloud architecture."

## Future Upgrade Path

When subscribers and revenue justify it, move toward:

- Amazon RDS for PostgreSQL
- S3 for data-export artifacts and backups
- AWS Backup or managed backup policies
- centralized CloudWatch logs and alarms
- infrastructure-as-code
- private subnets with cleaner egress design
- optional load balancer
- automated CI/CD deployment
- more backend summary/scoped data APIs for larger tenants

## Go / No-Go Criteria

The AWS proof-of-concept is acceptable only when:

- public HTTPS works
- tenant app loads
- tenant login works
- hosted release gate passes
- control center works
- PostgreSQL data is restored and verified
- backups are configured and at least one restore path is documented
- Stripe webhook endpoint is configured for the AWS hostname
- no server requires public database access
- rollback to lab or previous AWS deployment is understood
