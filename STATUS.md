# Current Status

Date: 2026-05-15

## Active Workstream

Public SaaS site polish on `saas-modern-redesign`.

## Current Focus

Public `www.navigrader.com` screenshot correction is deployed to production with four refreshed screenshots.

## Completed Recently

- Deployed public site screenshot correction:
  - `www.navigrader.com` bottom CTA now uses four refreshed UI polish screenshots: Screenshots 1, 2, 4, and 5.
  - Duplicate Screenshot 3 asset/reference was removed.
  - Code commits: `fd79a99 Remove duplicate public site screenshot`, `ce5b90c Use four public site screenshots`.
- Deployed and committed `8894a65 Refresh public site screenshots and footer`:
  - Footer now includes `support@navigrader.com` and `Copyright 2026, Navigrader, LLC`.
  - Header nav now includes Contact.
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
  - `saas-polish.css?v=202605151056`
  - Latest WEB001 rollback snapshot:
    `/var/www/home-school-management/rollback/web-202605151056.tgz`
- Live asset cache keys:
  - `styles.css?v=202605150913`
  - `app.js?v=202605150933`
- Latest WEB001 rollback snapshot:
  `/var/www/home-school-management/rollback/web-202605150933.tgz`

## Validation

- Public `https://www.navigrader.com/` returned HTTP 200 and includes four screenshot references, contact email, copyright line, and `saas-polish.css?v=202605151056`.
- The four intended public screenshot assets each returned HTTP 200; duplicate Screenshot 3 asset was removed from WEB001.
- Remote WEB001 hashes matched local `web/saas.html`, `web/saas-polish.css`, and the four public screenshot assets.
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
