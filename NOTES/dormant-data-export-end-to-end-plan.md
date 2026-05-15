# Dormant And Data Export End-to-End Plan

Date: 2026-05-15
Status: Draft execution plan
Primary owners: Backend/API Engineer, QA & Release Agent
Supporting owners: Product Architect, Frontend Engineer

## Purpose

Implement Dormant Mode and Data Export as complete customer-facing account lifecycle features.

This plan intentionally separates the two feature tracks because they share account/subscription UI, control-plane audit, Stripe, and tenant identity boundaries, but they have different success criteria:

- Dormant Mode preserves tenant data and configuration, blocks normal academic writes, and reduces recurring billing during inactive periods.
- Data Export lets a tenant administrator pay for and download a records bundle without mutating tenant academic data.

## Existing Product Policy

Existing policy notes already define the intended behavior:

- Dormant billing should be `25%` of the normal monthly base subscription price.
- Dormant tenants keep data, provisioning, reporting continuity, and historical reads.
- Dormant tenants should not create new academic activity until reactivated.
- First-release paid export is `$19.99`.
- First-release export should include CSV files for students, school years, enrollments, subjects, courses, attendance history, and grades/tests.
- Export generation should be auditable through the control plane and should not mutate academic data.

Relevant existing notes:

- `NOTES/subscription-billing-policy.md`
- `NOTES/tenant-account-subscription-settings-spec-package.md`
- `NOTES/stripe-staged-rollout.md`

## Current Implementation Snapshot

Verified on 2026-05-15:

- Tenant account UI has Account Options actions for Dormant, Reactivate, and Data Export.
- Tenant runtime routes exist:
  - `POST /api/account/options/dormant`
  - `POST /api/account/options/reactivate`
  - `POST /api/account/options/export-request`
- Tenant runtime forwards those actions to internal control-plane routes.
- Control API can mark a subscription `pending_dormant` or `dormant`.
- Control API can mark a subscription `active` again.
- Control API can queue `suspend_tenant` and `resume_tenant` lifecycle jobs.
- Tenant commercial policy blocks attendance and grade/test writes when `dormant_status` is `dormant` or `pending_dormant`.
- Control API records cancellation export requests with `pending_payment` status and `$19.99` price.

Important gaps:

- Dormant does not currently update Stripe recurring billing to a reduced dormant price.
- Pending dormant is not currently applied automatically at the billing period boundary.
- Reactivation does not currently restore Stripe recurring billing from dormant price to active price.
- Grade/attendance writes do not auto-reactivate the account, and that is acceptable for the intended product.
- Dormant write blocking is currently present for attendance and grade/test writes, but other live academic write paths still need review.
- Data Export does not yet have end-to-end payment, job execution, artifact creation, secure download, expiration, or retry handling.

## Product Decisions To Confirm Before Coding

Confirm these before implementation begins:

- Dormant effective timing:
  - Recommended: request during an active billing period creates `pending_dormant`; reduced billing begins at the next Stripe period boundary.
  - Immediate dormant only applies when the current billing period has already ended or an operator explicitly forces it.
- Dormant reactivation billing:
  - Recommended: explicit tenant-admin reactivation restores the active recurring price immediately with Stripe proration behavior set intentionally.
  - Product decision needed: use `create_prorations`, `always_invoice`, or no immediate proration.
- Dormant price source:
  - Recommended: configure a dedicated Stripe dormant recurring price per public plan and store it in the control-plane plan record.
  - Alternative: dynamically create Stripe recurring prices from `dormantBasePricePercentage`, but this is harder to audit and reconcile.
- Dormant access:
  - Recommended first release: allow login, reads, reporting, account management, and export request; block live academic writes.
- Data export payment:
  - Recommended: one-time Stripe Checkout payment created when the tenant admin requests export.
- Data export retention:
  - Recommended: ready artifacts expire after 7 days.
- Export scope:
  - Recommended first release: use the existing policy list only, then expand later if needed.

## Target Architecture

