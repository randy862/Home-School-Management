# Session Handoff

Date: 2026-07-11

## Context

Home lab production polish and AWS commercial production migration carry-forward.

## Current State

- Home lab production is current at `https://mitchell.navigrader.com/`.
- Home lab WEB001 serves `styles.css?v=202607111330` and `app.js?v=202607111330`.
- Password recovery/login refresh, tenant-aware reset URLs, dashboard gauges, Grade Search filter/layout, Course minutes/day UI, attendance-driven automatic excusals, School Day gap cursor fix, and Compliance hours projection line fix are implemented.
- K-12 grade-level availability is deployed to home lab: student grade dropdowns, compact course/class grade-level multi-selects with `All`, course-table Grade column, enrollment filtering by student grade, report Grade Level columns, backend normalization, and tenant migration `033_course_grade_levels.sql`.
- Configured Courses now has a compact Grade column filter (`All`, `K`-`12`); courses marked `All grades` remain visible under each grade filter.
- School-year scoped enrollments are deployed to home lab: course/class/schedule-block assignments carry `school_year_id` and student grade snapshot via tenant migration `034_school_year_scoped_enrollments.sql`; Schedule/Student/report views filter by selected Academic Year; School Years has a `Start Next School Year` helper that advances active student grades without copying enrollments.
- Marking a student absent automatically excuses that student's scheduled/open classes for the date without generating duplicate Flex Blocks; user confirmed the fix in home lab and AWS.
- AWS APP001/WEB001 were deployed from `saas-modern-redesign`; AWS still needs the latest validated home lab assets and migrations `033`/`034`.
- AWS SQL001 has tenant/runtime migrations through `032` and control-plane migrations through `012`; tenant/runtime migrations `033` and `034` are pending.
- Restored Mitchell validation tenant is mapped to `mitchell-aws-validation.navigrader.com`; final data sync from home lab `tenant_mitchell_family` to AWS `tenant_mitchell_aws_validation` completed and row counts matched.
- Temporary MAINT001 NAT route/security-group/source-destination cleanup was completed; Linux IP forwarding and MASQUERADE are off, and APP001 egress to Stripe/Postmark times out again.
## Subscription/Stripe Readiness

- Public SaaS plan endpoint is live at `https://aws-validation.navigrader.com/control-api/api/public/plans`.
- Stripe test products/prices and AWS validation webhook endpoint were created in Stripe test mode.
- AWS `commercial_plans` is mapped to Stripe test product/price IDs for Starter, Growth, and Co-op Pro.
- AWS `/etc/home-school-management/hsm-control-api.env` has Stripe test secret/publishable/webhook values plus explicit checkout success/cancel URLs; secrets are not in repo.
- AWS `CONTROL_WORKER_ENABLED=true`, `CONTROL_SETUP_SYNC_ENABLED=true`, and `CONTROL_DEPLOYMENT_ENABLED=false` for the rehearsal.
- AWS public checkout now creates Stripe test checkout sessions; latest probe returned HTTP 201 and created checkout/customer/subscription rows.
- Browser checkout reached tenant setup email for `https://aws1.navigrader.com/#setupToken=...`; first admin setup and login succeeded.
- AWS tenant `aws1` is active with schema `tenant_aws1`, ready/initialized control metadata, active subscription, and setup email sent.
- GoDaddy A record `aws1 -> 18.188.35.157` and TLS for `aws1.navigrader.com` are working without laptop or APP001 hosts overrides.
- AWS go-live egress decision and DNS cutover rehearsal/rollback steps are documented in the AWS/cutover runbooks; keep `aws1` and related Stripe test records as rehearsal evidence.
- GoDaddy explicit `mitchell` CNAME has TTL 600 and should remain pointed to the home lab; use wildcard/new-tenant DNS for AWS SaaS tenants.

## Next Action

Next technical action is to sync the validated grade-level/reporting/course-grade-filter plus school-year scoped enrollment release to AWS, including tenant migrations `033` and `034`, then continue go-live egress/DNS planning with `mitchell.navigrader.com` staying on the home lab.

## Risks

- Keep Postmark, database, Stripe, smoke credentials, and runtime env files out of the repo.
- `aws-maint` uses public IP `3.138.124.78`; update local SSH config if `MAINT001` restarts without a stable Elastic IP.
- Do not leave temporary egress/NAT in place unintentionally before go-live; current temporary NAT cleanup is complete. Production go-live should use the managed NAT Gateway plan, not MAINT001 NAT.
- Control deployment is intentionally disabled for rehearsal; provisioning prepares schema/runtime metadata and setup token flow without pushing a per-tenant runtime over the shared APP001 service.
- Untracked scratch screenshots/icons and `tmp/` remain local and should stay out of commits.
- Home lab rollback ids include `/home/debian/rollback/hsm/grade-levels-20260711100422/`, `/home/debian/rollback/hsm/report-grade-columns-202607111115/`, `/home/debian/rollback/hsm/school-year-scoped-enrollments-202607111300/`, and `/home/debian/rollback/hsm/course-grade-filter-202607111330/web001/web.tgz`.

