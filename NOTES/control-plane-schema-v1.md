# Control-Plane Schema v1

## Purpose
Define the first relational model for the operator control plane that manages tenant lifecycle, environment state, and provisioning work without mixing that metadata into tenant databases.

## Design Principles
- Keep control-plane data in a separate PostgreSQL database from tenant runtime data.
- Use one tenant runtime database per customer environment.
- Model provisioning as durable jobs with explicit state transitions.
- Keep operator identity and tenant identity fully separate.
- Preserve room for multiple environments per tenant, even if the first rollout starts with one production environment.

## Core Entities

### `operator_users`
- Purpose: authenticated control-plane operators
- Columns:
  - `id`
  - `username`
  - `password_hash`
  - `password_salt`
  - `password_algorithm`
  - `password_iterations`
  - `role`
  - `is_active`
  - `last_login_at`
  - `created_at`
  - `updated_at`
- Notes:
  - roles can begin with `platform_admin` and `support_operator`
  - tenant-app users do not belong in this table

### `operator_sessions`
- Purpose: backend-owned operator sessions
- Columns:
  - `id`
  - `operator_user_id`
  - `session_token_hash`
  - `created_at`
  - `expires_at`
  - `revoked_at`
- Notes:
  - mirrors the tenant app session model conceptually, but remains isolated from tenant auth

### `tenants`
- Purpose: durable customer/workspace record
- Columns:
  - `id`
  - `slug`
  - `display_name`
  - `status`
  - `plan_code`
  - `primary_contact_name`
  - `primary_contact_email`
  - `notes`
  - `created_at`
  - `updated_at`
- Suggested statuses:
  - `draft`
  - `provisioning`
  - `active`
  - `suspended`
  - `decommissioned`

### `tenant_domains`
- Purpose: domain bindings for each tenant
- Columns:
  - `id`
  - `tenant_id`
  - `domain`
  - `domain_type`
  - `is_primary`
  - `verification_status`
  - `verified_at`
  - `created_at`
- Notes:
  - `domain_type` can begin with `platform_subdomain` or `custom_domain`
  - unique constraint should protect one tenant per live domain

### `tenant_environments`
- Purpose: concrete deployable runtime targets
- Columns:
  - `id`
  - `tenant_id`
  - `environment_key`
  - `display_name`
  - `status`
  - `app_base_url`
  - `app_host`
  - `web_host`
  - `database_host`
  - `database_name`
  - `database_schema`
  - `current_release_id`
  - `setup_state`
  - `initialized_at`
  - `last_health_check_at`
  - `last_health_status`
  - `created_at`
  - `updated_at`
- Suggested statuses:
  - `pending`
  - `provisioning`
  - `ready`
  - `degraded`
  - `archived`
- Notes:
  - `database_schema` gives us a place for lower-risk rehearsal or future shared-db variants, even though database-per-tenant remains the production target

### `tenant_releases`
- Purpose: deployment history for each environment
- Columns:
  - `id`
  - `tenant_environment_id`
  - `release_version`
  - `app_commit_sha`
  - `web_commit_sha`
  - `deployed_by`
  - `deployed_at`
  - `release_notes`
- Notes:
  - supports roll-forward analysis and operational visibility

### `provisioning_jobs`
- Purpose: durable workflow orchestration
- Columns:
  - `id`
  - `tenant_id`
  - `tenant_environment_id`
  - `job_type`
  - `status`
  - `requested_by_operator_user_id`
  - `requested_at`
  - `started_at`
  - `completed_at`
  - `error_code`
  - `error_message`
  - `idempotency_key`
  - `payload_json`
  - `result_json`
- Suggested job types:
  - `provision_environment`
  - `deploy_release`
  - `issue_setup_token`
  - `suspend_tenant`
  - `resume_tenant`
  - `decommission_tenant`
- Suggested statuses:
  - `queued`
  - `running`
  - `succeeded`
  - `failed`
  - `canceled`

### `provisioning_job_events`
- Purpose: append-only progress log for each job
- Columns:
  - `id`
  - `provisioning_job_id`
  - `event_type`
  - `message`
  - `details_json`
  - `created_at`
- Notes:
  - keeps job progress inspectable without overloading the main job row

### `setup_tokens_issued`
- Purpose: control-plane record of tenant setup-token issuance
- Columns:
  - `id`
  - `tenant_environment_id`
  - `provisioning_job_id`
  - `issued_by_operator_user_id`
  - `issued_at`
  - `expires_at`
  - `delivered_via`
  - `redeemed_at`
  - `notes`
- Notes:
  - stores metadata only, not the raw token
  - tenant runtime keeps the hashed token in its own database

### `operator_audit_log`
- Purpose: append-only operator accountability trail
- Columns:
  - `id`
  - `operator_user_id`
  - `action_type`
  - `target_type`
  - `target_id`
  - `tenant_id`
  - `details_json`
  - `created_at`

## Key Relationships
- one `tenant` to many `tenant_domains`
- one `tenant` to many `tenant_environments`
- one `tenant_environment` to many `tenant_releases`
- one `tenant` or `tenant_environment` to many `provisioning_jobs`
- one `provisioning_job` to many `provisioning_job_events`
- one `tenant_environment` to many `setup_tokens_issued`
- one `operator_user` to many `operator_sessions`, `provisioning_jobs`, and `operator_audit_log` entries

## Minimum Constraints
- `tenants.slug` unique
- `tenant_domains.domain` unique for active bindings
- one primary domain per tenant
- one `(tenant_id, environment_key)` unique environment key
- one active operator session token hash per stored session row
- one idempotency key per job request when supplied

## First Migration Slice
1. `operator_users`
2. `operator_sessions`
3. `tenants`
4. `tenant_domains`
5. `tenant_environments`
6. `provisioning_jobs`
7. `provisioning_job_events`
8. `operator_audit_log`

## Deferred But Expected
- billing/subscription records
- support case linkage
- certificate/domain automation state
- release artifact catalog
- background worker leases and queue sharding
