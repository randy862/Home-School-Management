# App Interface Modernization Plan

Reference image: `App Interface.png`

Goal: gradually move the main tenant application interface toward the clean, modern app shell shown in the reference, starting with the navigation/sidebar and top header while preserving all current app behavior.

## First Slice: Sidebar And Top Shell

Start with the app shell only, not the scheduling/grading/reporting logic.

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

## Suggested Workflow

1. Create or switch to a dedicated branch for app-shell work after the SaaS redesign branch is handled.
2. Inspect current nav markup and behavior-critical selectors.
3. Update sidebar/top-shell markup only where needed.
4. Restyle the shell in `web/styles.css`.
5. Verify navigation across all major sections:
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
6. Commit as a standalone app-shell milestone.

## Later Slices

- Modernize Dashboard cards and gauges.
- Modernize School Day tables and controls.
- Modernize forms, tabs, buttons, and modals.
- Modernize Reports presentation.
- Align icon system with the final SaaS landing page direction.

## Resume Prompt

Use this prompt to pick back up:

```text
Pick up the main app interface modernization from NOTES/app-interface-modernization-plan.md. Start with the sidebar and top shell only, matching App Interface.png as the target direction. Preserve all existing app behavior and navigation.
```
