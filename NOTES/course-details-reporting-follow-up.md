# Course Details Reporting Follow-Up

## Goal

Add Course Materials data to the reporting interface so families and co-ops can produce more detailed course documentation for state reporting requirements.

## Reporting UI

Add a `Course Details` checkbox to the report content options.

## Student Report Output

When `Course Details` is selected, generate a `Course Details` section for each selected student.

For each student, include each course and its saved course material details:

- Course Name
- Material Type
- Title
- Publisher

## Data Source

Use the course materials captured on each course:

- Material Type
- Title
- Publisher
- Other note, when Material Type is `Other`

## Notes

- The first reporting pass should focus on the requested fields: course name, material type, title, and publisher.
- If a course has multiple materials, list each material under that course.
- If a course has no materials, avoid adding noisy empty rows unless the report design needs an explicit `Not specified` value.
