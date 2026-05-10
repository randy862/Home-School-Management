# Current Status

Date: 2026-05-09

## Active Workstream

Modern app preview refinement.

## Current Focus

Dashboard Overview, Performance, and Compliance polish in `/modern-preview/`.

## Completed Recently

- Required Subjects were added to Curriculum, enrollment checks, dashboard subject rows, and database persistence.
- Overview Attendance and Running Grade Average cards now match instruction status-card styling.
- Overview Grades at Risk replaced School Year-to-Date Pace.
- Grade Search supports grade-value filtering for Single Grade Risk workflows.
- Performance tables were tightened to fit without internal horizontal scrolling.
- Compliance now has Instructional Hours, Instructional Days, and Other subtabs.
- Instructional Days now mirrors the Required Instructional Hours panel, including progress chart and student breakdown wiring.
- Completed Today filter layout and compliance chart sizing were tuned.

## Current Blockers

- WEB001 / Proxmox host networking is unreachable, so the final Instructional Days student breakdown update has not been deployed to preview.

## Current Risks

- Live app has not been replaced.
- Untracked `tmp/` and icon files remain outside the current commit unless explicitly requested.
- Continue avoiding archive/ and NOTES/ unless the task requires them.

## Next Actions

1. Restore WEB001 / Proxmox network access.
2. Deploy `web/index.html`, `web/app.js`, and `web/styles.css` to `/var/www/home-school-management/web/modern-preview/`.
3. Verify preview cache keys and smoke-test Dashboard Compliance > Instructional Days.
