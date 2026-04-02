# SaaS Implementation Spec Package

Date: 2026-04-02
Owner: Product Architect
Related: `NOTES/saas-commercial-roadmap.md`

## Purpose

Translate the commercial SaaS roadmap into an implementation-ready first package for:

- SaaS domain model
- subscription lifecycle
- checkout flow
- provisioning handoff
- first-page wireframe and content structure

This note is intended to be the build handoff for the first commercial SaaS session before code implementation begins.

## Product Goal

Allow a new customer to:

1. land on a public product page
2. understand plans and value quickly
3. choose a subscription
4. enter organization, owner, and payment details
5. complete checkout through Stripe
6. trigger automated tenant provisioning
7. receive access information and onboarding status without operator intervention

## Scope For The First Implementation Package

In scope:

- public marketing landing page
- pricing and plan comparison
- Stripe-based subscription checkout
- customer account owner capture
- successful-payment-to-provisioning trigger design
- customer-facing provisioning status page
- initial access-information handoff page
- control-plane commercial data model definition

Out of scope for this first package:

- advanced discounts and coupon campaigns
- annual contracts and invoiced enterprise billing
- full customer self-service billing portal UX
- affiliate/referral flows
- tax automation details
- multi-brand or reseller support
- full delinquency automation beyond baseline lifecycle definitions

## Core Principles

1. Commercial state stays separate from runtime health state.
2. Provisioning starts from trusted backend events, not browser redirect success alone.
3. Stripe Checkout is preferred over building a custom payment form first.
4. The first release should optimize for one reliable self-serve subscription path, not maximum plan complexity.
5. A customer should always have a visible provisioning or access status after payment, never a silent background process.

## SaaS Domain Model

### 1. Plan

Purpose:
- defines the commercial offer presented on the public site and used during billing

Fields:
- `id`
- `code`
- `name`
- `description`
- `billingInterval`
- `priceCents`
- `currency`
- `stripeProductId`
- `stripePriceId`
- `isPublic`
- `isActive`
- `sortOrder`
- `featureSummaryJson`
- `limitsJson`

Notes:
- `featureSummaryJson` stores landing-page bullets and comparison-table content
- `limitsJson` stores product constraints such as student count, storage, or support tier when those exist

### 2. Customer Account

Purpose:
- represents the commercial customer independently from the tenant runtime

Fields:
- `id`
- `accountName`
- `accountSlug`
- `status`
- `ownerFirstName`
- `ownerLastName`
- `ownerEmail`
- `ownerPhone`
- `billingEmail`
- `stripeCustomerId`
- `createdAt`
- `updatedAt`

Statuses:
- `lead`
- `checkout_started`
- `active`
- `past_due`
- `suspended`
- `canceled`

### 3. Subscription

Purpose:
- represents the recurring paid relationship tied to one customer account and one active plan

Fields:
- `id`
- `customerAccountId`
- `planId`
- `status`
- `stripeSubscriptionId`
- `stripeCheckoutSessionId`
- `currentPeriodStart`
- `currentPeriodEnd`
- `cancelAtPeriodEnd`
- `canceledAt`
- `trialEndsAt`
- `gracePeriodEndsAt`
- `createdAt`
- `updatedAt`

Statuses:
- `incomplete`
- `trialing`
- `active`
- `past_due`
- `unpaid`
- `canceled`

### 4. Billing Event

Purpose:
- stores normalized billing facts from Stripe webhooks for auditability and reconciliation

Fields:
- `id`
- `customerAccountId`
- `subscriptionId`
- `eventType`
- `eventSource`
- `stripeEventId`
- `stripeObjectId`
- `occurredAt`
- `payloadJson`
- `processedAt`
- `processingStatus`
- `processingError`

### 5. Provisioning Request

Purpose:
- bridges commercial readiness to control-plane tenant provisioning

Fields:
- `id`
- `customerAccountId`
- `subscriptionId`
- `targetPlanId`
- `requestedAt`
- `status`
- `triggerSource`
- `controlTenantId`
- `controlEnvironmentId`
- `controlJobId`
- `requestedDomainLabel`
- `resultAccessUrl`
- `resultSetupTokenIssued`
- `completedAt`
- `failureReason`

Statuses:
- `pending_billing_confirmation`
- `queued`
- `provisioning`
- `awaiting_customer_setup`
- `ready`
- `failed`
- `canceled`

### 6. Access Handoff

Purpose:
- records what access information was delivered to the customer and when

