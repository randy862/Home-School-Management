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

## Important Constraint

Do not try to solve this only by adding more logic to the current `resourceGroup + concurrentCapacity` course fields.

The better long-term solution is:

- `Course` defines the curriculum
- `Resource Group` defines the constrained resource
- `Section` defines the actual scheduled shared offering
- students enroll into a section when a course is shared
