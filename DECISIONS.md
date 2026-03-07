# Decision Log

| Date | Decision | Rationale | Impact |
|---|---|---|---|
| 2026-03-07 | Use lightweight static web scaffold first | Enables rapid UI iteration before backend commitments | Faster MVP discovery and lower setup friction |
| 2026-03-07 | Adopt 5-agent operating model | Separates planning, delivery, and quality ownership | Clear accountability and parallel workstreams |
| 2026-03-07 | Keep ops artifacts in repo root and role content in dedicated folders | Reduces navigation overhead and onboarding time | Consistent collaboration pattern |
| 2026-03-07 | Model course lengths as hours per instructional day for MVP | Allows direct calculation of total/complete instructional hours from attendance and calendar days | Delivers requested hour indicators without backend dependencies |
| 2026-03-07 | Keep the expanded app as a static SPA with local storage for this phase | Avoids backend dependency while validating full workflow fit with family use | Faster delivery of end-to-end homeschool operations prototype |
| 2026-03-07 | Generate calendar schedules from plan definitions instead of storing every event record | Reduces data duplication and keeps calendar consistent with plan edits | Calendar reflects annual/quarterly/weekly plan updates immediately |
