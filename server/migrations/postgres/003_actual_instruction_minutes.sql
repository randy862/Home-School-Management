CREATE TABLE IF NOT EXISTS actual_instruction_minutes (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  instruction_date DATE NOT NULL,
  actual_minutes INTEGER NOT NULL CHECK (actual_minutes > 0),
  CONSTRAINT actual_instruction_minutes_student_course_date_unique UNIQUE (student_id, course_id, instruction_date)
);

CREATE INDEX IF NOT EXISTS idx_actual_instruction_minutes_student_id ON actual_instruction_minutes(student_id);
CREATE INDEX IF NOT EXISTS idx_actual_instruction_minutes_course_id ON actual_instruction_minutes(course_id);
CREATE INDEX IF NOT EXISTS idx_actual_instruction_minutes_instruction_date ON actual_instruction_minutes(instruction_date);