Control API owns:

- commercial subscription state
- Stripe mutation and webhook handling
- export request payment state
- audit trail
- lifecycle job queue
- export artifact status and secure download authorization

Tenant runtime owns:

- authenticated tenant-admin request validation
- tenant schema read access for export data
- commercial write blocking inside normal academic APIs
- user-facing account summary and action UI

Stripe owns:

- recurring active plan billing
- recurring dormant plan billing
- one-time data export payment
- webhook events that drive durable control-plane state

No browser code should receive database credentials, internal service tokens, raw artifact paths, or privileged Stripe secrets.

## Data Model Plan

### Commercial Plans

Add durable dormant billing metadata to `commercial_plans` instead of relying only on `limits_json`.

Recommended columns:

- `dormant_price_cents INTEGER NULL`
- `stripe_dormant_price_id TEXT NULL`
- `dormant_billing_interval TEXT NULL DEFAULT 'month'`

Keep `limits_json.dormantBasePricePercentage` for policy display/backward compatibility, but do not use it as the only runtime Stripe source.

### Customer Subscriptions

Add dormant transition fields so pending state can be processed reliably.

Recommended columns:

- `dormant_requested_at TIMESTAMPTZ NULL`
- `dormant_effective_at TIMESTAMPTZ NULL`
- `dormant_activated_at TIMESTAMPTZ NULL`
- `reactivated_at TIMESTAMPTZ NULL`
- `active_stripe_price_id TEXT NULL`
- `dormant_stripe_price_id TEXT NULL`
- `last_lifecycle_error TEXT NULL`

These fields make period-boundary processing and support/debugging much easier.

### Export Requests

Extend `cancellation_export_requests` for payment and delivery lifecycle.

Recommended columns:

- `stripe_checkout_session_id TEXT NULL`
- `stripe_payment_intent_id TEXT NULL`
- `paid_at TIMESTAMPTZ NULL`
- `queued_at TIMESTAMPTZ NULL`
- `processing_started_at TIMESTAMPTZ NULL`
- `ready_at TIMESTAMPTZ NULL`
- `expired_at TIMESTAMPTZ NULL`
- `download_token_hash TEXT NULL`
- `download_expires_at TIMESTAMPTZ NULL`
- `artifact_size_bytes BIGINT NULL`
- `artifact_sha256 TEXT NULL`
- `manifest_json JSONB NOT NULL DEFAULT '{}'::jsonb`
- `request_scope_json JSONB NOT NULL DEFAULT '{}'::jsonb`

Existing statuses can remain:

- `pending_payment`
- `paid`
- `queued`
- `processing`
- `ready`
- `failed`
- `expired`

### Provisioning Jobs

Add a dedicated job type:

- `export_tenant_data`

The job should be auditable from the control plane and linked back to the export request.

## Dormant Mode Implementation Plan

### Phase D1: Stripe Price Configuration

1. Create dormant recurring Stripe prices for each public plan in Stripe test mode.
2. Record those price IDs in `commercial_plans.stripe_dormant_price_id`.
3. Backfill `dormant_price_cents` from the existing `dormantBasePricePercentage` policy.
4. Add an operator/control validation query that flags public active plans missing dormant price configuration.

Acceptance:

- Every active public monthly plan has both active and dormant Stripe price IDs.
- The control API refuses to enter dormant mode if the target plan lacks a dormant price.

### Phase D2: Stripe Service Methods

Add Stripe service methods in `control-api/src/services/stripe-service.js`:

- `applyDormantSubscriptionPricing({ subscriptionId, dormantPriceId, metadata, prorationBehavior })`
- `restoreActiveSubscriptionPricing({ subscriptionId, activePriceId, metadata, prorationBehavior })`
- `clearDormantIncompatibleItems({ subscriptionId })`

Implementation notes:

- Reuse the existing primary subscription item update pattern.
- Ensure `cancel_at_period_end=false` when restoring active pricing.
- Remove or zero overage subscription items while dormant.
- Attach metadata:
  - `billing_lifecycle=dormant` or `billing_lifecycle=active`
  - `customer_subscription_id`
  - `commercial_plan_id`
  - `requested_by_user_id`

