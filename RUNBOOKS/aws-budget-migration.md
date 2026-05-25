# AWS Budget Migration Plan

## Purpose

This runbook documents the first proof-of-concept AWS move for Navigrader.

The goal is not to build the final ideal cloud architecture on day one. The goal is to move the current working lab design into AWS with the lowest practical monthly cost while preserving the same mental model:

- `WEB001` serves public web traffic and proxies API requests
- `APP001` runs the tenant API and control API
- `SQL001` runs PostgreSQL
- `MAINT001` is a small maintenance/jumpbox/Codex-capable Linux node

This is the launch-validation architecture. It is intended to prove whether the business can attract subscribers and revenue before moving to a more managed, higher-cost AWS design.

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
- private subnet: `APP001`, `SQL001`, `MAINT001`
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

## Migration Phases

### Phase 1: AWS Foundation

Create:

- VPC
- public and private subnets
- internet gateway
- route tables
- security groups
- EC2 instances:
  - `WEB001`
  - `APP001`
  - `SQL001`
  - `MAINT001`
- EBS volumes sized for each server
- Elastic IP or DNS target for `WEB001`

Initial goal:

- all four servers can be reached through the intended admin path
- `WEB001` can reach `APP001`
- `APP001` can reach `SQL001`
- `MAINT001` can administer all hosts

### Phase 2: Base Server Build

On each Debian server:

- apply operating system updates
- create service users
- configure SSH
- configure host firewalls where used
- set hostnames
- install common tools

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
- avoid managed load balancer at first if Apache on `WEB001` is enough

Avoiding NAT Gateway matters because NAT Gateway can cost more than the smallest servers in a budget proof-of-concept environment.

## Known Tradeoffs

This budget AWS design is intentionally not the final ideal SaaS architecture.

Accepted tradeoffs:

- PostgreSQL remains self-managed on EC2
- failover is manual
- database patching is manual
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

