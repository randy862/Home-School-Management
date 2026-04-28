# Subscription Billing Policy

Date: 2026-04-13
Owner: Product Architect
Related:
- `NOTES/saas-implementation-spec-package.md`
- `NOTES/saas-backend-schema-and-api.md`
- `NOTES/saas-commercial-roadmap.md`

## Purpose

Define the exact business policy and implementation rules for:

- public subscription tiers
- billable student counting
- dormant subscription handling
- cancellation export handling
- enforcement responsibilities across the tenant app and control plane

This note is intended to remove ambiguity before the next commercial SaaS implementation slice.

## Commercial Policy

### Plan Set

The first recommended public monthly plans are:

- `Starter`
  - price: `$9.99/month`
  - included billable students: `1-3`
- `Growth`
  - price: `$14.99/month`
  - included billable students: `4-10`
- `Co-op Pro`
  - price: `$15.99/month` base
  - overage: `$0.99` per billable student above `11`

### Billing Unit

The billing unit is `billable student`, not total tenant users.

Parent, operator, and other non-student user accounts do not affect subscription pricing in the first release.

### Exact Customer-Facing Billing Rule

A student counts toward billing when either of the following is true:

1. the student is currently enrolled in the tenant's current school year
2. the student is archived or from a previous year, but the tenant actively uses that student for attendance, grades, tests, or similar instructional records during the current billing period

Recommended customer-facing summary:

`Billing is based on students currently enrolled this school year, plus any archived students you actively use for attendance or grading during the current billing period.`

## Billable Student Definition

### Counts Automatically

A student is billable when:

- the student has at least one active enrollment in the tenant's current school year

### Also Counts By Usage

A student is also billable when the tenant creates or updates current-billing-period instructional records for that student, even if the student is not currently enrolled and would otherwise be treated as historical.

First-release instructional usage that should trigger billable status:

- attendance records
- grade/test records
- other future instructional records that represent active academic use rather than passive history retention

### Does Not Count By Itself

The following do not make a historical student billable by themselves:

- viewing prior-year data
- dashboard/report reads
- keeping historical student records stored in the tenant
- non-instructional metadata edits alone

### First-Release Simplification

For first implementation, treat the following write actions as billable-usage triggers for historical students:

- create attendance
- update attendance
- create test/grade
- update test/grade

## Current School Year Rule

The primary billing rule depends on the tenant's current school year.

Recommended implementation rule:

- a student counts under the base rule if the student has at least one active enrollment in the tenant's current school year

If no current school year is configured:

- do not silently fall back to counting every non-archived student
- allow the control plane to flag the tenant for operator review
- continue counting any students who trigger billable usage during the current billing period

## Dormant Subscription Policy

### Purpose

Dormant status allows a tenant to preserve its environment and historical reporting continuity during inactive school months without canceling and reprovisioning later.

### Entry Rule

Dormant can be chosen only after the current billing cycle ends.

It is not an immediate mid-cycle downgrade.

### Dormant Price

Dormant billing is `25%` of the tenant's normal monthly base subscription price.

Interpretation for the first release:

- `Starter`: `25%` of `$9.99`
- `Growth`: `25%` of `$14.99`
- `Co-op Pro`: `25%` of the `$15.99` monthly base price only

Recommended first-release rule for `Co-op Pro`:

- dormant billing does not include per-student overage charges while the tenant is dormant

### Dormant Tenant Behavior

While dormant:

- tenant data remains intact
- dashboards, reports, and historical school-year continuity remain available
- tenant provisioning is preserved
- subscription is not treated as canceled

Recommended first-release runtime behavior:

- dormant tenant remains accessible
- historical reads and reporting remain available
- creation of new academic activity should be blocked until reactivation

Recommended blocked actions during dormant:

- creating new attendance
- creating or updating grades/tests
- creating new planning/execution records tied to live school operations
- adding billable-student activity

## Cancellation Policy

### Cancellation Effect

Cancellation ends the commercial subscription but does not immediately imply data destruction.

### Paid Data Export

If a tenant cancels, offer a one-time paid export for `$19.99`.

### Export Scope

First-release export should produce CSV files for:

- students
- school years
- enrollments
- subjects
- courses
- attendance history
- grades/tests

### Export Policy

- export is a paid offboarding action, not automatic on cancellation
- export should be generated through an auditable control-plane job
- export output should be a downloadable bundle of CSV files
- export should not mutate tenant academic data

## Control-Plane Implementation Rules

### New Commercial Concepts

The control plane should track:

- tenant subscription plan
- subscription billing state
- dormant state
- billable-student count for the current billing period
- billable-student overage count where applicable
- cancellation export entitlement/request state

### Recommended Supporting Tables

Add durable auditability for why a student counted:

- `billable_student_periods`
  - one row per tenant, billing period, and student when the student becomes billable
- `billable_student_events`
  - records the reason a student became billable, such as:
    - `current_year_enrollment`
    - `attendance_write`
    - `grade_write`

Add cancellation export tracking:

- `cancellation_export_requests`
  - paid export request metadata
  - payment confirmation state
  - job id linkage
  - artifact status and expiration

### Billing Calculation Rule

For each billing period:

- count each student at most once
- mark a student billable if they satisfy enrollment-based billing
- also mark a student billable if they trigger billable-usage rules during the same billing period
- do not double count a student who matches both conditions

## Tenant-App Implementation Rules

### Write Enforcement

The tenant app must block academic write operations when:

- the tenant is dormant
- the tenant is suspended for billing reasons
- the requested write would exceed plan policy and the billing policy says to block additional billable growth

### First-Release Write Paths To Protect

At minimum, protect:

- attendance writes
- grade/test writes
- student creation when that would increase billable usage
- enrollment creation when that would create a new current-year billable student

### Historical Student Billing Trigger

When the app receives an attendance or grade write for a historical or archived student:

- allow the write only if commercial policy permits it
- emit or record a billable-usage signal to the control plane
- ensure the student is counted once for the current billing period

## UX / Messaging Rules

### Subscription Messaging

The product should consistently say `billable students`, not `users`, in customer-facing pricing copy.

### Dormant Messaging

When dormant:

- explain that the tenant is preserved
- explain that historical reporting remains available
- explain that new academic activity requires reactivation

### Cancellation Export Messaging

When canceled:

- offer the `$19.99` export clearly as a one-time offboarding option
- explain what CSV files are included

## First-Release Acceptance Rules

This policy is considered implemented correctly only when:

- pricing copy consistently uses `billable students`
- current-year enrollment-based billing works
- attendance/grade writes for historical students can trigger billable counting
- historical reads alone do not affect billing
- dormant can be selected only after a billing period ends
- dormant tenants keep history and reporting continuity without reprovisioning
- dormant tenants cannot perform blocked live academic writes
- canceled tenants can request a paid CSV export flow
- control-plane audit data can explain why a student counted during a billing period