Acceptance:

- Unit tests verify the exact Stripe API parameters.
- Stripe errors leave local state unchanged or marked with a clear failure reason.

### Phase D3: Tenant-Requested Dormant Flow

Update internal control route:

- `POST /api/internal/commercial/subscriptions/:id/dormant`

Behavior:

1. Fetch subscription, account overview, and plan.
2. Validate subscription is active/trialing and not canceled/unpaid.
3. Validate dormant Stripe price is configured.
4. If current period end is in the future:
   - set `dormant_status='pending_dormant'`
   - set `dormant_requested_at=NOW()`
   - set `dormant_effective_at=current_period_end`
   - do not change Stripe price yet
5. If dormant should apply immediately:
   - update Stripe to dormant price
   - remove or zero overage items
   - set `dormant_status='dormant'`
   - set `dormant_activated_at=NOW()`
   - queue `suspend_tenant` job if needed
6. Write operator audit entry.
7. Return user-safe message.

Acceptance:

- Pending dormant does not reduce Stripe billing early.
- Immediate dormant reduces Stripe recurring billing.
- Duplicate dormant requests are idempotent.

### Phase D4: Period-Boundary Dormant Processor

Add a scheduled control-plane processor.

Recommended route/job:

- internal worker function: `processPendingDormantSubscriptions()`
- optional operator/internal route for manual trigger in staging

Behavior:

1. Find subscriptions where:
   - `dormant_status='pending_dormant'`
   - `dormant_effective_at <= NOW()`
2. For each subscription:
   - fetch plan and Stripe subscription
   - apply dormant Stripe price
   - clear overage item
   - set `dormant_status='dormant'`
   - set `dormant_activated_at=NOW()`
   - queue `suspend_tenant`
   - audit success
3. On failure:
   - leave state as `pending_dormant`
   - set `last_lifecycle_error`
   - audit failure
   - allow retry

Acceptance:

- Processor can run repeatedly without double-billing or duplicate suspend jobs.
- Failed transitions are visible to operators.

### Phase D5: Reactivation Flow

Update internal control route:

- `POST /api/internal/commercial/subscriptions/:id/reactivate`

Behavior:

1. If active, return idempotent success.
2. If pending dormant:
   - set `dormant_status='active'`
   - clear `dormant_effective_at`
   - audit canceled dormant request
   - do not call Stripe
3. If dormant:
   - validate active Stripe price is configured
   - restore active Stripe price
   - set `dormant_status='active'`
   - set `reactivated_at=NOW()`
   - queue `resume_tenant`
   - audit success

Acceptance:

- Reactivating pending dormant cancels the pending transition.
- Reactivating dormant restores full recurring billing in Stripe.
- Reactivation does not create a second Stripe subscription.

### Phase D6: Tenant Runtime Write Blocking Review

Current attendance and grade/test writes are blocked while dormant. Review and protect every live academic write path.

Likely paths to review:

- attendance create/update
- grade/test create/update
- plan create/update
- enrollment create/update that creates billable activity
- instruction actuals
- flex blocks
- daily execution records
- schedule/planning operations that represent live school activity

Recommended helper:

- centralize dormant write enforcement in `commercial-policy-service`
- call it from every route that creates live academic activity

Acceptance:

- Dormant tenants can read records and reports.
- Dormant tenants cannot create new academic activity.
- Error copy says to reactivate the account to resume school activity.

### Phase D7: Dormant UI And Account Messaging

Update account UI copy only after the backend behavior is complete.

Copy should clearly say:

- Dormant Mode lowers billing after the current billing period.
- Records, setup, and reports remain available.
- New academic activity is paused until reactivation.
- Reactivation resumes regular billing and school activity.

UI requirements:

