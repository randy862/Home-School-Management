# Workplan

## Milestone 1: Foundation (Complete)
- Owner: CEO Orchestrator
- Goal: Establish project operating model and baseline app scaffold
- Workstreams:
  - [x] Governance docs and folder structure
  - [x] Initial multi-agent roster and prompts
  - [x] Frontend MVP scaffold in `web/`

## Milestone 2: MVP Local-First App (Complete)
- Owner: Frontend Engineer
- Goal: Deliver a working local-storage MVP
- Workstreams:
  - [x] Student/subject/course/enrollment management
  - [x] Planning/calendar, attendance, and grade features
  - [x] Dashboard analytics and reporting views

## Milestone 3: Transitional SQL Bridge (Complete)
- Owner: Backend/API Engineer
- Goal: Prove backend persistence, migration mechanics, and initial auth-related state handling
- Dependencies: Milestone 2
- Workstreams:
  - [x] Analyze current state model from `web/app.js`
  - [x] Define transitional relational schema and constraints
  - [x] Scaffold migration and import scripts in `server/`
  - [x] Execute SQL import and validate row parity
  - [x] Implement API full-state sync endpoints (`GET/PUT /api/state`)
  - [x] Wire frontend persistence to API state sync with local fallback cache

## Milestone 4: Production Single-Tenant Platform (In Progress)
- Owner: CEO Orchestrator
- Goal: Rebuild the app as a production-ready single-tenant web platform on Debian, Apache, Node.js, and PostgreSQL
- Dependencies: Milestone 3
- Reference Docs:
  - `NOTES/target-architecture.md`
  - `NOTES/milestone-1-production-plan.md`
  - `NOTES/postgresql-schema-v1.md`
  - `NOTES/backend-auth-api-refactor-plan.md`
  - `NOTES/postgres-repository-transition-plan.md`
  - `NOTES/school-day-hub-spec-package.md`
- Workstreams:
  - [x] Define target architecture and deployment topology
  - [x] Define Milestone 1 scope, sequencing, and acceptance criteria
  - [x] Define PostgreSQL schema direction for hosted runtime
  - [x] Choose backend session/auth approach and document endpoint contract
  - [x] Design first hosted domain-read APIs to replace more of full-state sync in production
  - [ ] Refactor backend toward PostgreSQL-backed repositories
  - [x] Refactor frontend login/bootstrap to use backend auth
  - [x] Create Debian/Apache deployment assets and runbooks
  - [x] Define PostgreSQL repository transition plan for hosted runtime
  - [x] Run staged production-readiness smoke and workflow checks

## Milestone 5: Multi-Tenant SaaS Foundation (Planned)
- Owner: CEO Orchestrator
- Goal: Introduce tenant-aware backend architecture and a control plane
- Dependencies: Milestone 4
- Workstreams:
  - [x] Add control-plane data model for tenants, domains, plans, and provisioning jobs
  - [x] Add tenant resolution and tenant database routing
  - [x] Add tenant bootstrap/provisioning workflow
  - [x] Define operator authentication/session contract separately from tenant auth
  - [x] Add operator-facing tenant management interface
  - [x] Add initial `control-api/` service scaffold and first route groups
  - [x] Implement first platform-admin mutation paths and operator bootstrap flow in `control-api/`
  - [x] Implement first queued-job execution and event logging in `control-api`
  - [x] Run tenant runtime migration/setup-token automation from queued jobs
  - [x] Propagate tenant setup completion back into control-plane environment state

## Milestone 6: Commercial SaaS Layer (Planned)
- Owner: Product Architect
- Goal: Add the public product, pricing, subscription, billing, and automated customer-signup layer on top of the hosted platform and control plane
- Dependencies: Milestone 4, Milestone 5
- Reference Docs:
  - `NOTES/saas-commercial-roadmap.md`
- Workstreams:
  - [ ] Define the commercial domain model for customers, plans, subscriptions, invoices/payment events, and billing states
  - [ ] Choose and document the recurring billing/payment provider
  - [ ] Build the public product and pricing pages
  - [ ] Build the subscription and checkout flow
  - [ ] Connect successful subscription state to automated tenant/environment provisioning
  - [ ] Add billing visibility to the Control Center
  - [ ] Define and implement delinquency, suspension, and payment-recovery rules

