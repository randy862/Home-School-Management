# Session Handoff

Date: 2026-06-05

## Context

Home lab production polish and AWS commercial production migration carry-forward.

## Current State

- Home lab production is current at `https://mitchell.navigrader.com/`.
- Home lab WEB001 serves `styles.css?v=202605281100` and `app.js?v=202606052116`.
- Password recovery/login refresh, tenant-aware reset URLs, dashboard gauges, Grade Search filter/layout, Course minutes/day UI, attendance-driven automatic excusals, and School Day gap cursor fix are implemented.
- Marking a student absent automatically excuses that student's scheduled/open classes for the date without generating duplicate Flex Blocks; user confirmed the fix in home lab and AWS.
- AWS APP001/WEB001 were deployed from `saas-modern-redesign`; AWS still needs the latest home lab web asset `app.js?v=202606052116` during the next sync.
- AWS SQL001 has tenant/runtime migrations through `032` and control-plane migrations through `012`.
- AWS HTTPS/TLS is enabled for `aws-validation.navigrader.com` and `mitchell-aws-validation.navigrader.com`; HTTP redirects to HTTPS.
- Restored Mitchell validation tenant is mapped to `mitchell-aws-validation.navigrader.com`; final data sync from home lab `tenant_mitchell_family` to AWS `tenant_mitchell_aws_validation` completed and row counts matched.
- Temporary MAINT001 NAT route/security-group/source-destination cleanup was completed; Linux IP forwarding and MASQUERADE are off, and APP001 egress to Stripe/Postmark times out again.
- Local SSH aliases exist: `aws-maint`, `aws-app`, `aws-web`, and `aws-sql`.

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

Next technical action is to sync latest web assets to AWS when hosts are running, then continue AWS go-live egress/DNS planning with `mitchell.navigrader.com` staying on the home lab.

## Risks

- Keep Postmark, database, Stripe, smoke credentials, and runtime env files out of the repo.
- `aws-maint` uses public IP `3.138.124.78`; update local SSH config if `MAINT001` restarts without a stable Elastic IP.
- Do not leave temporary egress/NAT in place unintentionally before go-live; current temporary NAT cleanup is complete. Production go-live should use the managed NAT Gateway plan, not MAINT001 NAT.
- Control deployment is intentionally disabled for rehearsal; provisioning prepares schema/runtime metadata and setup token flow without pushing a per-tenant runtime over the shared APP001 service.
- Certbot renewal for the expanded AWS cert currently records a manual DNS challenge; after DNS cutover, convert renewal back to Apache/HTTP validation.
- Untracked scratch screenshots/icons and `tmp/` remain local and should stay out of commits.

## Rollback Pointers

- Home lab course minutes/day: `/home/debian/rollback/hsm/course-minutes-day-202605291000/`
- Home lab School Day web fixes: `/home/debian/rollback/hsm/school-day-excused-flex-202605291610/web001/`, `/home/debian/rollback/hsm/school-day-gap-cursor-20260605211741/web001/`
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

- Latest web fix: `node --check web/app.js`, `git diff --check`, Apache configtest, and public `https://mitchell.navigrader.com/health` HTTP 200 passed.
- AWS HTTPS `/health`, `/control-api/health`, and `/api/setup/status` returned HTTP 200; HTTP `/health` redirects to HTTPS.
- AWS password recovery reset-complete succeeded when temporary NAT was enabled.
- Temporary NAT cleanup completed; APP001 Stripe/Postmark/checkip egress times out again, while MAINT001 still has direct internet.
- Test checkout POST returned HTTP 201 with a Stripe test checkout session; DB rows show account `checkout_started`, checkout session `created`, and subscription `incomplete`.
- Full Stripe browser checkout produced setup email; user completed setup and logged into `aws1.navigrader.com`.
- AWS `aws1` setup status returns `initialized:true`; control-plane setup sync marked environment initialized and provisioning ready.
- Forced AWS HTTPS for `mitchell.navigrader.com` returned setup-status initialized and validated against the expanded certificate.