- show `Active`, `Pending Dormant`, or `Dormant`
- show effective date when pending dormant
- show reactivation CTA for pending/dormant states
- show clear confirmation text before dormant/reactivation actions

Acceptance:

- UI does not promise reduced billing until Stripe-side dormant pricing is implemented.

## Data Export Implementation Plan

### Phase E1: Export Request Checkout

Update tenant route:

- `POST /api/account/options/export-request`

Update internal control route:

- `POST /api/internal/commercial/subscriptions/:id/cancellation-export`

Behavior:

1. Validate current user is tenant admin.
2. Create or reuse a `pending_payment` export request.
3. Create a one-time Stripe Checkout session:
   - mode: `payment`
   - amount: `$19.99`
   - product/copy: `Navigrader records export`
   - metadata:
     - `export_request_id`
     - `customer_subscription_id`
     - `customer_account_id`
     - `tenant_id`
4. Store `stripe_checkout_session_id`.
5. Return checkout URL to tenant runtime.
6. Tenant UI redirects or opens checkout.

Acceptance:

- Unpaid requests do not generate exports.
- Repeated clicks do not create unlimited duplicate pending requests.

### Phase E2: Stripe Webhook For Export Payment

Update `commercial-webhook-service` to handle one-time export checkout completion.

Behavior:

1. On `checkout.session.completed` where metadata has `export_request_id`:
   - verify payment status is paid
   - update export request to `paid`
   - store Stripe checkout/payment references
   - set `paid_at`
   - queue `export_tenant_data`
   - update request to `queued`
   - audit the transition
2. Ignore or separately handle unrelated subscription checkout sessions.

Acceptance:

- Subscription checkout and export checkout webhook paths do not conflict.
- Webhook replay is idempotent.

### Phase E3: Export Job Execution

Add `export_tenant_data` job handling.

Recommended ownership:

- Control plane owns the job and request status.
- Tenant runtime owns tenant schema data extraction.
- Control job calls a tenant-runtime internal export endpoint using internal service auth.

Potential internal route:

- `POST /api/internal/tenant-export/:exportRequestId`

Request body:

- `tenantId`
- `tenantEnvironmentId`
- `customerSubscriptionId`
- `requestedScope`
- `requestedByEmail`

Tenant runtime response:

- artifact bytes uploaded to private control storage, or
- signed temporary upload reference, or
- streamed zip payload to control API if artifact size is small enough for first release

Acceptance:

- Export reads only the target tenant schema.
- Export does not include auth hashes, reset tokens, internal service tokens, billing secrets, or unrelated tenant data.

### Phase E4: Export Bundle Format

Create a zip bundle containing CSV files and a manifest.

First-release files:

- `students.csv`
- `school_years.csv`
- `enrollments.csv`
- `subjects.csv`
- `courses.csv`
- `attendance.csv`
- `grades_tests.csv`
- `manifest.json`

Recommended `manifest.json` fields:

- `generatedAt`
- `tenantId`
- `accountName`
- `requestedByEmail`
- `exportRequestId`
- `schemaVersion`
- `files`
- row counts per file

CSV requirements:

- UTF-8
- stable headers
- ISO dates
- strict CSV quoting
- blank fields instead of raw `null`
- no formula injection in spreadsheet-targeted text fields

Acceptance:

- Bundle can be opened by common spreadsheet tools.
- Row counts match source queries.
- CSV generation is deterministic enough for tests.

### Phase E5: Artifact Storage And Download

Recommended first-release storage:

- private server-side artifact directory controlled by the control API
- artifact path stored in `cancellation_export_requests.artifact_path`
- artifact checksum and byte size stored in the request row
- no public filesystem path exposed to the browser

Download flow:

1. Tenant admin opens Account Options or Account Activity.
2. UI fetches export request status.
3. If ready, user clicks Download.
4. Tenant runtime calls control API to authorize download.
5. Control API verifies:
   - authenticated tenant admin
   - subscription/account ownership
   - export request status is `ready`
   - artifact is not expired
6. Control API streams artifact or returns a short-lived signed download URL.

