# Current Status

Date: 2026-05-15

## Active Workstream

Public SaaS site polish on `saas-modern-redesign`.

## Current Focus

Public `www.navigrader.com` closing-card blend correction is deployed to production and committed as `6fd203e Blend public closing cards`.

## Completed Recently

- Deployed and committed `6fd203e Blend public closing cards`:
  - Removed the lighthouse/coastal graphic and extra line-pattern decoration from the public closing sections.
  - CTA and footer now use connected top/bottom card corners so they read as one blended closing unit.
  - Footer keeps the Navigrader logo, Product/Resources/Get In Touch columns, icon badges, contact details, and copyright.
- Previously deployed public footer/collage polish remains active:
  - Bottom CTA screenshots are back to the layered collage style on desktop and stack cleanly on mobile.
  - Footer includes section links, `support@navigrader.com`, `www.navigrader.com`, and `Copyright 2026, Navigrader, LLC. All rights reserved.`
- Deployed and committed `c042e07 Polish account options copy`:
  - Account Options copy now uses parent-facing language for Dormant Mode, Reactivation, and Data Export.
  - Internal terms such as tenant lifecycle, lower-frequency actions, runtime activity, and offboarding were removed from the customer-facing surface.
  - Dormant/Data Export backend completion remains tracked in `NOTES/dormant-data-export-end-to-end-plan.md`.
- Drafted dormant/data export execution plan:
  - Dormant gaps: Stripe reduced pricing, period-boundary processor, full reactivation billing restore, expanded write-block review.
  - Data Export gaps: one-time checkout, webhook, export job, CSV bundle, secure download, expiration, operator retry/status.
  - Recommended next slice: dormant control-plane migration and Stripe service methods.
- Deployed and committed `677417b Polish operational tab styling`:
  - Dashboard, Dashboard Compliance, Grades, and Attendance tabs now use the flat underline tab style used by School Day.
  - Calendar, Administration, Curriculum, and Schedule setup/config tab styles were intentionally left unchanged.
- Deployed and committed `34743f5 Polish workspace consistency surfaces`:
  - Students now has active, required-gap, and archived summary chips.
  - Curriculum now has subject, course, class, and required-subject summary chips.
  - Schedule now has current year, instructional day, and schedule block summary chips.
  - Student Detail now has a compact student overview, schedule/required/grade/absence chips, and clearer add-scheduled-item actions.
  - Curriculum and Schedule setup sections now have compact headings, concise operational copy, and live setup status badges.
  - Shared responsive header styling was added for these setup surfaces.
- Deployed and committed `2fa0b01 Polish account billing surfaces`:
  - Account modal now has a compact plan/subscription/site summary strip.
  - Local Web Preview shows a realistic Starter subscription and upgrade options.
  - Subscription details show pricing, included students, current usage, and billing period.
  - Available Upgrades cards have richer plan-specific styling and clearer CTAs.
  - Hosted smoke and release-gate scripts now support credential environment variables.
- Previously deployed UI polish remains active:
  - Reports/Admin collapsed sections and summary chips.
  - Calendar segmented views and expandable student rows.
  - Planning readiness review filters.
  - Student compliance workflow links and archived-student compliance exclusion.
  - Grades, Attendance, Dashboard, and School Day polish.

## Production State

- Public SaaS page:
  - `saas-polish.css?v=202605151220`
  - Latest WEB001 rollback snapshot:
    `/var/www/home-school-management/rollback/web-202605151220.tgz`
- Live asset cache keys:
  - `styles.css?v=202605150913`
  - `app.js?v=202605150933`
- Latest WEB001 rollback snapshot:
  `/var/www/home-school-management/rollback/web-202605150933.tgz`

## Validation

- Public `https://www.navigrader.com/` returned HTTP 200 and includes `saas-polish.css?v=202605151220`, no scenic mark, footer logo, contact email, and copyright.
- Public `https://www.navigrader.com/saas-polish.css?v=202605151220` returned HTTP 200 and includes the connected CTA/footer card styling with no line-pattern graphic.
- The four intended public screenshot assets each returned HTTP 200.
- Remote WEB001 hashes matched local `web/saas.html` and `web/saas-polish.css`.
- `node --check web/app.js`
- `git diff --check -- web/app.js web/index.html web/styles.css STATUS.md HANDOFF.md`
- Local Web Preview returned HTTP 200 at `http://127.0.0.1:5500/?seedPreview=1`
- PowerShell parser checks for `scripts/Test-HostedSmoke.ps1` and `scripts/Invoke-HostedReleaseGate.ps1`
- Public health endpoint returned `{"ok":true}`
- WEB001 Apache config syntax OK and Apache service active
- Remote WEB001 hashes matched local `web/index.html` and `web/app.js`
- Live HTML references `styles.css?v=202605150913` and `app.js?v=202605150933`

## Current Blockers

- None for the deployed frontend release.

## Current Risks

- Dormant/Data Export backend flows are not end-to-end complete; continue from `NOTES/dormant-data-export-end-to-end-plan.md`.
- Authenticated production smoke requires valid production tenant credentials.
- Browser cache may require a hard refresh before the newest web assets display.
- Untracked local scratch assets remain outside committed work.

## Next Actions

1. Resume from `NOTES/dormant-data-export-end-to-end-plan.md`.
2. Confirm dormant reactivation billing policy.
3. Start dormant implementation with control-plane migration and Stripe service methods.