## Parallel Workstreams (Current)

1. CEO Orchestrator (owner: root governance docs)
   - Maintain production roadmap, milestone scope, and delivery sequencing
2. Product Architect (owner: `NOTES/`)
   - Define target architecture, PostgreSQL schema, and API boundary decisions
3. Backend/API Engineer (owner: `server/`)
   - Prepare auth/session design and first domain API refactor plan
4. Frontend Engineer (owner: `web/`)
   - Prepare frontend integration path away from full-state sync and browser-owned auth
5. QA & Release Agent (owner: `CHECKLISTS/`, `RUNBOOKS/`, `STATUS.md`)
   - Define production readiness checks and deployment validation path

## Active Next Actions

0. Dashboard refinement backlog.
   - [x] Capture a product/design refinement plan for a more polished, meaningful tenant Dashboard in `NOTES/dashboard-refinement-plan.md`.
   - [ ] When ready, start with the Dashboard Overview redesign slice: glanceable Today Snapshot, Student Health, Compliance Confidence, and improved gauge/card styling.
1. Complete Session 5 control-plane UI polish and naming cleanup.
   - [x] Review remaining technical labels and replace them with more business-facing language where appropriate.
   - [x] Improve hierarchy, spacing, and detail layout so audit, jobs, lifecycle views, and user management feel cohesive.
   - [ ] Recheck the main `/control/` flows on desktop and mobile after the latest sidebar and user-management pass using `CHECKLISTS/control-ui-smoke.md`, including the new stacked mobile table layout.
2. Complete the new operator-permission model end to end.
   - [x] Add operator profiles, explicit permissions, and a user-management workspace in `/control/`.
   - [x] Replace coarse control-plane mutation guards with permission-aware route checks.
   - [x] Add more operator safeguards and recovery ergonomics.
   - [x] Run a live staged permission-validation matrix across read-only, customer/environment, operations, and user-admin accounts, including self-service password changes.
   - [x] Decide whether non-user-admin operators should see the `User Management` workspace in read-only mode or have it hidden entirely.
   - [x] Hide `User Management` for operators without `manageUsers` in both the UI and backend reads, then revalidate staging.
3. Consider a broader support/operations history view on top of the new audit API after the main UI pass.
4. Keep hosted browser smoke validation as the regression gate after each major backend-boundary slice.
   - [x] Run a broader staged hosted-app smoke pass against the currently served runtime.
   - [x] Fix smoke-discovered hosted create-route and calendar export regressions on `APP001`.
   - [x] Correct the staged tenant-app runtime so the served app actually loads tenant `PGOPTIONS` and the intended tenant schema instead of PostgreSQL `public`.
   - [x] Add and validate a broader staged hosted workflow script that exercises real admin and student flows beyond API reachability.
   - [x] Rerun the scripted release gate after the broader hosted workflow pass.
5. Continue backend/platform hardening and legacy bridge retirement.
   - [x] Isolate the transitional `/api/state` bridge behind explicit legacy module naming in the server and frontend.
   - [x] Wrap the remaining local-only merge/backfill bootstrap logic behind explicit legacy-bridge helpers in `web/app.js`.
   - [x] Stop running startup legacy attendance backfill in hosted mode.
   - [x] Centralize legacy bootstrap-admin checks so hosted-capable UI code no longer carries scattered default-admin logic.
   - [x] Rename bootstrap-admin frontend helpers/constants so they are explicitly marked as legacy/local-only.
   - [x] Extract local-only plan mutation helpers so plan submit flow separates hosted writes from legacy bridge writes.
   - [x] Extract local-only school-year and quarter mutation helpers so schedule settings forms separate hosted writes from legacy bridge writes.
   - [x] Extract local-only daily-break and holiday mutation helpers so schedule admin flows separate hosted writes from legacy bridge writes.
   - [x] Standardize remaining local delete paths behind explicit legacy helper names for admin actions.
   - [x] Extract local-only create/update helpers for core admin forms so hosted and legacy mutation paths read consistently.
   - [x] Extract local-only attendance and grade mutation helpers so instructional record flows read consistently too.
   - [x] Extract local-only grade-settings helpers so grading settings read consistently too.
   - [x] Standardize the remaining local plan delete path behind an explicit legacy helper.
   - [x] Start server-side repository/service hardening with a grading service boundary.
   - [x] Continue server-side repository/service hardening with a calendar service boundary.
   - [x] Continue server-side repository/service hardening with a curriculum service boundary.
   - [x] Continue server-side repository/service hardening with the records domain after grading, calendar, and curriculum.
   - [x] Decide whether the next item 4 slice should be repository extraction or staged smoke validation of the new service-boundary backend shape.
   - [x] Decide that repository extraction is the next item 4 slice after the service-boundary smoke pass.
   - [x] Start Phase 4 repository extraction with a grading repository boundary.
   - [x] Continue Phase 4 repository extraction with a records repository boundary.
   - [x] Validate the new grading/records repository boundaries on staged hosted runtime after deployment.
   - [x] Continue Phase 4 repository extraction with a calendar repository boundary.
   - [x] Continue Phase 4 repository extraction with a curriculum repository boundary.
   - [x] Validate the new calendar/curriculum repository boundaries on staged hosted runtime after deployment.
   - [x] Reassess whether additional shared repository cleanup is worth doing before moving to item 5.
   - [x] Decide that additional shared repository cleanup is lower value than release-process hardening unless a concrete backend risk appears.
