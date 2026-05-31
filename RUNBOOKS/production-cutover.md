# Production Cutover Runbook

## Purpose
Define the conditions, sequence, owners, and rollback rules for moving from the current staged hosted platform to a broader production rollout.

This runbook is stricter than the staged deployment guide. Staging readiness proves the platform works; production cutover also requires explicit owners, communications, rollback authority, and prerequisite confirmation.

## Scope
This cutover plan assumes:
- `APP001` hosts the tenant app and `control-api`
- `WEB001` hosts Apache-served web assets and reverse proxy
- `SQL001` hosts PostgreSQL
- the current regression gates remain:
  - `scripts\Invoke-HostedReleaseGate.ps1`
  - `scripts\Test-HostedWorkflow.ps1`

## Cutover Worksheet

### Named Owners
- Cutover lead: `Randal Mitchell`
- Deployment operator: `Randal Mitchell`
- Rollback owner: `Randal Mitchell`
- Communications owner: `Randal Mitchell`
- Backup deployment operator: `Randal Mitchell`
- Go/no-go authority: `Randal Mitchell`

### Production Target
- Primary public hostname: `TBD`
- Control Center public hostname/path: `TBD`
- TLS termination point: `TBD`
- Cookie secure setting confirmed for production hostnames: `TBD`
- Apache site/proxy configuration target: `TBD`
- Production tenant runtime identity/environment name: `TBD`

### Current AWS Validation Baseline
- AWS public target currently validated through `WEB001` Elastic IP `18.188.35.157`.
- Validation hostnames currently in use:
  - `aws-validation.navigrader.com`
  - `mitchell-aws-validation.navigrader.com`
  - `aws1.navigrader.com`
- TLS currently covers all three validation hostnames.
- Restored Mitchell validation tenant login/smoke succeeded at `mitchell-aws-validation.navigrader.com`.
- Stripe test checkout succeeded end-to-end through `aws-validation.navigrader.com`, including setup email, first admin setup, and login for `aws1.navigrader.com`.
- Temporary MAINT001 NAT and temporary managed NAT Gateway validation paths are cleaned up; APP001 private egress to Stripe/Postmark should time out until go-live egress is intentionally enabled.
- Keep the `aws1` tenant and Stripe test records for now as rehearsal evidence.

### Secrets / Configuration Confirmation
- Tenant app session/auth secret confirmed: `TBD`
- Control-plane session secret confirmed: `TBD`
- Internal service-auth secret confirmed: `TBD`
- PostgreSQL production credentials confirmed: `TBD`
- Runtime `.env.runtime` generation rules confirmed: `TBD`
- Secret storage location and access procedure confirmed: `TBD`

### First Cutover Window
- Intended release commit: `TBD`
- Previous known-good rollback commit: `TBD`
- Cutover date: `TBD`
- Cutover start time and timezone: `TBD`
- Expected validation duration: `TBD`
- Rollback decision deadline/threshold: `TBD`
- Stakeholder communications channel: `TBD`

## Production Prerequisites

### Product / Platform
- staged go/no-go call is still current
- intended release commit is frozen
- no known unresolved blocker exists in:
  - tenant app workflows
  - control-plane operator workflows
  - release/rollback scripts

### Secrets / Configuration
- production-grade values are confirmed for:
  - tenant app auth/session secrets
  - control-plane session secrets
  - internal service-auth secret
  - PostgreSQL credentials
  - cookie security and hostname/TLS settings
- `.env.runtime` generation rules are confirmed for the production tenant runtime
- production config is stored in the agreed operational location, not only in shell history or local notes

### Infrastructure / Access
- host ownership is explicit for `APP001`, `WEB001`, and `SQL001`
- at least one primary and one backup operator can access the required hosts/services
- `APP001 -> WEB001` SSH trust remains valid for deployment automation
- Apache site config and proxy routes are confirmed for the intended public hostname(s)
- production Apache config is based on `infra/apache/home-school-management-production-ssl.conf` or has equivalent TLS, redirect, HSTS, header, request-size, dotfile, and log-separation controls
- tenant/control systemd units load secrets from `/etc/home-school-management/*.env` or an approved secret manager, not inline unit-file secrets
- tenant/control systemd units use dedicated non-login service users and baseline hardening directives
- backup/restore expectations for PostgreSQL are known before cutover
- production private egress plan is confirmed: managed NAT Gateway for APP001 outbound mail/Stripe traffic, not MAINT001 NAT

### Operational Readiness
- `scripts\Invoke-HostedReleaseGate.ps1` passes against the target environment
- `scripts\Test-HostedWorkflow.ps1` passes against the target environment
- `npm audit --omit=dev` passes in both `server/` and `control-api/`
- a rollback owner is identified
- a go/no-go authority is identified
- a communications owner is identified

