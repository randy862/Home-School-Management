ALTER TABLE courses
ADD COLUMN IF NOT EXISTS instructor_id TEXT NULL REFERENCES instructors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_courses_instructor_id ON courses(instructor_id);
