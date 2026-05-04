# App Interface Modernization Plan

Reference image: `App Interface.png`

Goal: gradually move the main tenant application interface toward the clean, modern app shell shown in the reference, starting with the navigation/sidebar and top header while preserving all current app behavior.

## Current Handoff Status

Last updated: 2026-05-03

Active branch:

- `app-modern-interface-shell`

Latest branch commits:

- `05e146b Use white modern app canvas`
- `83a63c9 Use regular School Day filter summary weight`
- `7f01b9e Normalize School Day dropdown row density`
- `30d8495 Fix School Day dropdown compression`
- `22889ad Fix School Day dropdown label wrapping`
- `49f649a Compact School Day dropdown rows`
- `f01d780 Tighten School Day dropdown option spacing`
- `a251915 Refine School Day labels and sidebar width`
- `f24f8dc Modernize School Day surface styling`
- `00810f9 Bump modern preview stylesheet version`
- `05e0c48 Modernize dashboard surface styling`
- `876dda2 Lighten modern sidebar nav labels`
- `1b47ee1 Document app interface modernization handoff`
- `e514b58 Start modern app interface shell`
- `f617d30 Disable API response caching`

Preview URL:

- `https://mitchell.navigrader.com/modern-preview/`

Deployment status:

- The modern app shell has **not** replaced the live tenant app entry point.
- The live tenant app at `https://mitchell.navigrader.com/` is unchanged by the app-shell visual work.
- A separate preview folder was published to WEB001 at `/var/www/home-school-management/web/modern-preview/`.
- The preview folder contains copied branch versions of `index.html`, `app.js`, `styles.css`, and `assets/`.
- As of commit `05e146b`, `/modern-preview/` is serving `styles.css?v=202605030540`.
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

## Second Session: Dashboard, School Day, And White Canvas Refinement

Status: **Completed as preview-only refinements** through commit `05e146b`.

Important scope note:

- All changes in this session stayed preview-oriented and frontend-only.
- The live tenant root at `https://mitchell.navigrader.com/` was not replaced.
- No backend APIs, scheduling generation, attendance save logic, grade save logic, reports logic, tenant lifecycle, billing, or provisioning code was intentionally changed.
- Preview refreshes copied updated `web/index.html` and `web/styles.css` to WEB001 `/var/www/home-school-management/web/modern-preview/`.

What changed:

- `web/styles.css`
  - Lightened modern sidebar navigation label weight.
  - Added a modern Dashboard surface layer:
    - quieter segmented Dashboard tabs
    - flatter KPI and summary cards
    - softer progress bars
    - lighter Dashboard table/chart wrappers
    - responsive Dashboard card stacking
  - Added a modern School Day surface layer:
    - cleaner filter shell
    - segmented quick filters and School Day subtabs
    - softer Daily Schedule, Attendance, and Grades sections
    - lighter student summary and side-by-side overview cards
    - tightened status badges, inline grade/edit controls, and table wrappers
  - Refined School Day filters after preview review:
    - `Reference Date` label became `Date`
    - `Student Filter`, `Subject Filter`, and `Course Filter` became `Student`, `Subject`, and `Course`
    - removed all-caps treatment from School Day filter labels
    - made date input and dropdown option text regular weight
    - fixed Course dropdown wrapping/compression when multiple students are selected
    - normalized dropdown row density without letting rows crush long Course names
  - Narrowed the modern sidebar from `285px` to `232px` on desktop, and from `240px` to `220px` at the medium breakpoint, to return space to the main content area while keeping `Administration` readable.
  - Changed the modern app shell canvas from light blue to white to better match the reference image:
    - `#app-shell`, `.app-main`, `.app-topbar`, and `.app-sidebar` now use white backgrounds
    - topbar/sidebar heavy shadows were removed
    - subtle border lines remain for structure
- `web/index.html`
  - Bumped stylesheet cache keys after each preview refresh.
  - Current preview cache key is `styles.css?v=202605030540`.

