CREATE TABLE IF NOT EXISTS flex_blocks (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  block_date DATE NOT NULL,
  start_minutes INTEGER NOT NULL,
  end_minutes INTEGER NOT NULL,
  purpose TEXT NOT NULL DEFAULT '',
  UNIQUE (student_id, block_date, start_minutes, end_minutes)
);

CREATE INDEX IF NOT EXISTS idx_flex_blocks_student_date
ON flex_blocks(student_id, block_date);
