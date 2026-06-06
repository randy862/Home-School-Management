# Current Status

Date: 2026-06-05

## Active Workstream

Home lab production polish and AWS commercial production migration.

## Current Focus

AWS commercial go-live is technically staged through Mitchell TLS/DNS prep and is paused while non-technical cutover prep is completed.

## Completed Recently

- Password recovery/login refresh and tenant-aware reset URLs are committed and deployed to home lab APP001.
- Attendance Search has `Start Date` and `End Date` filters.
- School Day Filters use one grouped `Scheduled Item` filter for Classes, Courses, and Schedule Blocks.
- Open Items Today excludes Past Due from count/text; Past Due is a separate detail gauge.
- Execution dashboard includes `Schedule Items Open` and `Past Due Schedule Items` gauges.
- Grade Search has grouped `Course/Class/Block`, anchored first on the second filter row.
- Curriculum Courses show `Minutes / Day`; saves convert minutes to existing internal `hoursPerDay`.
- Class metadata shows inherited course minutes/day duration.
- Marking a student absent automatically excuses scheduled/open classes without generating duplicate Flex Blocks; user confirmed home lab and AWS.
- School Day gap placement now honors the scheduling cursor when a later item has a start override, preventing stray earlier Flex Blocks.

## Production State

- Home lab production URL: `https://mitchell.navigrader.com/`
- Tenant app assets: `app.js?v=202606052116`, `styles.css?v=202605281100`
- Key rollback roots:
  - `/home/debian/rollback/hsm/course-minutes-day-202605291000/`
  - `/home/debian/rollback/hsm/school-day-excused-flex-202605291610/web001/`
  - `/home/debian/rollback/hsm/school-day-gap-cursor-20260605211741/web001/`
  - `/home/debian/rollback/hsm/password-reset-tenant-url-202605272030/app001/server/src/routes/auth-routes.js`

## AWS State

- AWS APP001/WEB001 are deployed through branch snapshot `1272ab3`; next AWS sync needs home lab `app.js?v=202606052116`.
- AWS includes password reset, dashboard gauges, filters, Grade Search layout, Course minutes/day UI, and attendance-driven excusals without duplicate Flex Blocks; it still needs the latest School Day gap cursor web fix.
- AWS SQL001 has tenant/runtime migrations through `032` and control-plane migrations through `012`.
- HTTPS/TLS is enabled for `aws-validation.navigrader.com` and `mitchell-aws-validation.navigrader.com`; HTTP redirects preserve host.
- AWS validation password reset email/reset succeeded when temporary NAT was enabled.
- Mitchell AWS validation tenant is restored to `tenant_mitchell_aws_validation`, mapped to `mitchell-aws-validation.navigrader.com`, and refreshed from home lab `tenant_mitchell_family`; table counts matched.
- Temporary MAINT001 NAT cleanup is complete; APP001 egress to Stripe/Postmark times out again, while MAINT001 still has direct internet.
- Local SSH aliases are configured: `aws-maint`, `aws-app`, `aws-web`, and `aws-sql`.

## AWS Stripe/Provisioning Readiness

- Public SaaS plan endpoint is live and returns Starter, Growth, and Co-op Pro.
- AWS checkout POST now creates Stripe test checkout sessions.
- `commercial_plans` has Stripe test `stripe_product_id` and `stripe_price_id` values for all three plans.
- `hsm-control-api.env` has Stripe test secret, publishable, and webhook values; secrets are stored only in runtime/local secret files.
- `PUBLIC_APP_BASE_URL` and `PUBLIC_SIGNUP_STATUS_BASE_URL` are `https://aws-validation.navigrader.com`.
- `PUBLIC_CHECKOUT_SUCCESS_URL` and `PUBLIC_CHECKOUT_CANCEL_URL` are explicitly set for `https://aws-validation.navigrader.com/signup-status.html`.
- AWS control commercial tables now contain one Stripe readiness probe checkout/customer/subscription set.
- `CONTROL_WORKER_ENABLED=true`, `CONTROL_SETUP_SYNC_ENABLED=true`, and `CONTROL_DEPLOYMENT_ENABLED=false` for rehearsal.
- Full browser checkout reached setup email for `aws1.navigrader.com`; first admin setup and login succeeded.
- AWS tenant `aws1` is active with schema `tenant_aws1`, environment ready, setup initialized, provisioning ready, active subscription, and setup email sent.
- AWS TLS covers `aws1.navigrader.com`; AWS setup status returns `initialized:true`.
- Laptop and APP001 DNS resolve `aws1.navigrader.com` to `18.188.35.157` without hosts overrides.
- AWS go-live egress plan is documented: create a managed NAT Gateway for APP001 Stripe/Postmark egress at go-live, not MAINT001 NAT.
- Production DNS cutover rehearsal and rollback steps are documented in `RUNBOOKS/production-cutover.md`.
- Keep `aws1` and related Stripe test records for now as rehearsal evidence.
- GoDaddy explicit `mitchell` CNAME points to `navigrader.ddns.net` with TTL 600 and should remain home lab.
- AWS SaaS DNS should use wildcard/new-tenant routing rather than an explicit `mitchell` cutover.
- AWS TLS certificate includes `mitchell.navigrader.com`; forced AWS HTTPS validates, but renewal/cert scope should be revisited because Mitchell stays home lab.

## Current Blockers

- No technical blocker for the completed Stripe checkout-to-first-login rehearsal.
- Final Mitchell data sync is complete; next blocker is enabling temporary go-live egress for mail/Stripe validation.

## Current Risks

- Keep Postmark, database, Stripe, smoke credentials, and runtime env files out of the repo.
- `aws-maint` currently points to public IP `3.138.124.78`; update `C:/Users/rmitchell/.ssh/config` if `MAINT001` receives a new public IP.
- Temporary NAT and hosts-override cleanup is complete; keep it that way until the planned go-live egress step.
- Control deployment remains disabled intentionally during rehearsal.
- Expanded AWS cert currently uses a manual DNS challenge renewal config; convert to Apache/HTTP renewal after live DNS points to AWS.
- Untracked local scratch assets and `tmp/` remain outside intended commits.

## Next Actions

1. Create managed NAT Gateway and add the private route for APP001 egress.
2. Validate APP001 Stripe/Postmark egress.
3. Sync latest web assets to AWS, then continue go-live egress and wildcard/new-tenant DNS planning while keeping `mitchell.navigrader.com` on the home lab.