User review notes from this session:

- The user liked the Dashboard modernization once the preview was refreshed.
- The user preferred the white main app canvas from the reference image over the blue-tinted main workspace.
- The user did not like all-caps School Day filter labels or bold filter content.
- The dropdown spacing took several iterations; the current intended state is compact but not crushed, with Course names kept readable when multiple students are selected.

Verification completed:

- `git diff --check` passed for each committed CSS/HTML slice.
- `/modern-preview/` was verified over HTTPS after refreshes by checking the active stylesheet cache key.
- WEB001 preview files were verified in `/var/www/home-school-management/web/modern-preview/` after deployment.
- Branch `app-modern-interface-shell` was pushed after the committed preview refinements.

Known remaining local untracked files:

- `tmp/`
- Additional unused icon assets including `chart-bar-popular.svg`, `credit-card.svg`, `more-vertical.svg`, `move-vertical.svg`, `plan.svg`, `settings.svg`, `sliders-horizontal.svg`, `square-pen.svg`
- `web/assets/icons/trend-up2.svg - Shortcut.lnk`

Do not add these unless a later slice intentionally wires them into the app.

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

- Dashboard and School Day title treatment was tested after the white-canvas pass:
  - Dashboard currently works well without the large page title.
  - School Day currently keeps a compact title because the page has dense controls and benefits from a small anchor.
- School Day was compressed above the fold after preview review:
  - filter/control spacing was tightened
  - the stale daily message was cleared when date/filter context changes
  - reset actions moved into the Daily Schedule header
  - the class completion and planned/completed hours summary became one inline status line
- Grades modernization started after School Day:
  - Grades now uses compact segmented tabs
  - entry/search/records sections use the same white card surface as School Day
  - filters, grade entry controls, tables, action buttons, and grade calculator panels were visually aligned with the modern preview style
- Attendance modernization followed Grades:
  - Attendance now uses compact segmented tabs
  - entry/search/records sections use the same white card surface
  - the entry form, student picker, search filters, records table, inline edit row, and action buttons were visually aligned with the current modern preview style
- Students and Curriculum modernization followed Attendance:
  - Students list, editor, detail tabs, enrollment form, summary cards, tables, and action buttons were aligned to the modern white-card style
  - Curriculum / Management subjects, courses/classes, grade types, grading criteria, forms, subtabs, tables, and course material panels were aligned to the same style
- Schedule modernization followed Curriculum:
  - School Years, Quarters, School Day settings, Schedule Blocks, Holidays and Breaks, and Instruction Plans were aligned to the modern tab, form, table, and white-card style
- Validate the current white-canvas Dashboard, School Day, Grades, Attendance, Students, Curriculum, and Schedule preview in-browser before starting another visual slice.
- If the current School Day dropdown density still feels off, adjust only the scoped `#school-day-form .multi-select-dropdown[open]` rules before broader modernization continues.
- Continue page-by-page modernization after Schedule:
  - Calendar surface
  - Administration and Reports
- Modernize forms, tabs, buttons, and modals.
- Modernize Reports presentation.
- Wire remaining downloaded icon assets only as needed.
- Align the main app icon/style system with the final SaaS landing page direction.

## Resume Prompt

Use this prompt to pick back up:

```text
Pick up the main app interface modernization from NOTES/app-interface-modernization-plan.md on branch app-modern-interface-shell. The modern preview is published at https://mitchell.navigrader.com/modern-preview/ and currently includes the shell, Dashboard surface, compressed School Day surface, narrowed sidebar, scoped School Day dropdown fixes, white app canvas, plus Grades, Attendance, Students, Curriculum, and Schedule surface modernization passes. Continue improving the modern app shell against the preview path only unless I explicitly approve replacing the live tenant app. Preserve existing app behavior and navigation. Start by validating the current preview, especially School Day density and Grades/Attendance/Students/Curriculum/Schedule entry/search/form presentation, before beginning another visual slice.
```
