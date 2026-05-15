# Product And Platform Next Efforts Plan

Date: 2026-05-15
Status: Next-session execution plan
Primary owners: CEO Orchestrator, Product Architect, Backend/API Engineer, QA & Release Agent
Supporting owners: Frontend Engineer

## Purpose

Move the workstream from public-site polish back to higher-value product and platform completion.

The next phase should turn the hosted SaaS account/commercial surfaces into reliable end-to-end product flows, with repeatable production validation before broader backend/platform hardening.

## Current Production Baseline

- Public SaaS page polish is deployed and pushed.
- Latest public SaaS cache key:
  - `saas-polish.css?v=202605151220`
- Latest public WEB001 rollback snapshot:
  - `/var/www/home-school-management/rollback/web-202605151220.tgz`
- Account Profile, Account Options, dormant, export, and upgrade UI surfaces exist, but several commercial flows are not end-to-end complete.
- Hosted smoke and release-gate scripts already support credential environment variables:
  - `HSM_HOSTED_SMOKE_USERNAME`
  - `HSM_HOSTED_SMOKE_PASSWORD`
  - `HSM_CONTROL_SMOKE_USERNAME`
  - `HSM_CONTROL_SMOKE_PASSWORD`

## Priority Order

1. Authenticated production smoke credentials and repeatable release gate.
2. Account Profile upgrade flow end-to-end.
3. Account Options Dormant Mode end-to-end.
4. Account Options Data Export end-to-end.
5. Backend/platform hardening.
6. Tenant/runtime correctness.
7. Deeper workflow QA from real usage.

## Workstream 1: Authenticated Production Smoke And Release Gate

### Goal

Make every production release repeatably verifiable through an authenticated tenant-app smoke pass and optional control-plane smoke pass.

### Current State

- `scripts/Test-HostedSmoke.ps1` supports `-Username`, `-Password`, or env vars.
- `scripts/Invoke-HostedReleaseGate.ps1` checks APP001 local health, public `/health`, tenant hosted smoke, and optional control-plane login/session.
- The gate is currently blocked by missing production-safe smoke credentials in this shell.

### Implementation Plan

1. Create or designate a production-safe tenant smoke account.
   - Must be an admin or test operator with enough permission to call the smoke endpoints.
   - Must not be a real family user account.
   - Must have stable credentials stored outside the repo.
2. Create or designate a production-safe control-plane smoke account if using `-IncludeControlPlane`.
   - Must have minimal operator permissions needed for login/session validation.
   - Must not reuse personal admin credentials.
3. Store credentials in an approved local/operator secret location.
   - Do not commit credentials to `.env`, scripts, notes, runbooks, or journal.
   - Recommended workstation env vars:
     - `HSM_HOSTED_SMOKE_USERNAME`
     - `HSM_HOSTED_SMOKE_PASSWORD`
     - `HSM_CONTROL_SMOKE_USERNAME`
     - `HSM_CONTROL_SMOKE_PASSWORD`
4. Run tenant smoke directly:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Test-HostedSmoke.ps1 -BaseUrl https://mitchell.navigrader.com
```

5. Run release gate without control plane:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Invoke-HostedReleaseGate.ps1 -PublicBaseUrl https://mitchell.navigrader.com
```

