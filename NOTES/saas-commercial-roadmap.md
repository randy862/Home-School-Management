# SaaS Commercial Roadmap

Date: 2026-03-31
Owner: Product Architect

## Purpose

Define the next major product workstream after current staging-readiness and pre-production feature hardening: the commercial SaaS layer that connects the hosted product to pricing, subscription signup, billing, automated tenant provisioning, delinquency handling, and billing-aware control-plane operations.

This roadmap is intentionally separate from the current staging/production-cutover package. The app and control plane now prove the hosted platform foundation. The next product step is turning that technical platform into a sellable, operable subscription service.

## Product Vision

The full product surface should eventually include:

1. Public application product site
   - product overview
   - features and benefits
   - pricing and plan comparison
   - signup entry point

2. Subscription and checkout flow
   - customer chooses a plan
   - enters organization/admin details
   - enters payment information
   - completes subscription

3. Automated tenant onboarding
   - successful subscription creates a customer record
   - tenant and environment are provisioned automatically
   - initial admin access is established
   - customer can log in to their tenant without manual operator intervention

4. Ongoing billing lifecycle
   - monthly subscription renewal
   - payment status tracking
   - failed payment handling
   - suspension/re-enable behavior tied to billing status

5. Billing-aware control center
   - operators can see plan, subscription state, payment status, delinquency, and billing history
   - support and operational actions can be informed by commercial state without mixing billing and runtime concerns

## Core Product Principle

Keep commercial state separate from technical runtime state.

Examples:
- a tenant can be technically healthy but commercially delinquent
- a subscription can be canceled while its runtime still exists pending suspension or archival
- billing failures should affect tenant access through explicit lifecycle rules, not by mutating unrelated runtime-health fields

This separation will make support, reporting, and automation much easier to reason about.

## Major Domains

### 1. Public Product Experience

Purpose:
- explain the product
- present plans and pricing
- convert visitors into subscribers

Likely pages:
- home/product page
- features page
- pricing page
- checkout/signup page
- optional FAQ/contact page

### 2. Customer and Subscription Domain

Purpose:
- represent the commercial customer independently from the hosted runtime

Likely entities:
- customer account
- billing contact
- subscription
- subscription plan
- invoice/payment event
- billing status

Baseline states to support:
- trialing
- active
- past_due
- unpaid
- canceled
- suspended

### 3. Payment Integration Domain

Purpose:
- collect payment details
- process recurring billing
- consume payment status events

Likely responsibilities:
- checkout session creation
- subscription activation
- webhook/event intake
- renewal/failure/cancellation handling
- invoice/payment reconciliation

### 4. Automated Provisioning Domain

Purpose:
- turn a successful commercial signup into a ready customer tenant

Likely flow:
1. customer completes checkout
2. billing state becomes provisionable
3. control plane creates tenant + environment + initial provisioning job(s)
4. customer receives access path and setup/admin onboarding

### 5. Billing Enforcement Domain

Purpose:
- connect subscription state to tenant availability

Examples:
- active subscription: tenant remains enabled
- failed payment grace window: tenant remains active but flagged
- delinquent after threshold: tenant is suspended
- payment restored: tenant resumes

This should integrate with the lifecycle actions already built in the control plane.

### 6. Control Center Billing Operations

Purpose:
- let platform operators understand both technical and commercial status

Likely additions to `/control/`:
- plan and subscription columns on customers/environments
- billing detail page/panel
- payment status and delinquency visibility
- suspension reason visibility
- manual override / support notes later if needed

## Recommended Implementation Phases

### Phase 1: Commercial Domain Design

Definition:
- define customer, subscription, plan, payment-event, and billing-status models
- define lifecycle rules that connect billing to tenant suspension/resume
- define what data belongs in the control plane versus a separate billing boundary

Deliverables:
- domain note
- schema direction
- billing-state definitions
- provisioning trigger definitions

### Phase 2: Payment Provider Integration

Definition:
- choose and integrate a recurring billing provider

Likely choice:
- Stripe or similar

Deliverables:
- provider decision
- checkout/session design
- webhook/event handling design
- local/staging test strategy

### Phase 3: Public Product and Pricing Site

Definition:
- build the public-facing marketing/product pages and pricing UX

Deliverables:
- product landing page
- pricing/subscription page
- signup entry flow

### Phase 4: Paid Signup to Tenant Provisioning

Definition:
- connect successful subscription state to automated tenant creation and onboarding

Deliverables:
- billing-to-provisioning trigger
- customer account creation
- automated tenant/environment setup
- initial admin onboarding path

### Phase 5: Billing-Aware Control Center

Definition:
- extend `/control/` with commercial visibility and support operations

Deliverables:
- billing status surfaces
- subscription detail view
- delinquency / suspension indicators

### Phase 6: Billing Enforcement and Recovery

Definition:
- apply business rules when payment succeeds, fails, or is restored

Deliverables:
- grace-period rules
- suspension/resume automation
- operator override/recovery guidance

## Pre-Implementation Questions

Before implementation, confirm:

1. Payment provider choice
2. Whether there is a trial period
3. Whether setup is immediate after payment or after additional confirmation
4. How delinquency/grace periods should work
5. Whether the public product site lives with the app host or separately
6. Whether `/control/` remains on the same host/path in production

## Recommendation

Treat this commercial SaaS roadmap as the next major program after the current pre-production application changes and production-cutover specifics are settled.

Do not mix it into the current production cutover checklist prematurely.

Recommended sequencing:
1. finish current product changes that must land before production
2. complete production-cutover specifics when ready
3. then begin the commercial SaaS roadmap with Phase 1 domain design

## Initial Definition of Done

This roadmap is ready to start when:
- production-cutover planning is specific enough for the first live hosted rollout
- the app and control plane remain stable under the current release gate
- the team is ready to shift from “platform readiness” to “commercial SaaS enablement”
