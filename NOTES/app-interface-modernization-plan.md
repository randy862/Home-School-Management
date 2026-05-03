# App Interface Modernization Plan

Reference image: `App Interface.png`

Goal: gradually move the main tenant application interface toward the clean, modern app shell shown in the reference, starting with the navigation/sidebar and top header while preserving all current app behavior.

## Current Handoff Status

Last updated: 2026-05-03

Active branch:

- `app-modern-interface-shell`

Latest branch commits:

- `f617d30 Disable API response caching`
- `e514b58 Start modern app interface shell`

Preview URL:

- `https://mitchell.navigrader.com/modern-preview/`

Deployment status:

- The modern app shell has **not** replaced the live tenant app entry point.
- The live tenant app at `https://mitchell.navigrader.com/` is unchanged by the app-shell visual work.
- A separate preview folder was published to WEB001 at `/var/www/home-school-management/web/modern-preview/`.
- The preview folder contains copied branch versions of `index.html`, `app.js`, `styles.css`, and `assets/`.
- Because the preview runs on the same tenant origin, it talks to the normal Mitchell tenant `/api` endpoints and uses the same login/data.

Important operational fix completed before the visual shell work:

- API responses now disable caching/ETags to avoid browser `304` responses causing frontend fetch failures.
- This was deployed to APP001 and verified with `/api/students` returning `Cache-Control: no-store...`.

Untracked local assets intentionally left out of the first shell commit:

- Additional downloaded icons not yet wired into the app shell, including `credit-card.svg`, `more-vertical.svg`, `settings.svg`, `sliders-horizontal.svg`, `square-pen.svg`, and others shown by `git status`.
- `tmp/`
- `web/assets/icons/trend-up2.svg - Shortcut.lnk`

Do not assume those untracked files are part of the committed shell milestone until they are intentionally referenced and added.

## First Slice: Sidebar And Top Shell

Start with the app shell only, not the scheduling/grading/reporting logic.

Status: **Completed as first preview checkpoint** in commit `e514b58`.

Target changes:

- Modern left sidebar with:
  - larger Navigrader logo lockup at the top
  - white/soft background
  - rounded navigation rows
  - blue active state
  - icon plus label layout
  - muted inactive navigation items
  - consistent spacing and alignment
- Top header with:
  - global search-style field
  - notification/help/user controls
  - cleaner spacing and softer borders
- Optional lower sidebar cards:
  - Academic Year selector
  - Need Help / help center card

## Engineering Constraints

- Preserve existing navigation IDs, event handlers, and page switching behavior.
- Avoid touching School Day scheduling logic, grades, attendance, reports, billing, tenant lifecycle, or provisioning logic in this slice.
- Keep the change mostly within `web/index.html`, `web/styles.css`, and only minimal `web/app.js` changes if needed for shell interactions.
- Verify every sidebar item still opens the correct app section.
- Verify mobile/tablet behavior does not regress.

What was changed in the first slice:

- `web/index.html`
  - Added modern top bar markup with logo, search field, notification/help buttons, and account profile trigger.
  - Converted primary nav buttons to icon + label while keeping the original `.tab-btn` and `data-tab` hooks.
  - Added lower sidebar support cards for Academic Year and Help.
- `web/styles.css`
  - Added final app-shell override layer for the modern top bar, left nav, sidebar support cards, and transparent tab-panel shell.
  - Kept this scoped under `#app-shell` where possible so the login shell and existing app internals are not broadly rewritten.
- `web/app.js`
  - Changed the account trigger text to show username and role separately.
  - Preserved existing auth/session/account menu behavior.
- Committed icon assets used by the first slice:
  - `bell.svg`
  - `chart-bar.svg`
  - `chevron-down.svg`
  - `graduation-cap.svg`
  - `search.svg`

Verification completed:

- `web/app.js` passed `node --check` on APP001.
- Referenced icon paths in `web/index.html` resolve.
- `git diff --check` passed for changed web files.
- Preview URL and `search.svg` returned `200 OK` from WEB001.

## Suggested Workflow

1. Continue on `app-modern-interface-shell`.
2. Review `https://mitchell.navigrader.com/modern-preview/` and collect visual adjustments.
3. Keep developing against the preview folder until the user explicitly approves replacing the live app entry point.
4. Verify navigation across all major sections:
   - Dashboard
   - School Day
   - Grades
   - Attendance
   - Students
   - Curriculum
   - Schedule
   - Calendar
   - Administration
   - Reports
5. For each preview iteration:
   - Commit branch changes.
   - Push `app-modern-interface-shell`.
   - Refresh `/modern-preview/` by copying branch web files to WEB001.
6. When approved, replace the live app files with the branch versions and keep `/modern-preview/` as a rollback/reference copy until the cutover is stable.

## Later Slices

- Tighten first shell visual details after user review:
  - logo sizing/spacing
  - top bar spacing
  - sidebar card usefulness
  - mobile behavior
- Modernize Dashboard cards and gauges.
- Modernize School Day tables and controls toward the reference image:
  - cleaner summary metric cards
  - table rows with more spacing and modern status chips
  - icon buttons for edit/more actions
- Modernize forms, tabs, buttons, and modals.
- Modernize Reports presentation.
- Wire remaining downloaded icon assets only as needed.
- Align the main app icon/style system with the final SaaS landing page direction.

## Resume Prompt

Use this prompt to pick back up:

```text
Pick up the main app interface modernization from NOTES/app-interface-modernization-plan.md on branch app-modern-interface-shell. The first shell preview is committed as e514b58 and published at https://mitchell.navigrader.com/modern-preview/. Continue improving the modern app shell against the preview path only unless I explicitly approve replacing the live tenant app. Preserve existing app behavior and navigation.
```
