ALTER TABLE courses
ADD COLUMN IF NOT EXISTS course_materials JSONB NOT NULL DEFAULT '[]'::jsonb;
