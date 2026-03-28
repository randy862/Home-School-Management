# Control-Plane Foundation

## Purpose
Define the first control-plane slice that will turn the hosted single-tenant deployment into a SaaS-capable platform.

## Immediate Goal
Keep the tenant-facing app stable while introducing a separate operator/control boundary for tenant lifecycle management.

## Phase 1 Control-Plane Scope
- create an operator-facing `admin/` application shell
- add a `control-api/` service boundary or module set
- define a control-plane PostgreSQL schema separate from tenant data
- track tenants, environments, status, provisioning timestamps, and operator audit actions

## Recommended First Entities

### `tenants`
- `id`
- `slug`
- `display_name`
- `status`
- `primary_domain`
- `database_name`
- `created_at`
- `updated_at`

### `tenant_domains`
- `id`
- `tenant_id`
- `domain`
- `is_primary`
- `created_at`

### `provisioning_jobs`
- `id`
- `tenant_id`
- `job_type`
- `status`
- `requested_by`
- `requested_at`
- `started_at`
- `completed_at`
- `error_message`

### `operator_users`
- `id`
- `username`
- `password_hash`
- `role`
- `created_at`
- `updated_at`

### `operator_audit_log`
- `id`
- `operator_user_id`
- `action_type`
- `target_type`
- `target_id`
- `details_json`
- `created_at`

## First Control-Plane Work Items
1. Add `admin/` repo scaffold for the operator UI.
2. Add `NOTES/control-plane-schema-v1.md`.
3. Define tenant provisioning workflow:
   - create tenant record
   - allocate database
   - run tenant schema migration
   - seed tenant admin
   - mark tenant active
4. Define the operator authentication model separately from tenant auth.

## Dependency on Tenant App Refactor
- The tenant-facing app should keep moving from full-state sync toward domain APIs before tenant provisioning is introduced broadly.
- Current hosted read bridge now covers users, students, subjects, courses, enrollments, school years, and quarters.
- Remaining write flows and remaining read domains should be migrated in slices so the control plane provisions stable tenant runtimes, not transitional ones.

## Guardrails
- Keep control-plane data out of tenant databases.
- Keep tenant-facing auth/session concerns separate from operator auth/session concerns.
- Prefer database-per-tenant for customer data and a separate control-plane database for provisioning metadata.
