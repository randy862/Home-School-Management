# Tenant Account And Subscription Settings Spec Package

Date: 2026-04-18

## Goal

Define the next tenant-facing commercial/account-management slice so a signed-in tenant user can:

- open an account menu from the app header
- view personal account details
- access change-password behavior
- see current subscription and billable-student usage
- initiate a subscription upgrade from inside the app
- optionally trigger account-lifecycle actions such as dormant and export requests

This note captures the intended UX, product rationale, and implementation plan so the next session can move directly into execution.

## Product Direction

The preferred UX is not a separate `Billing` or `Subscription` panel under `Administration`.

Instead, the tenant app should adopt a standard SaaS pattern:

- show a user account affordance in the top-right header
- make the signed-in username clickable, or pair it with an account/avatar icon
- open a small account menu when clicked
- provide a dedicated account view for profile, password, subscription, and account-lifecycle actions

This direction matches common high-quality SaaS behavior better than placing subscription controls under school administration screens.

Reasoning:

- account, password, and subscription actions are user/account concerns, not academic administration concerns
- users naturally look for profile, billing, and lifecycle actions in the header account menu
- a dedicated account view creates a clean home for future commercial features without cluttering school-management workflows

## UX Recommendation

### Header Entry Point

Replace or enhance the current `Signed in as ...` header text with a standard account affordance:

- clickable signed-in username
- optional avatar/account icon
- optional caret/menu indicator

Preferred behavior:

- clicking the username or avatar opens a small account menu

Suggested first menu items:

- `View Account`
- `Change Password`
- `Sign Out`

Possible later additions:

- `Billing History`
- `Manage Subscription`
- `Support`

### Account View

Selecting `View Account` should open a dedicated account surface.

Acceptable first implementation shapes:

- modal
- side drawer
- dedicated in-app page

Preferred shape:

- modal or drawer first, because it is quicker to add without introducing a new app-wide navigation destination

The account view should show:

- username
- role
- email if available
- password-management action
- current subscription plan
- included billable-student count
- current billable-student usage
- current billing period start/end if available
- upgrade CTA

Suggested plain-language summary:

- `Starter plan`
- `3 included billable students`
- `Currently 3 billable students`

When near or over the limit, the account view should show stronger contextual status copy and an upgrade CTA.

Example patterns:

- neutral: `You are using 2 of 3 included billable students.`
- warning: `You are using all 3 included billable students. Upgrade before adding another billable student.`
- over-limit/state-repair context if needed: `Your recorded usage is above the current plan limit. Upgrade to continue adding billable students.`

### Account Actions Section

The account view should also contain a secondary `Account Actions` section.

This is the right place for:

- `Make Account Dormant`
- `Request Data Export`

These actions should be visually secondary to subscription status and upgrade.

Recommended treatment:

- keep `Upgrade Subscription` as the primary action
- place dormant/export lower on the page
- require explicit confirmation for dormant
- describe consequences in plain language before confirmation

## Subscription Upgrade UX

### Product Decision

The preferred upgrade path is a custom in-app subscription-change flow, not a generic Stripe customer portal redirect.

The app should present:

- current plan
- available upgrade targets
- clear explanation of what changes
- a CTA that starts a custom subscription-change checkout/session flow

### Upgrade Entry Points

Primary:

- `Upgrade Subscription` button in the account view

Optional later secondary entry points:

- in-context warning banner when a write is blocked by subscription scope
- usage summary warning when the plan is full

### Upgrade Flow

First-release intended flow:

1. User opens account menu.
2. User selects `View Account`.
3. User sees current plan and usage.
4. User clicks `Upgrade Subscription`.
5. App opens a focused upgrade experience showing available higher plans only.
6. User chooses the target plan.
7. App calls a control-plane route that creates a custom subscription-change checkout/session.
8. User completes checkout.
9. Control-plane Stripe webhook updates the existing subscription record.
10. Tenant app reflects the upgraded plan and updated usage allowance.

### Upgrade Eligibility Rules

The tenant-facing upgrade UI should:

- show only plans above the current plan
- avoid offering lateral or downgrade choices in the first pass unless we intentionally support them
- explain the target plan in billable-student terms

Examples:

- Starter tenant can upgrade to `Extra Credit`
- Extra Credit tenant can upgrade to `Valedictorian`
- Valedictorian likely has no higher plan in current catalog

### Blocked-Write Follow-Through

The existing limit error text already instructs the user to upgrade.

Follow-up product improvement:

- when the backend returns the subscription-limit error, the frontend should present a richer UI than a plain alert
- that UI should include a direct `Upgrade Subscription` CTA

This is a strong follow-up slice after the account view exists.

## Account View Information Architecture

Recommended first layout:

### Section 1: Profile

- username
- role
- email
- `Change Password`

### Section 2: Subscription

- current plan name
- base price if we want to show it
- included billable students
- current billable students
- current overage students if relevant
- billing period start
- billing period end
- `Upgrade Subscription`