6. Run release gate with control plane when operator credentials exist:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Invoke-HostedReleaseGate.ps1 -PublicBaseUrl https://mitchell.navigrader.com -ControlBaseUrl https://www.navigrader.com/control-api -IncludeControlPlane
```

### Acceptance Criteria

- Tenant smoke can run from the workstation without passing credentials in command history.
- Release gate succeeds against production HTTPS URLs.
- Gate failure messages identify which check failed.
- STATUS/HANDOFF validation records whether the authenticated gate ran or why it did not.

## Workstream 2: Account Profile Upgrade Flow End-to-End

### Goal

Finish and wire plan upgrades from Account Profile so an admin can choose a higher plan, Stripe bills correctly, backend state updates durably, and the UI reflects the new plan.

### Current State

- Frontend account upgrade UI exists.
- Frontend calls:
  - `POST /api/account/subscription/upgrade`
- Upgrade options are visible in local preview.
- End-to-end Stripe billing behavior for plan upgrades still needs completion and validation.

### Product Decisions

Confirm before coding:

- Upgrade timing:
  - recommended: immediate plan upgrade.
- Stripe proration:
  - recommended first release: use Stripe proration intentionally and record the behavior in audit metadata.
- Checkout vs direct subscription update:
  - recommended: if the tenant already has a Stripe subscription, update the subscription item directly; use Checkout only when no valid subscription exists.
- Downgrades:
  - recommended: do not support self-service downgrade in first release; route downgrade requests to support.

### Implementation Plan

1. Backend tenant route review.
   - Confirm `POST /api/account/subscription/upgrade` validates tenant admin permission.
   - Confirm request accepts only an allowed target plan code, not arbitrary price IDs.
   - Confirm route forwards to control API using internal auth.
2. Control API upgrade endpoint.
   - Fetch current subscription, current plan, target plan, Stripe subscription ID, and primary subscription item.
   - Reject invalid transitions:
     - missing Stripe subscription
     - canceled/unpaid subscription
     - target plan not public/active
     - same plan
     - downgrade if downgrade is not supported
   - Update Stripe subscription item to the target active price.
   - Set proration behavior deliberately.
   - Update local `customer_subscriptions` plan, base price, included students, overage policy, and status fields.
   - Record commercial audit/billing event.
3. Stripe webhook reconciliation.
   - Ensure `customer.subscription.updated` reconciles plan/status after direct upgrade.
   - Ensure webhook replay is idempotent.
   - Ensure local manual update and webhook update cannot conflict.
4. Account Profile UI.
   - Disable Upgrade CTA while request is running.
   - Show target plan price and included student capacity before confirmation.
   - Show success message and refresh account summary.
   - Show clear errors for past due/canceled/unavailable states.
5. Operator visibility.
   - Account overview should show current plan, last upgrade event, Stripe subscription ID, and billing status.

### Acceptance Criteria

- Admin can upgrade from Account Profile.
- Stripe subscription is updated to the correct target recurring price.
- Local subscription record matches Stripe after the request and after webhook replay.
- Account Profile refresh shows the new plan, limits, and price.
- Billing activity shows the upgrade event.
- Failed upgrades leave local plan state unchanged or clearly failed.

## Workstream 3: Account Options Dormant Mode End-to-End

### Goal

Finish Dormant Mode so it reduces billing for inactive periods, preserves data/configuration, blocks live academic writes, and can be reactivated safely.

### Source Plan

Continue from:

- `NOTES/dormant-data-export-end-to-end-plan.md`

### Required Scope

1. Control-plane migration for dormant billing metadata.
   - dormant price cents
   - Stripe dormant price ID
   - dormant requested/effective/activated timestamps
   - reactivated timestamp
   - lifecycle error field
2. Stripe dormant pricing.
   - Configure dormant recurring Stripe price for each public plan.
   - Update subscription item to dormant price when dormant becomes active.
   - Clear or suppress overage subscription items while dormant.
3. Pending dormant processor.
   - Tenant request should normally create `pending_dormant`.
   - Processor applies dormant pricing at the billing boundary.
   - Failures are retryable and visible.
4. Reactivation.
   - Pending dormant reactivation cancels pending transition.
   - Active dormant reactivation restores active Stripe price.
   - Reactivation resumes normal tenant activity.
5. Dormant write-block review.
   - Attendance and grade/test writes are already blocked.
   - Review all live academic write paths and centralize enforcement.
6. UI completion.
   - Show Active, Pending Dormant, Dormant.
   - Show dormant effective date.
   - Show what billing/data/activity changes mean in parent-facing language.
   - Confirm before dormant/reactivation requests.

### Acceptance Criteria

- Dormant request records pending state and effective date.
- Dormant billing begins at the intended Stripe billing boundary.
- Stripe recurring billing changes to the dormant price.
- Live academic writes are blocked while dormant.
- Records, reports, setup, and export request remain readable/available.
- Reactivation restores active Stripe billing and normal write access.
- Every transition is audited and retryable.

## Workstream 4: Account Options Data Export End-to-End

### Goal

Finish paid data export so a tenant admin can pay for a records bundle, wait for processing, and download it securely.

### Source Plan

Continue from:

- `NOTES/dormant-data-export-end-to-end-plan.md`

### Required Scope

1. Export request checkout.
   - `POST /api/account/options/export-request` creates or reuses a pending request.
   - Control API creates one-time Stripe Checkout for `$19.99`.
   - UI sends tenant admin to checkout.
2. Stripe webhook.
   - `checkout.session.completed` for export marks request paid.
   - Webhook queues `export_tenant_data`.
   - Replay is idempotent.
3. Export job.
   - Job reads only the owning tenant schema.
   - Job writes a private zip artifact.
   - Job records manifest, checksum, size, and ready/failed status.
4. Bundle content.
   - first-release CSV files:
     - students
     - school years
     - enrollments
     - subjects
     - courses
     - attendance
     - grades/tests
   - include `manifest.json`.
   - protect against CSV formula injection.
5. Secure download.
   - Tenant admin can download only owned ready exports.
   - Artifacts expire, recommended after 7 days.
   - Expired artifacts are not downloadable.
6. UI completion.
   - Show statuses:
     - Waiting for payment
     - Paid
     - Preparing export
     - Ready to download
     - Failed
     - Expired
   - Show price and included record categories before checkout.
   - Download button appears only when ready.
7. Operator controls.
   - View export payment/job/artifact status.
   - Retry failed export jobs.
   - Expire/delete artifacts.

### Acceptance Criteria

- Export payment is collected by Stripe.
- Paid webhook queues exactly one export job.
- Export job produces expected CSV bundle.
- Bundle excludes secrets and unrelated tenant data.
- Tenant admin can download securely.
- Expired exports are inaccessible.
- Operators can inspect and retry failures.

## Workstream 5: Backend And Platform Hardening

### Goal

Improve production safety before adding more commercial surface area.

### Candidate Work

1. Centralize internal service auth between tenant runtime and control API.
2. Review tenant isolation on every internal route.
3. Add structured audit events for:
   - upgrade request
   - dormant request
   - reactivation
   - export payment
   - export generation
   - export download
4. Add idempotency keys to commercial lifecycle operations.
5. Improve Stripe webhook event locking/replay behavior.
6. Confirm all systemd secrets load from approved environment files.
7. Confirm no browser-visible payload exposes secrets or internal artifact paths.

### Acceptance Criteria

- Internal routes fail closed without internal auth.
- Commercial lifecycle events have durable audit rows.
- Replayed webhooks and retried jobs are safe.
- Tenant boundaries are explicit in code and tests.

## Workstream 6: Tenant And Runtime Correctness

### Goal

Reduce risk from tenant schema/runtime identity mistakes as commercial workflows mutate subscriptions and account state.

### Candidate Work

1. Add runtime assertions for tenant schema identity.
2. Validate public hosted app uses intended tenant schema, not PostgreSQL `public`.
3. Add release-gate checks for core domain reads after login.
4. Expand smoke endpoints only where they provide signal without mutating data.
5. Add diagnostics for dormant/write-block state in account summary responses.

### Acceptance Criteria

- Production smoke proves tenant-authenticated reads work against the intended tenant.
- Runtime schema misconfiguration fails loudly.
- Dormant status is consistent between control API and tenant runtime.

## Workstream 7: Deeper Workflow QA From Real Usage

### Goal

Use real operator/parent workflows to catch issues that API smoke checks do not cover.

### Candidate Workflows

1. Account Profile:
   - view profile/subscription
   - upgrade plan
   - confirm billing activity
2. Account Options:
   - request dormant
   - reactivate
   - request/export data
3. School Day:
   - attendance
   - daily completion
   - grade entry
4. Reports:
   - student academic report
   - compliance report
5. Planning/setup:
   - schedule/curriculum interactions
   - required-subject gaps
6. Dormant state:
   - read/report allowed
   - write blocked

### Acceptance Criteria

- QA checklist documents exact production-safe accounts and non-destructive steps.
- Mutating production QA steps use clearly identified test tenants only.
- Defects found from real usage are logged with repro steps.

## Recommended Next Session Start

Start with release gate credentials, then Account Profile upgrade wiring.

Suggested first commands:

```powershell
git status -sb
powershell -ExecutionPolicy Bypass -File .\scripts\Test-HostedSmoke.ps1 -BaseUrl https://mitchell.navigrader.com
powershell -ExecutionPolicy Bypass -File .\scripts\Invoke-HostedReleaseGate.ps1 -PublicBaseUrl https://mitchell.navigrader.com
rg -n "subscription/upgrade|upgradeHostedSubscription|upgrade|stripe.*subscription|customer.subscription.updated" web server control-api
```

Suggested first implementation target:

- Complete `POST /api/account/subscription/upgrade` through control API and Stripe subscription item update.

Suggested first product decision:

- Confirm upgrade proration behavior for active subscriptions.

## Risks

- Do not claim dormant lowers billing until Stripe dormant price switching is implemented and verified.
- Do not claim export is downloadable until payment, job, artifact, and secure download are complete.
- Do not run mutating workflow QA against a real family account.
- Do not store smoke credentials in the repo.
