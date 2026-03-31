# Actual Daily Instruction Minutes

## Purpose
Track instructional hours from what actually happened on a given student day, not only from the planned course `Hours/Day` value.

## Decisions
- Attendance remains simple `Present` / `Absent`.
- Partial-day attendance is not added.
- If any instruction occurs on a day, that day still counts toward instructional-day presence.
- Instructional-hour accuracy comes from daily actual instructional minutes.

## Product Model
- `courses.hoursPerDay` remains the planned/default duration.
- A new per-student, per-course, per-date record stores `actualMinutes`.
- If no actual-minute override exists, the system uses the planned course duration.
- If an actual-minute override exists, the system uses that value for:
  - daily calendar schedule display
  - dashboard instructional-hour gauges
  - student instructional-hour detail
  - report instructional-hour totals
  - any other instructional-hour summary derived from scheduled course time

## Daily Calendar Behavior
- The calendar daily view shows one row per scheduled block.
- For instructional rows, the UI shows:
  - actual start/end time
  - student
  - course label
  - planned start/end time
  - editable minutes field
- Minutes are edited in whole minutes, not decimal hours.
- Break rows remain non-editable.

## Same-Day Cascading Rule
- The first block of the day keeps its planned start time unless an earlier block pushes it later.
- When an instructional row's minutes are changed, later blocks on that same day for that student recalculate their displayed actual start/end times.
- This cascade affects only that student on that specific date.
- The recurring plan template is not rewritten.
- The course `Hours/Day` setting is not rewritten.

## Persistence Rule
- Store one unique record per:
  - `studentId`
  - `courseId`
  - `date`
- The stored value is `actualMinutes`.
- Removing the override returns the day back to planned duration behavior.

## Operational Scope
- This is a pre-production feature.
- Production cutover should wait until this behavior is accepted in staging because it changes how instructional hours are calculated and displayed.