Fields:
- `id`
- `customerAccountId`
- `subscriptionId`
- `provisioningRequestId`
- `tenantUrl`
- `adminSetupMode`
- `setupToken`
- `setupTokenExpiresAt`
- `deliveredAt`
- `deliveryChannel`
- `lastViewedAt`

### 7. Relationship To Existing Control Plane

Mapping:
- `Customer Account` is the commercial parent
- control-plane tenant/environment remain the runtime/execution boundary
- `Provisioning Request` links commercial state to the existing tenant/environment/job model
- commercial suspension rules should call existing lifecycle actions rather than overload runtime state fields

## Subscription Lifecycle

### Primary Lifecycle

1. `lead`
   - visitor has not started checkout

2. `checkout_started`
   - plan selected and owner/account details captured
   - Stripe Checkout session created

3. `active`
   - Stripe confirms successful checkout and subscription activation
   - provisioning may begin

4. `provisioning`
   - control plane has received a provisioning request and queued job(s)

5. `awaiting_customer_setup`
   - tenant exists and access path is ready
   - customer still needs first-login or setup-token completion

6. `ready`
   - tenant is provisioned and customer has usable access

7. `past_due`
   - payment failure occurred but grace period is still open

8. `suspended`
   - grace period expired or manual support action suspended service

9. `canceled`
   - subscription ended and service is no longer commercially active

### Lifecycle Rules

- Browser success redirect does not activate provisioning by itself.
- Stripe webhook confirmation is the authoritative trigger for `active`.
- Only `active` or approved `trialing` subscriptions are provisionable.
- A provisioning failure does not cancel the subscription automatically; it moves the provisioning request to `failed` and requires retry/support handling.
- `past_due` does not immediately suspend runtime access.
- `suspended` should route through control-plane suspend actions.
- Payment restoration should route through control-plane resume actions.

### Baseline Grace-Period Recommendation

Recommended first rule set:

- `invoice.payment_failed` moves subscription to `past_due`
- grant a 7-day grace period
- if unpaid at grace-period end, move customer account to `suspended`
- if payment succeeds before grace-period end, return to `active`

## Checkout Flow

### UX Goal

Minimize friction while collecting the minimum information needed to:

- create the billing customer
- identify the primary account owner
- provision the tenant
- deliver access information

### Recommended First Flow

1. Visitor lands on public marketing page.
2. Visitor clicks a CTA such as `Start Subscription`.
3. Visitor selects a public plan.
4. Visitor enters:
   - organization/account name
   - desired subdomain or school slug if allowed
   - owner first name
   - owner last name
   - owner email
   - optional phone
   - billing email if different
5. Backend creates a pending customer account and Stripe Checkout session.
6. Visitor completes Stripe Checkout on Stripe-hosted UI.
7. Stripe redirects browser to a post-checkout status page.
8. Webhook confirms checkout/subscription state.
9. Backend creates provisioning request and queues control-plane provisioning.
10. Customer sees provisioning progress and final access details.

### Checkout Backend Requirements

- `POST /api/public/plans`
  - list public plans
- `POST /api/public/checkout/session`
  - validate selected plan and owner details
  - create or update pending customer account
  - create Stripe Checkout session
  - return redirect URL
- `POST /api/public/billing/webhook`
  - verify Stripe signature
  - process checkout and subscription events idempotently
- `GET /signup/success`
  - customer-facing post-checkout page
- `GET /signup/status/:token`
  - provisioning progress and access handoff page

### Stripe Requirements

Use:

- Stripe Checkout for subscription signup
- Stripe Customer records
- Stripe recurring subscriptions
- Stripe webhook events

Minimum event set:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

### Validation Rules

- plan must be public and active
- owner email must be unique enough to identify the account owner path
- requested slug must be normalized and availability-checked if self-selected
- duplicate successful checkout webhooks must not create duplicate tenants
- provisioning request creation must be idempotent per Stripe subscription and successful initial checkout

## Provisioning Handoff

### Trigger Point

Provisioning begins only after a trusted backend event confirms the subscription is provisionable.

Recommended first trigger:

- create provisioning request after `checkout.session.completed` plus successful subscription activation state

### Handoff Contract To Control Plane

The commercial layer should pass a normalized payload such as:

- `customerAccountId`
- `subscriptionId`
- `planCode`
- `accountName`
- `accountSlug`
- `ownerFirstName`
- `ownerLastName`
- `ownerEmail`
- `billingEmail`
- `requestedDomainLabel`
- `provisioningSource = subscription_checkout`

### Control-Plane Responsibilities

The existing control plane should then:

