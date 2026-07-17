# Current Status

Date: 2026-07-11

## Active Workstream

Home lab production polish and AWS commercial production migration.

## Current Focus

Mitchell school-year/performance year-scope fixes are validated and queued for AWS sync.

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
- Compliance Instructional Hours chart draws the green projected year-end line through the final school-year month.
- Student grade is now a K-12 dropdown; Courses and Classes have compact K-12/All grade-level multi-selects; Course table and Student/Course/Detailed Grade reports have Grade Level columns; Student enrollment filters Courses/Classes by the selected student's grade.
- Backend course/class grade levels use `grade_levels_json` with tenant migration `033_course_grade_levels.sql`; existing rows default to `All`; migration `033` is applied on home lab.
- Course, class, and schedule-block assignments are now scoped by school year with a student grade snapshot; selected Academic Year drives student schedules/enrollment views and report grade context.
- School Years now includes `Start Next School Year`, which creates the next year, creates recommended quarters, advances active student grades, and starts the new year with no copied enrollments.
- Tenant migration `034_school_year_scoped_enrollments.sql` is applied on home lab; Mitchell has zero blank `school_year_id` rows in enrollment tables.
- Authenticated hosted smoke passed against `https://mitchell.navigrader.com` after the latest dashboard year-scope deployment.
- User confirmed the compact grade-level dropdown and Course table Grade column look correct in Mitchell.
- Configured Courses now has a compact Grade column filter (`All`, `K`-`12`); `All grades` courses remain visible under each grade filter.
- Student Schedule detail/enrollment uses current/future student profile grade for the header and scheduled-item picker, while past-year views still honor assignment grade snapshots.
- School-year deletion removes course, class, and schedule-block assignments scoped to the deleted year and warns admins before doing so.
- Mitchell orphaned schedule rows were repaired after deleting extra school years: moved 20 courses, 3 classes, and 4 blocks to `2025-2026`; deleted 12 course and 2 block orphan residues; orphan counts are zero.
- User retested Start Next School Year successfully: grades incremented, `2026-2027` became active, new year started empty, new enrollments stayed in `2026-2027`, and switching between `2025-2026` and `2026-2027` showed the correct Dashboard, School Day, and schedule context.
- Class conflict warnings now filter section enrollments by active Academic Year so previous-year class assignments do not appear as current-year conflicts.
- Performance Dashboard total averages now filter grades by active Academic Year so prior-year grade types/scores do not appear in the current-year Total Average column.

## Production State

- Home lab production URL: `https://mitchell.navigrader.com/`; wildcard TLS cert `wildcard.navigrader.com` covers `*.navigrader.com` through 2026-10-15, and the old expired `navigrader.com` Certbot lineage has been removed.
- Tenant app assets currently deployed: `app.js?v=202607132015`, `styles.css?v=202607111330`.
- Grade-level deployment rollback root: `/home/debian/rollback/hsm/grade-levels-20260711100422/`
- Grade-level UI polish rollback root: `/home/debian/rollback/hsm/grade-levels-ui-polish-20260711102603/`
- Report Grade Level columns rollback root: `/home/debian/rollback/hsm/report-grade-columns-202607111115/`
- School-year scoped enrollment rollback root: `/home/debian/rollback/hsm/school-year-scoped-enrollments-202607111300/`
- Course Grade filter rollback archive: `/home/debian/rollback/hsm/course-grade-filter-202607111330/web001/web.tgz`
- Student Schedule grade-context rollback archive: `/home/debian/rollback/hsm/student-schedule-grade-context-202607111410/web001/web.tgz`
- School-year delete cleanup rollback root: `/home/debian/rollback/hsm/school-year-delete-cleanup-202607111455/`
- Class conflict year-scope rollback archive: `/home/debian/rollback/hsm/class-conflict-year-scope-202607121020/web001/web.tgz`
- Performance total-average year-scope rollback archive: `/home/debian/rollback/hsm/performance-total-average-year-scope-202607132015/web001/web.tgz`
- Mitchell orphan cleanup backup schema/report: `backup_mitchell_school_year_orphan_cleanup_202607112045`, `/home/debian/rollback/hsm/mitchell-school-year-orphan-cleanup-202607112045/cleanup-report.json`
- Key rollback roots:
  - `/home/debian/rollback/hsm/course-minutes-day-202605291000/`
  - `/home/debian/rollback/hsm/school-day-excused-flex-202605291610/web001/`
  - `/home/debian/rollback/hsm/school-day-gap-cursor-20260605211741/web001/`
  - `/home/debian/rollback/hsm/compliance-hours-projection-20260605214124/web001/`
  - `/home/debian/rollback/hsm/password-reset-tenant-url-202605272030/app001/server/src/routes/auth-routes.js`

## AWS State

- AWS APP001/WEB001 are deployed through branch snapshot `1272ab3`; next AWS sync needs validated home lab assets including `app.js?v=202607132015`, `styles.css?v=202607111330`, report Grade Level columns, Configured Courses Grade filter, Student Schedule grade-context fix, school-year delete cleanup, class conflict/performance total-average year-scope fixes, school-year scoped enrollment/year rollover, and migrations `033`/`034`.
- AWS includes password reset, dashboard gauges, filters, Grade Search layout, Course minutes/day UI, and attendance-driven excusals without duplicate Flex Blocks; it still needs the latest School Day gap cursor and Compliance hours projection web fixes.
- AWS SQL001 has tenant/runtime migrations through `032` and control-plane migrations through `012`; tenant migrations `033` and `034` are pending after home lab validation.
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

- No technical blocker for syncing the validated home lab release to AWS.
- No technical blocker for syncing the validated grade-level/reporting and school-year scoped enrollment release to AWS.

## Current Risks

- Keep Postmark, database, Stripe, smoke credentials, and runtime env files out of the repo.
- `aws-maint` currently points to public IP `3.138.124.78`; update `C:/Users/rmitchell/.ssh/config` if `MAINT001` receives a new public IP.
- Temporary NAT and hosts-override cleanup is complete; keep it that way until the planned go-live egress step.
- Home lab wildcard TLS renewal is not automated yet because GoDaddy DNS-01 validation is manual; automate DNS API hooks or renew manually before 2026-10-15.
- Control deployment remains disabled intentionally during rehearsal.
- Expanded AWS cert currently uses a manual DNS challenge renewal config; convert to Apache/HTTP renewal after live DNS points to AWS.
- Untracked local scratch assets and `tmp/` remain outside intended commits.

## Next Actions

1. Sync validated code/assets/migrations `033` and `034` to AWS.
2. Continue go-live egress and wildcard/new-tenant DNS planning while keeping `mitchell.navigrader.com` on the home lab.
