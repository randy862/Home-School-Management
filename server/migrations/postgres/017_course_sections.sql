CREATE TABLE IF NOT EXISTS course_sections (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  resource_group TEXT NOT NULL DEFAULT '',
  concurrent_capacity INTEGER NULL,
  start_time TEXT NOT NULL DEFAULT '08:00',
  quarter_names_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  weekdays_json JSONB NOT NULL DEFAULT '[1,2,3,4,5]'::jsonb,
  schedule_order INTEGER NULL
);

CREATE TABLE IF NOT EXISTS section_enrollments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_section_id TEXT NOT NULL REFERENCES course_sections(id) ON DELETE CASCADE,
  schedule_order INTEGER NULL,
  UNIQUE (student_id, course_section_id)
);

CREATE INDEX IF NOT EXISTS idx_course_sections_course_id
  ON course_sections (course_id);

CREATE INDEX IF NOT EXISTS idx_section_enrollments_student_id
  ON section_enrollments (student_id);

CREATE INDEX IF NOT EXISTS idx_section_enrollments_section_id
  ON section_enrollments (course_section_id);
