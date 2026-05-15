# Current Status

Date: 2026-05-15

## Active Workstream

UI polish and workflow refinement on `saas-modern-redesign`.

## Current Focus

Global consistency polish is deployed to production and committed as `34743f5 Polish workspace consistency surfaces`.

## Completed Recently

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

- Live asset cache keys:
  - `styles.css?v=202605150849`
  - `app.js?v=202605150849`
- Latest WEB001 rollback snapshot:
  `/var/www/home-school-management/rollback/web-202605150849.tgz`

## Validation

- `node --check web/app.js`
- `git diff --check -- web/app.js web/index.html web/styles.css STATUS.md HANDOFF.md`
- Local Web Preview returned HTTP 200 at `http://127.0.0.1:5500/?seedPreview=1`
- PowerShell parser checks for `scripts/Test-HostedSmoke.ps1` and `scripts/Invoke-HostedReleaseGate.ps1`
- Public health endpoint returned `{"ok":true}`
- WEB001 Apache config syntax OK and Apache service active
- Remote WEB001 hashes matched local `web/index.html`, `web/app.js`, and `web/styles.css`
- Live HTML references `styles.css?v=202605150849` and `app.js?v=202605150849`

## Current Blockers

- None for the deployed frontend release.

## Current Risks

- Authenticated production smoke requires valid production tenant credentials.
- Browser cache may require a hard refresh before the newest web assets display.
- Untracked local scratch assets remain outside committed work.

## Next Actions

1. Continue polish from production/preview feedback.