6. Start item 5 release and recovery hardening.
   - [x] Rewrite `RUNBOOKS/hosted-deployment.md` to match the actual staged deployment topology and recovery experience.
   - [x] Add a concise staged release checklist and rollback checklist derived from the new runbook.
   - [x] Add a control-plane recovery/runbook companion for queued job failures and operator-side incident response.
   - [x] Add a short-form control-plane incident checklist for faster operator triage.
   - [x] Decide that the current runbooks and checklists are sufficient for the first item 5 checkpoint.
   - [x] Add repeatable workstation validation hooks for the hosted smoke pass and combined release gate.
   - [x] Run the new staged release gate end to end against the live hosted app and control plane.
   - [x] Rehearse one real staged rollback path and revalidate the environment through the same scripted release gate.
7. Final staged readiness assessment.
   - [x] Run the current validation hooks as written without relying on ad hoc memory.
   - [x] Confirm app/control services are healthy and review recent journals for unresolved blockers.
   - [x] Produce a current staged go/no-go call with residual risks.
8. Production cutover planning and checklist hardening.
   - [x] Add a production-specific cutover runbook on top of the staged deployment guide.
   - [x] Add a short-form production cutover checklist.
   - [x] Add an explicit production-cutover worksheet for owners, target host/path/TLS decisions, secrets/config confirmation, and the first cutover window.
   - [x] Fill in the named owner assignments for the first cutover window.
   - [ ] Fill in real owner assignments, target hostname/TLS details, and production secret/config confirmations for the first actual cutover window.
9. Pre-production instructional-hour accuracy update.
   - [x] Decide to keep attendance as present/absent instead of adding partial-day attendance.
   - [x] Define actual daily instructional minutes as a per-student, per-course, per-date override model.
   - [x] Define same-day schedule cascading that updates later displayed times without mutating the recurring plan.
   - [x] Add backend persistence and API support for actual instructional minutes.
   - [x] Add daily calendar editing for actual instructional minutes in whole minutes.
   - [x] Validate the staged deploy path, release gate, and hosted workflow including actual instructional minute CRUD.
   - [x] Do a hands-on staged browser review of the day-view editing UX and downstream hour displays before resuming production cutover work.
