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
- backup/restore expectations for PostgreSQL are known before cutover

### Operational Readiness
- `scripts\Invoke-HostedReleaseGate.ps1` passes against the target environment
- `scripts\Test-HostedWorkflow.ps1` passes against the target environment
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
