CREATE TABLE IF NOT EXISTS schedule_blocks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  block_type TEXT NOT NULL CHECK (block_type IN ('lunch', 'recess', 'other_break')),
  description TEXT NOT NULL DEFAULT '',
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes >= 5),
  weekdays_json JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS student_schedule_blocks (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  schedule_block_id TEXT NOT NULL REFERENCES schedule_blocks(id) ON DELETE CASCADE,
  schedule_order INTEGER NULL
);

CREATE INDEX IF NOT EXISTS idx_student_schedule_blocks_student_id ON student_schedule_blocks(student_id);
CREATE INDEX IF NOT EXISTS idx_student_schedule_blocks_block_id ON student_schedule_blocks(schedule_block_id);