10. Prepare the next post-cutover major workstream: the commercial SaaS layer.
   - [x] Capture the public product, pricing, checkout, automated provisioning, billing, and billing-aware control-center vision in a dedicated roadmap note.
   - [x] Define the first implementation-ready commercial domain model and acceptance criteria.
   - [x] Capture the first implementation-ready spec package for subscription lifecycle, checkout flow, provisioning handoff, and landing-page structure.
   - [x] Decide that Stripe Checkout is the recommended first payment path for the commercial SaaS slice.
   - [x] Define the first implementation-ready backend schema and public API contract for the commercial SaaS slice.
   - [x] Finalize the first public monthly plan set around billable students instead of users.
   - [x] Define exact billable-student, dormant, and cancellation-export policy language for implementation.
   - [ ] Decide the first-release public-site hosting/runtime approach.
   - [ ] Decide whether launch remains monthly-only or adds annual billing.
   - [x] Implement the first control-plane commercial migration, billable-student tracking model, and public plan API.
   - [x] Add operator-facing commercial API support for subscription detail, dormant/reactivate actions, cancellation-export requests, and related audit/lifecycle wiring.
   - [x] Implement the operator-console commercial UI on top of the new control-plane subscription endpoints.
   - [x] Deploy the live staged `/control/` Commercial UI and confirm the hosted control path is serving the new workspace.
   - [x] Reconcile the staged control-plane schema on `APP001` with the deployed commercial billing-policy code by applying `005_subscription_billing_policy.sql`.
   - [x] Run a live staged Commercial smoke pass using a temporary smoke-test commercial record.
   - [ ] Configure staged Stripe test keys, Starter/Growth price IDs, and webhook signing secret on `APP001`.
   - [ ] Expose the staged hosted path publicly over HTTPS by mapping firewall `443` to `WEB001`.
   - [ ] Acquire and apply a valid TLS certificate for the staged public hosted/webhook URL on `WEB001`.
   - [ ] Validate one real Stripe test-mode checkout session and webhook flow end to end against the staged commercial stack.
   - [x] Validate that Starter-plan enforcement blocks the 4th billable student on a clean staged tenant (`stripe-test2`) and isolate `stripe-test1` as bad-state tenant drift rather than a global Starter-plan failure.
   - [x] Clean up the drifted staged tenant `stripe-test1` after confirming `stripe-test2` as the clean enforcement baseline.
   - [x] Capture the next tenant-facing commercial UX slice in `NOTES/tenant-account-subscription-settings-spec-package.md`, covering:
     - header account menu
     - account/profile view
     - password-management entry
     - subscription and billable-student visibility
     - custom in-app upgrade-session flow
     - dormant/export actions in the account area
   - [x] Implement the first tenant-facing account menu and account-view shell in the hosted app.
   - [x] Add a tenant-facing authenticated account/commercial summary API for current user, subscription, and billable-student usage.
   - [x] Implement the first tenant-facing in-app subscription-upgrade flow for existing subscriptions on top of the current Stripe subscription record instead of routing upgrades through new-account public signup.
   - [x] Split tenant `Account Options` into its own surface and wire the first real dormant/export request mutations through the tenant runtime and control plane.
   - [x] Add the first lightweight billing/activity history section to the tenant account view.
   - [x] Add tenant self-service reactivation plus dormant-aware account-option button states so dormant tenants can make the account active again.
   - [x] Display a support-friendly `Site ID` in tenant account settings using the canonical tenant identifier.
   - [x] Add tenant-facing `Valedictorian` usage and overage messaging in `Account` and `Upgrade Subscription` so the plan reads from the configured included-student and overage policy.
   - [x] Sync `Valedictorian` overage student counts into Stripe from tenant billable-count refreshes using a recurring overage subscription item/quantity model.
   - [x] Run the staged `Valedictorian` overage proof on `pj-cool`, wire a dedicated staged Stripe overage `price_...` id for `large_monthly`, and confirm Stripe subscription plus invoice-preview behavior for `12` billable / `1` overage student.
   - [x] Update `Valedictorian` pricing to `$15.99/month`, `11` included billable students, and `$0.99` per billable student above `11`; use `NOTES/valedictorian-pricing-change-plan.md` as the implementation and rollout checklist.
   - [x] Expose existing Control lifecycle jobs (`suspend_tenant`, `resume_tenant`, `decommission_tenant`) through the operator `Queue Operation` form and document the tenant housekeeping model in `NOTES/tenant-housekeeping-lifecycle.md`.
   - [x] Add a dedicated tenant detail lifecycle action panel with stronger confirmation UX for suspend/resume/decommission and disabled placeholders for export/purge.
   - [x] Add first internal tenant archive job metadata and Control archive visibility without enabling destructive purge.
   - [ ] Add real tenant archive artifact generation (`pg_dump`/encrypted storage), purge eligibility rules, and eventual purge jobs with typed confirmation and Super Admin guardrails.
   - [x] Capture the recommended next-session handoff for email foundation first, setup-link email second, and SaaS-page polish after that in `NOTES/email-and-saas-next-session-handoff.md`.
   - [x] Define the outbound email delivery plan for hosted/commercial flows, including provider choice, environment secrets, templates, audit expectations, and staged-vs-production send behavior.
   - [x] Replace setup-token-on-screen behavior with emailed activation/setup links as the default onboarding path for newly provisioned tenants.
   - [x] Capture the SaaS-page follow-up polish plan in `NOTES/saas-page-polish-follow-up-plan.md`.
   - [ ] Add tenant-facing password-reset email flow instead of relying only on signed-in password changes.
   - [ ] Add system email handling for subscription lifecycle notices, billing/support notifications, and export/offboarding updates.
   - [ ] Deploy and run a full authenticated hosted smoke pass covering tenant account view, account options, password change, upgrade, dormant, reactivation, and export flows after the latest self-service update.
