ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS quarter_names_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS weekdays_json JSONB NOT NULL DEFAULT '[1,2,3,4,5]'::jsonb;

ALTER TABLE course_sections
  ADD COLUMN IF NOT EXISTS quarter_names_json JSONB NOT NULL DEFAULT '[]'::jsonb;