1. create tenant record
2. create default environment
3. queue provisioning job
4. generate setup token or initial admin onboarding path
5. expose job/environment state back to the commercial status page

### Commercial Layer Responsibilities

The new SaaS layer should:

1. store the customer/subscription records
2. create exactly one provisioning request per provisionable signup
3. poll or fetch provisioning state for customer-facing status
4. present final access info clearly when runtime is ready

### Failure Handling

If provisioning fails:

- customer sees `We are still preparing your account` or `Provisioning needs attention`
- provisioning request remains visible with support-safe messaging
- operator sees the linked customer, subscription, and failed control job in `/control/`
- retries should create either a linked retry job or a replayable provisioning action, but not duplicate commercial accounts

## First-Page Wireframe And Content Structure

### Page Goal

Move a visitor from curiosity to clear plan choice and subscription start with minimal distraction.

### Recommended First Page Sections

1. Hero
   - headline
   - one-sentence value proposition
   - primary CTA: `Start Subscription`
   - secondary CTA: `See Pricing`

2. Value Highlights
   - organized scheduling
   - attendance and grading
   - reporting and instructional-hour tracking
   - hosted setup with family/school access

3. Product Walkthrough
   - 3-step explanation:
     - subscribe
     - we provision your school workspace
     - sign in and start managing school

4. Pricing
   - 2 or 3 plans maximum for first release
   - monthly price
   - key features
   - CTA button on each plan

5. Trust And Practical Details
   - hosted by the platform
   - recurring billing handled securely by Stripe
   - onboarding/access delivered after provisioning completes

6. FAQ
   - what happens after payment
   - how long provisioning takes
   - what the customer receives
   - what happens if payment fails later

7. Final CTA
   - repeat plan-selection entry point

### First Page Copy Skeleton

Hero:

- Headline: `Home School Management, ready without the setup burden.`
- Subhead: `Choose a plan, complete checkout, and receive your own hosted school workspace with scheduling, attendance, grades, reports, and parent-ready organization tools.`
- Primary CTA: `Start Subscription`
- Secondary CTA: `Compare Plans`

Value Highlights:

- `Keep curriculum, schedules, attendance, grades, and reports in one place.`
- `Give your family or school a hosted system without managing servers or deployments.`
- `Move from signup to access through guided automated provisioning.`

Pricing Cards:

- `Starter`
- `Growth`
- `Support Plus`

Each card should include:

- price
- ideal customer
- feature bullets
- CTA

### First Page Layout Direction

- preserve the established Mitchell brand identity
- match the newer polished app/control visual style
- keep the page light, professional, and trustworthy rather than flashy
- optimize for one-page conversion first, with extra pages optional later

## Acceptance Criteria For The First Build Slice

### Public Site

- visitor can view a complete public product landing page
- visitor can review public plans and choose one
- plan metadata is not hard-coded in multiple places

### Checkout

- visitor can start a Stripe Checkout session from the public site
- account owner and organization details are captured before redirect
- selected plan maps cleanly to one Stripe price

### Billing Event Intake

- Stripe webhook signature is verified
- duplicate webhook deliveries are handled idempotently
- successful subscription activation produces one provisioning request

### Provisioning Handoff

- provisioning request is linked to customer account and subscription
- provisioning request can link to control-plane tenant/environment/job identifiers
- customer can view current provisioning state from a status page

### Access Handoff

- when provisioning is ready, the customer sees tenant URL and onboarding/access instructions
- if setup token is used, the handoff record includes issuance and expiry state

## Recommended Build Order

1. define database/storage shape for plans, customer accounts, subscriptions, billing events, and provisioning requests
2. choose where the public site and commercial backend live in the repo/runtime
3. create public plan API plus landing/pricing page shell
4. implement checkout-session creation endpoint
5. implement Stripe webhook intake and idempotent event persistence
6. implement provisioning-request creation and control-plane handoff
7. implement customer-facing status/access page
8. extend `/control/` with basic commercial visibility

## Immediate Open Decisions

1. Final public plan set and pricing
2. Whether to support monthly only at launch or monthly plus annual
3. Whether customer chooses subdomain during checkout or after provisioning
4. Whether setup uses a one-time setup token or a pre-created admin invite flow
5. Whether the public marketing site is served from the same host/runtime as the tenant app for the first release

## Recommendation

Proceed with:

- Stripe as the first payment provider
- Stripe Checkout as the first payment UX
- one public landing page with embedded pricing
- one primary subscription path
- webhook-confirmed automated provisioning
- customer-facing provisioning status and access handoff as part of the first release, not a later polish item
