# Session Handoff

Date: 2026-05-09

## Current Work

Modern app preview refinement on branch:

`app-modern-interface-shell`

Preview URL:

https://mitchell.navigrader.com/modern-preview/

The live tenant app has not been replaced.

## Current State

Dashboard and Curriculum refinements are implemented locally.

Completed this session:

- Added Required flag support for Subjects and related enrollment/dashboard indicators.
- Refined Curriculum > Subjects form layout.
- Restyled Attendance and Running Grade Average overview cards to match instruction status cards.
- Added Overview Grades at Risk with Average Grade Risk and Single Grade Risk counts.
- Added Grade Search grade-value filtering for risk links.
- Linked Average Grade Risk to Performance Course Watchlist.
- Tightened Performance tables and dashboard chart sizing to avoid horizontal scrollbars.
- Added Compliance subtabs: Instructional Hours, Instructional Days, Other.
- Built Instructional Days compliance content to mirror Instructional Hours, including student breakdown wiring.
- Tuned Completed Today filter placement and typography.

Current local cache keys:

- `styles.css?v=202605092132`
- `app.js?v=202605092145`

## Next Action

After WEB001 / Proxmox networking is restored, deploy:

`scp web/index.html web/app.js web/styles.css debian@192.168.1.210:/var/www/home-school-management/web/modern-preview/`

Then verify:

`curl.exe -s https://mitchell.navigrader.com/modern-preview/ | Select-String -Pattern "styles.css\?v=|app.js\?v="`

## Risks

- Final Required Instructional Days student breakdown change is not deployed because WEB001 is unreachable.
- Do not replace the live app unless explicitly approved.
- Existing untracked `tmp/` and icon files remain intentionally untouched.

## Validation

- `node --check web/app.js`
- `git diff --check`