### Section 3: Account Actions

- `Make Account Dormant`
- `Request Data Export`

### Section 4: Optional Future Additions

- billing history
- invoices/receipts
- payment method details
- support contact

## Recommended Authorization Rules

Not every signed-in user should necessarily manage commercial/account actions.

First-pass recommendation:

- allow all signed-in users to open the account menu and view their own identity basics
- restrict commercial/account-lifecycle actions to tenant admins

Suggested first-pass gating:

- `View Account`: all authenticated users
- `Change Password`: all authenticated users for their own account
- `Upgrade Subscription`: admin only
- `Make Account Dormant`: admin only
- `Request Data Export`: admin only

If a non-admin opens the account view, they should still see identity details and change-password controls, but not privileged commercial controls.

## Backend Gap Summary

Current state:

- public signup exists
- public checkout session creation exists
- Stripe webhook intake exists
- operator-facing commercial detail exists in `/control/`
- dormant/reactivate/export actions exist in operator control-plane flows
- tenant runtime enforces billable-student limits

Missing tenant-facing capabilities:

- no authenticated tenant route to fetch account/subscription summary for the current tenant
- no tenant-facing account/profile route set
- no tenant-facing change-subscription route
- no tenant-facing dormant/export initiation route
- no tenant-facing account UI

This is not just a missing button. The tenant-side product surface and control-api endpoints need to be added deliberately.

## Implementation Plan

### Phase 1: Tenant Account Surface

Add tenant-app UX only, with read-only subscription/account display plus password action.

Scope:

- header account menu
- `View Account` modal/drawer
- current user identity display
- current subscription summary
- current billable-student usage summary
- `Change Password` action

Likely files:

- `web/index.html`
- `web/app.js`
- `web/styles.css`
- tenant runtime API route additions in `server/src/routes/`
- tenant runtime service/store additions as needed

### Phase 2: Tenant Commercial Read API

Add a tenant-authenticated API that returns the current tenant account/commercial summary.

Likely response should include:

- current user identity basics
- tenant id/environment id
- subscription id/status
- plan name/code
- included billable students
- current billable students
- current overage students
- billing period start/end
- dormant status
- whether the current user may manage subscription actions

Potential route shape:

- `GET /api/account`
- or
- `GET /api/account/subscription`

Recommendation:

- prefer a single `GET /api/account` response that can grow over time

### Phase 3: Change Password

If not already exposed in the right tenant-facing shape, add:

- authenticated self-service password change route
- account-view `Change Password` interaction

This should be treated as part of the same account surface, even if some backend support already exists elsewhere.

### Phase 4: Custom Upgrade Session Flow

Add a tenant-facing custom subscription upgrade flow backed by `control-api`.

Needed capabilities:

- fetch allowed upgrade targets for current subscription
- create an upgrade checkout/session for the current commercial subscription
- preserve linkage to the existing customer account and existing tenant
- update the same commercial subscription rather than creating a brand-new customer signup record

Likely control-plane additions:

- new authenticated tenant-commercial route family
- or a runtime-to-control-plane internal call that proxies through the tenant runtime

Important design constraint:

- this flow must mutate the existing subscription relationship, not create a second parallel subscription/account

Likely new route shapes:

- `GET /api/account/upgrade-options`
- `POST /api/account/upgrade-session`

Or, if split across services:

- tenant runtime route calls internal control-plane route using the existing internal auth pattern

### Phase 5: Dormant And Export Self-Service

After the account surface and upgrade flow work well:

- add tenant-admin dormant action
- add tenant-admin export request action

These should be clearly secondary and confirmation-driven.

## UX Best-Practice Conclusions

The chosen direction is aligned with common high-quality SaaS behavior.

Best-practice fit:

- header account entry is standard and discoverable
- account/profile view is the normal home for subscription and lifecycle actions
- upgrade CTA belongs near current usage and plan status
- dormant/export belong in a lower-priority account-actions area

This is preferable to burying subscription management under school administration screens.

## Next Session Starting Point

When work resumes, the next implementation session should begin with:

1. Decide whether the first account surface is a modal, drawer, or dedicated page.
2. Add the header account menu entry in the tenant app.
3. Add a tenant-facing `GET /api/account` backend route and response shape.
4. Render current subscription and billable-student usage in the new account view.
5. Add the `Upgrade Subscription` CTA placeholder in the account view.
6. Design and implement the custom upgrade-session backend flow after the account surface exists.

## Explicit Deferred Items

These are intentionally not part of the first slice unless needed:

- full Stripe customer portal integration
- downgrade handling
- invoice history UI
- payment method management UI
- deep billing-history reporting
- non-admin commercial self-service

## Current Conclusion

The next commercial UX slice should be:

- tenant header account menu
- account view
- subscription and usage visibility
- self-service password path
- custom upgrade-session flow

This is the recommended path for both user experience and long-term commercial product shape.