11. Prepare the next hosted-app workflow consolidation slice: the School Day hub.
   - [x] Define the School Day hub concept as an implementation-ready spec package.
   - [x] Decide that the first version should be a hub model, not the full persisted execution layer.
   - [x] Define the phased rollout from shared shell to inline grade entry, attendance integration, and execution-layer-ready daily overrides.
   - [x] Confirm the first-pass shared filter set for the initial hub rollout and keep attendance in the dedicated `Attendance` tab rather than adding a separate row-level inline attendance action first.
   - [x] Implement the `School Day` sidebar entry, page shell, shared date context, and internal tabs.
   - [x] Implement the first hosted `School Day` hub behaviors:
     - shared student/subject/course filters and quick filters
     - `Daily Schedule`, `Attendance`, and `Grades` tabs
     - inline grade entry from schedule rows
     - same-day instructor/start-time/minutes editing plus reset/reorder actions
     - student summary cards and side-by-side overview support
   - [ ] Decide whether the next `School Day` slice should focus on ordered schedule-block cutover, deeper execution-layer persistence, or additional daily workflow ergonomics.
12. Prepare the ordered schedule-block replacement for fixed-time lunch and breaks.
   - [x] Define the ordered schedule-block model as an implementation-ready spec package.
   - [x] Decide that lunch, recess, and other breaks should behave like orderable schedule items but remain non-academic blocks under the hood.
   - [ ] Define schema and API changes for reusable schedule blocks and student scheduled items.
   - [ ] Update Student Enrollment to allow assigning and ordering schedule blocks.
   - [ ] Cut Calendar and School Day day-generation over to ordered schedule blocks.
   - [ ] Plan and execute migration away from fixed-time daily lunch/break scheduling.
13. Plan the next Dashboard enhancement slice around operational and risk-oriented analytics.
   - [x] Decide that the next dashboard additions should prioritize actionable operational analytics over adding more undifferentiated historical widgets.
   - [x] Define the implementation-ready dashboard enhancement spec package for:
     - Completion Today
     - Needs Attention Today
     - Instruction Hour Pace
     - Grade Risk / Course Watchlist
     - Missing Grades
   - [x] Decide that Dashboard should add internal tabs grouped by purpose before stacking more gauges onto one page.
   - [x] Implement the dashboard tab shell (`Overview`, `Execution`, `Performance`, `Compliance`).
   - [x] Implement the `Execution` tab with Completion Today, Needs Attention Today, and Missing Grades.
   - [x] Implement Instruction Hour Pace and Grade Risk / Course Watchlist on the new tabbed dashboard.
   - [x] Group `Administration > Workspace Configuration > Dashboard Visibility` by `Execution`, `Performance`, and `Compliance` rather than adding nested configuration tabs.
   - [x] Make all non-`Overview` dashboard gauges optional and persist those hosted workspace settings correctly.
   - [x] Tune the default dashboard visibility so the first operational/risk gauges start on while denser trend/history extras start off until explicitly enabled.
   - [x] Add the first drill-down links from Dashboard into `School Day` for open-work follow-through across `Execution`, key `Performance` views, and key `Compliance` views.
   - [x] Add a lightweight `School Day` return path back to the originating Dashboard tab after a drill-down.
   - [ ] Decide the next dashboard follow-up after the shipped tabbed operational slice, including whether to deepen drill-downs further, add cross-links into `Grades`/`Reports`, or expand compliance reporting.
