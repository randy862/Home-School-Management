ALTER TABLE students
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_students_archived_at
  ON students (archived_at);
