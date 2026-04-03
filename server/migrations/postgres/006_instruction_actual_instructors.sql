ALTER TABLE actual_instruction_minutes
ADD COLUMN IF NOT EXISTS instructor_id TEXT NULL REFERENCES instructors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_actual_instruction_minutes_instructor_id ON actual_instruction_minutes(instructor_id);
