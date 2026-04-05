ALTER TABLE actual_instruction_minutes
ADD COLUMN IF NOT EXISTS start_minutes integer;

ALTER TABLE actual_instruction_minutes
DROP CONSTRAINT IF EXISTS actual_instruction_minutes_start_minutes_positive;

ALTER TABLE actual_instruction_minutes
ADD CONSTRAINT actual_instruction_minutes_start_minutes_positive
CHECK (start_minutes IS NULL OR (start_minutes >= 0 AND start_minutes < 1440));

CREATE INDEX IF NOT EXISTS idx_actual_instruction_minutes_start_minutes
ON actual_instruction_minutes(start_minutes);
