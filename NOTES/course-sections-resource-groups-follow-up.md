# Course Sections And Resource Groups Follow-up

## Problem To Solve

The current `Course + Resource Group + Concurrent Capacity` model is enough for simple shared-capacity scheduling, but it is not enough for a course that needs multiple distinct shared groups in the same day.

Example:

- Course: `Piano`
- Need two Piano groups per day
- Each group should allow `3` students
- Students assigned to `Piano Group A` should all receive Piano at the same scheduled time
- Students assigned to `Piano Group B` should all receive Piano at a different scheduled time

With the current model, the app can represent a shared resource limit, but it does not yet provide a clean way to:

- create multiple resource groups or sections for the same course
- enroll students into a specific group for that course
- guarantee that all students in the same shared group stay scheduled together
- prevent an admin from accidentally placing students from the same intended group at different times

## Recommended Direction

Move from a course-only enrollment model to a section-based shared scheduling model.

Keep these concepts separate:

1. `Course`
- what is being taught
- example: `Piano`

2. `Resource Group`
- the constrained room, teacher, lab, or equipment pool
- examples: `Piano Room A`, `Piano Room B`, `Piano Teacher 1`

3. `Course Section` or `Scheduled Offering`
- a specific scheduled group for a course
- example: `Piano Group A`
- example: `Piano Group B`

4. `Section Enrollment`
- the student is assigned to a specific section, not just the broad course

## Proposed Model

For a shared scheduled class, create sections like:

- `Piano Group A`
  - `courseId = Piano`
  - `resourceGroupId = Piano Room A`
  - `capacity = 3`
  - `scheduled time = 9:00 AM`

- `Piano Group B`
  - `courseId = Piano`
  - `resourceGroupId = Piano Room B`
  - `capacity = 3`
  - `scheduled time = 1:00 PM`

Students would then be enrolled into `Piano Group A` or `Piano Group B`, rather than only into the generic `Piano` course.

## Why This Is Better

This solves the key workflow issues:

- multiple shared groups can exist for the same course
- each group can have its own time slot
- each group can have its own capacity
- students in the same section are guaranteed to be scheduled together
- admins do not need to manually coordinate several student schedules one by one for the same shared class

## Scheduling Rules To Implement

For shared sections, the scheduler should treat the section as one scheduled unit:

- all students enrolled in the same section inherit the same planned time
- section enrollment should be blocked when capacity is full
- moving a section time should move all enrolled students together
- student-by-student schedule editing should not silently split a shared section into different times
- if a student needs a different time, the admin should move them to another section or create a new one

## UI Direction

The likely admin workflow should become:

1. Create or edit the course
- example: `Piano`

2. Create one or more sections for that course
- set section label
- assign resource group
- set capacity
- set scheduled time or meeting pattern

3. Enroll students into a specific section
- not just into the generic course

4. Show section membership in `Student Current Schedule`
- so the admin can see that the student belongs to `Piano Group A`

## Next Session Action

The next implementation/design session should focus on:

- defining the exact data model for `course_sections` and section enrollments
- deciding how sections coexist with the current direct course enrollment model
- defining how the scheduler handles direct enrollments versus shared-section enrollments
- sketching the first UI for creating sections and assigning students to them

## Current Implementation Status

As of April 23, 2026, the first working slice is live:

- `Course Sections` and `Section Enrollments` exist in the backend
- admins can create sections under `Curriculum > Courses > Add Sections`
- students can be assigned to a section from `Students > Current Schedule`
- section-based classes now keep the section's configured shared time instead of drifting per student
- direct per-student time editing for section-based rows has been constrained so section time is treated as shared
- hard overlaps between a fixed section time and another class for the same student were addressed in the scheduler

## Remaining Problem

Even after the overlap fixes, the current scheduling behavior can still feel awkward because the scheduler treats section times as hard anchors and then tries to route the rest of the day around them.

That avoids collisions, but it can leave dead space before or after a section.

Example observed in live testing:

- `PJ Mitchell` assigned to `Piano Group 2`
- `Piano Group 2` configured for `9:00 AM - 10:00 AM`
- overlap with another class was fixed
- but the resulting day still left an undesirable `15 minute` gap before the section

This means the current implementation is functionally safer, but it still does not feel like a clean schedule.

There is also a more important product concern:

- the rigid section-time approach undermines one of the best parts of homeschool scheduling
- in real use, a class may run long, start late, or need to shift in the moment
- `School Day` currently supports that kind of live adjustment well for ordinary classes
- a section model that removes that flexibility is the wrong end state

## Updated Model Direction

The better model is:

- a section defines a shared planned anchor
- not a permanently rigid time lock

That means a section should still coordinate students together, but it should not make the day behave like a traditional bell schedule.

The target behavior should be:

1. Shared planned section time
- example: `Piano Group 2` is planned for `9:00 AM`
- all enrolled students should initially schedule together at that planned time

2. Same-day shared override
- if the section starts late or runs long, the admin should be able to change the section for that day
- that change should move all students in the section together for that specific date

3. Student-level flexibility outside the section
- non-section classes before and after the section should still slide naturally
- same-day edits for ordinary classes should remain easy

So the design should become:

- section time is the default shared plan
- same-day execution can override that shared plan as a group
- the app should preserve homeschool flexibility instead of taking it away

## Design Questions For Tomorrow

Tomorrow's follow-up should start here:

1. Decide how section anchors should participate in schedule generation
- should the scheduler split the day into segments around section anchors and pack flexible classes into those segments?
- should anchored sections be treated as first-class schedule boundaries instead of just fixed blocks inserted into a rolling cursor?

2. Decide how to handle dead space around anchored sections
- should flexible classes compress backward or forward to eliminate small gaps?
- should there be a tolerance rule, such as allowing a nearby class to shift in 5-minute increments to close the space?

3. Revisit the meaning of `Student Current Schedule` order for section-based items
- fixed-time sections should not be movable like ordinary courses
- but the student's schedule still needs a clean way to express whether a flexible class should fall before or after a section

4. Decide whether section scheduling needs a more explicit planner model
- the current model is "section has start time"
- we may need a richer concept like "anchored window" plus flexible packing before/after that window

5. Define section-level same-day overrides
- `School Day` should likely allow changing a section start time and possibly duration for a given day
- that override should apply to every student in that section for that date
- this is different from the current per-student override model and should probably have its own data shape

6. Protect the good existing `School Day` behavior
- the existing beauty of the app is that classes can run long or shift on the fly
- section support should extend that flexibility to shared groups, not remove it

## Recommended Starting Point

Start the next session by reviewing the scheduler with this goal:

- keep section times shared and authoritative
- prevent overlaps
- remove awkward dead gaps when a better non-conflicting arrangement exists

The likely better long-term direction is:

- compute fixed section windows first
- break the student's day into open segments around those windows
- schedule non-section courses within those segments
- only then apply same-day adjustments or overrides that do not violate the section windows

But with one important refinement:

- section windows should be treated as the planned shared schedule
- the live day should also support a section-level daily override so the whole group can shift together when real life happens

## Suggested Next Session Starting Questions

Tomorrow should likely start with these questions:

1. Should sections have:
- a planned time
- plus an optional per-day shared override time and duration?

2. Should `School Day` show section-based rows with:
- `Edit Section For Today`
- instead of a student-specific edit action?

3. Should the scheduler:
- place planned section anchors first
- then compress flexible classes around them
- then apply any section-level day overrides before student-level non-section overrides?

## Related Follow-up

Also track this related improvement:

- add a configurable `school day start time`, likely in `School Year` settings, instead of hard-coding the day to begin at `8:00 AM`

## Important Constraint

Do not try to solve this only by adding more logic to the current `resourceGroup + concurrentCapacity` course fields.

The better long-term solution is:

- `Course` defines the curriculum
- `Resource Group` defines the constrained resource
- `Section` defines the actual scheduled shared offering
- students enroll into a section when a course is shared
