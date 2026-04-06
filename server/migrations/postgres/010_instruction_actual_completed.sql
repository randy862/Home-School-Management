ALTER TABLE actual_instruction_minutes
ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false;