## Owners

### Cutover Lead
- owns the timeline and the go/no-go call

### Deployment Operator
- executes file sync, service restarts, and scripted validation

### Rollback Owner
- has authority to stop the rollout and restore the previous known-good deployment

### Communications Owner
- communicates cutover start, status, rollback, and completion to stakeholders

One person can fill more than one role in a small rollout, but each role must still be explicitly assigned before starting.

## Cutover Sequence

### T-1 Day
- freeze intended release commit
- confirm production secrets/config package
- confirm host access and rollback ownership
- run:
  - `scripts\Invoke-HostedReleaseGate.ps1`
  - `scripts\Test-HostedWorkflow.ps1`
- verify no unresolved current service errors remain

### T-0 Before Deploy
- confirm stakeholder approval to begin
- confirm current backup/restore posture for the target database
- create and validate production private egress if Stripe/Postmark traffic will be live:
  - create managed NAT Gateway `navigrader-prod-private-egress`
  - place it in public subnet `subnet-08d32e4b05a9125b2`
  - add private route table `rtb-01e7fa93185f5ddf` route `0.0.0.0/0 -> NAT Gateway`
  - verify APP001 can reach Stripe, Postmark, and an external IP check endpoint
  - confirm MAINT001 is not configured as NAT
- capture:
  - current commit SHA
  - previous known-good commit SHA
  - current service status
- confirm rollback trigger thresholds

### Deploy Window
- deploy backend files to `APP001`
- deploy frontend files to `WEB001`
- deploy control-plane files if included
- restart only after file sync is complete

### Validation Window
- run `scripts\Invoke-HostedReleaseGate.ps1`
- run `scripts\Test-HostedWorkflow.ps1` when the release is broad enough to justify the longer workflow check
- confirm:
  - app service healthy
  - public health healthy
  - control-plane health healthy if included
  - no unresolved startup/runtime journal errors

### Go Decision
Proceed only if:
- scripted gate passes
- workflow validation passes when required
- journal review does not show unresolved current failures
- operators can log in and complete expected core workflows

If any of those fail and cannot be corrected quickly, roll back.

## DNS Cutover Rehearsal

Before live DNS cutover:

1. Record the current GoDaddy values for every hostname being changed, including type, name, value, and TTL.
2. Lower TTL ahead of the window where possible.
3. Confirm AWS TLS certificate covers the hostname before changing production traffic.
4. Point the selected hostname to the AWS target, currently `18.188.35.157` unless a later load balancer/EIP replaces it.
5. From a public browser, verify HTTPS loads, `/health` returns healthy, and login works.
6. Validate password reset email links use the same tenant hostname that initiated the reset.
7. Validate Stripe checkout/setup email on the AWS hostname before enabling real paid traffic.
8. Keep the previous lab/home target available until AWS has passed the release gate and smoke checks.

DNS rollback:

1. Restore the recorded GoDaddy value for the affected hostname.
2. Wait for DNS resolution to return to the previous target, accounting for TTL and local resolver cache.
3. Verify HTTPS and login on the restored target.
4. Do not delete AWS tenant/control data during DNS rollback unless a separate data rollback decision is made.

## Rollback Rules

### Immediate Rollback Triggers
- public `/health` does not recover to `200`
- tenant login fails after release
- control-plane login fails if the release included control-plane changes
- scripted release gate fails after reasonable immediate correction attempts
- journal output shows unresolved startup/module/config failure after deployment

### Rollback Steps
- redeploy the previous known-good file set
- restart affected services
- rerun `scripts\Invoke-HostedReleaseGate.ps1`
- rerun `scripts\Test-HostedWorkflow.ps1` if the failed release affected broad user workflows
- declare rollback complete only after the validation gate passes again

## Communications Template

### Start
- cutover start time
- release commit
- expected validation window

### Success
- cutover completed
- validation gate passed
- any temporary constraints or follow-up watches

### Rollback
- rollback initiated
- impact summary
- current recovery state
- next update time

## Exit Criteria
Production cutover is considered complete only when:
- the release gate passes on the production target
- any required workflow validation passes
- rollback path remains available
- the final go/no-go outcome is recorded in repo docs or operational notes

## Open Production Decisions
- The real owner names are still pending and must be filled into the cutover worksheet before the first live window.
- The production hostname/TLS/cookie configuration is still pending and must be confirmed before production validation.
- The production secrets/config package is still pending explicit confirmation and storage-location signoff.
- The first actual cutover window is still pending a named release commit, rollback commit, and decision deadline.