## Rollback Pointers

- Home lab course minutes/day: `/home/debian/rollback/hsm/course-minutes-day-202605291000/`
- Home lab web fixes include the rollback ids listed above plus older roots in `STATUS.md`.
- AWS latest branch deploy: `/home/admin/rollback/hsm/hsm-aws-1272ab3-202605291805/`
- AWS latest WEB001 fix: `/home/admin/rollback/hsm/school-day-excused-flex-202605291610/web001/`
- AWS runtime/mail/TLS/Mitchell validation rollback roots are recorded in `STATUS.md`.
- AWS Stripe env rollback: `/home/admin/rollback/hsm/aws-stripe-readiness-20260530012023/app001/`
- AWS commercial plan rollback: `/home/admin/rollback/hsm/aws-stripe-readiness-20260530012105/sql001/`
- AWS worker rehearsal rollback: `/home/admin/rollback/hsm/aws-stripe-worker-rehearsal-20260530015453/app001/`
- Current temporary NAT rollback: `/home/admin/rollback/hsm/temp-nat-maint001-20260530012439/`
- AWS1 rollback roots: TLS `/home/admin/rollback/hsm/aws1-validation-tls-20260530020648/web001/`, hosts `/home/admin/rollback/hsm/aws1-app-hosts-override-20260530021432/app001/`, hosts cleanup `/home/admin/rollback/hsm/aws1-app-hosts-final-cleanup-20260531010706/app001/`, tenant `/home/admin/rollback/hsm/aws1-tenant-active-20260530021544/sql001/`
- Mitchell live domain alias rollback: `/home/admin/rollback/hsm/aws-live-mitchell-domain-20260530202356/sql001/control-domain-before.sql`
- Mitchell live TLS rollback: `/home/admin/rollback/hsm/mitchell-live-tls-20260530202600/web001/`
- Final Mitchell data sync rollback: `/home/admin/rollback/hsm/aws-final-mitchell-data-sync-20260601120000/sql001/`

## Validation

- Local grade-level feature checks passed: `node --check web/app.js`, `node --check server/src/services/curriculum-service.js`, `node --check server/src/repositories/postgres/curriculum-repository.js`, `node --check server/src/routes/admin-routes.js`, and `git diff --check`.
- Home lab grade-level/reporting deploy checks passed: migration `033`, APP001/WEB001 health, public `/health`, and public HTML references `styles.css?v=202607111040` plus `app.js?v=202607111115`.
- Home lab school-year scoped enrollment deploy checks passed: local/remote `node --check` for changed backend/frontend files, migration `034`, APP001 active/local health, WEB001-to-APP001 health, public Mitchell `/health`, public HTML references `app.js?v=202607111300`, clean API journal restart, and Mitchell data has zero blank `school_year_id` rows across enrollments/class enrollments/schedule blocks.
- Home lab course Grade filter deploy checks passed: local `node --check web/app.js`, `git diff --check`, WEB001 deploy/reload, public Mitchell `/health`, public HTML references `styles.css?v=202607111330` and `app.js?v=202607111330`.
- Post-deploy authenticated hosted smoke passed against `https://mitchell.navigrader.com`: login plus `/api/me`, subjects, courses, enrollments, school-year, quarters, holidays, daily-breaks, plans, grade-types, grading-criteria, attendance, and tests.
- User confirmed the compact grade-level dropdown and Course table Grade column look correct in the Mitchell tenant.
- AWS HTTPS `/health`, `/control-api/health`, and `/api/setup/status` returned HTTP 200; HTTP `/health` redirects to HTTPS.
- AWS password recovery reset-complete succeeded when temporary NAT was enabled.
- Temporary NAT cleanup completed; APP001 Stripe/Postmark/checkip egress times out again, while MAINT001 still has direct internet.
- Test checkout POST returned HTTP 201 with a Stripe test checkout session; DB rows show account `checkout_started`, checkout session `created`, and subscription `incomplete`.
- Full Stripe browser checkout produced setup email; user completed setup and logged into `aws1.navigrader.com`.
- AWS `aws1` setup status returns `initialized:true`; control-plane setup sync marked environment initialized and provisioning ready.
