# Validation

## Governance Optimization Validation

Run:

git status
git diff --stat

Confirm:

- Archive folder exists.
- Archived copies exist.
- New root context files exist.
- Root context files are shorter than archived versions.

## Hosted App Smoke

Use the existing hosted smoke checklist if present:

CHECKLISTS/hosted-smoke.md

Verify:

- Login/logout
- Admin user management
- Student CRUD
- Course CRUD
- Attendance
- Grades
- Dashboard drilldowns
- School Day workflows

## Control Plane Smoke

Use the existing control-plane smoke checklist if present:

CHECKLISTS/control-plane-smoke.md

Verify:

- Operator login
- Tenant creation
- Environment creation
- Provision job
- Runtime resolution
- Job/audit visibility

## Commercial Smoke

When Stripe staging is ready, verify:

- Checkout session
- Webhook receipt
- Subscription activation
- Tenant provisioning trigger