Expiration:

- default `download_expires_at = ready_at + 7 days`
- expired requests move to `expired`
- expired artifacts are deleted by cleanup job

Acceptance:

- A copied download link cannot be used without authorization unless it is a short-lived signed link.
- Expired exports are not downloadable.

### Phase E6: Operator Controls

Add operator visibility in `/control/`:

- export request list by subscription/account
- payment status
- job status
- artifact status
- retry failed export job
- expire/delete artifact

Acceptance:

- Support can answer whether a customer paid, whether the export ran, and why it failed.

### Phase E7: Tenant UI

Update Account Options and Account Activity:

- show export request statuses:
  - Waiting for payment
  - Paid
  - Preparing export
  - Ready to download
  - Failed
  - Expired
- show price before checkout
- show included record categories before checkout
- provide download button only when ready
- provide retry/request-new-export path when failed or expired

Acceptance:

- UI does not imply the file is immediately downloadable before payment and processing complete.

## Testing Plan

### Unit Tests

Add tests for:

- dormant status transitions
- pending dormant period-boundary eligibility
- Stripe dormant price update parameters
- Stripe active price restore parameters
- overage item removal while dormant
- write blocking while dormant
- export request checkout creation
- export webhook idempotency
- export CSV formatting and formula-injection protection

### Integration Tests

Add tests for:

- tenant admin requests dormant
- tenant admin cancels pending dormant by reactivating
- dormant processor applies dormant pricing
- tenant admin reactivates dormant subscription
- dormant tenant cannot create attendance/grade/test records
- dormant tenant can read reports/history
- tenant admin starts export checkout
- export checkout webhook queues export job
- export job produces bundle
- ready export can be downloaded by the owning tenant admin only

### Staging Validation

Use Stripe test mode and preferably Stripe test clocks for period-boundary dormant validation.

Required staging checks:

- active subscription moves to pending dormant
- period-boundary processor swaps to dormant price
- Stripe invoice/next amount reflects dormant price
- tenant write attempts are blocked while dormant
- reactivation restores active price
- export one-time payment completes
- export artifact is generated
- download works for owning tenant admin
- artifact expires and is no longer downloadable

## Release Plan

Recommended release slices:

1. Data model migrations and plan price configuration checks.
2. Dormant Stripe service methods and control API behavior behind staging-only validation.
3. Pending dormant processor.
4. Tenant runtime write-blocking expansion.
5. Tenant dormant/reactivation UI copy and status display.
6. Export request one-time checkout.
7. Export webhook and job queue.
8. Export bundle generator and secure download.
9. Operator controls for retries/status.
10. Production release gate and smoke tests.

Each slice should be deployable without exposing incomplete customer promises.

## Acceptance Criteria

Dormant is complete when:

- tenant admin can request dormant mode
- pending dormant applies at the correct billing boundary
- Stripe recurring price changes to the dormant price
- dormant overage billing is cleared
- tenant data and reports remain readable
- live academic writes are blocked
- tenant admin can reactivate
- Stripe recurring price changes back to active price
- audit log explains every transition
- failure states are visible and retryable

Data Export is complete when:

- tenant admin can request a paid export
- Stripe one-time payment is collected
- webhook marks request paid and queues export job
- export job creates the expected CSV bundle
- bundle excludes secrets and unrelated tenant data
- tenant admin can securely download the bundle
- artifact expires and is cleaned up
- operators can inspect and retry failed requests
- audit log links payment, job, artifact, and requester

## Next Session Starting Point

Start with Dormant Mode, not Data Export.

Recommended first command:

```powershell
rg -n "dormant|stripe_dormant|dormantBasePrice|cancellation-export|export_tenant_data" control-api server web NOTES
```

Recommended first implementation target:

- Add control-plane migration for dormant price metadata and dormant transition timestamps.
- Add Stripe service methods for dormant price apply/restore with tests.

Recommended first product check:

- Confirm whether reactivation should invoice immediately or prorate onto the next invoice.
