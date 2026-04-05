ALTER TABLE actual_instruction_minutes
ADD COLUMN IF NOT EXISTS order_index integer;

ALTER TABLE actual_instruction_minutes
DROP CONSTRAINT IF EXISTS actual_instruction_minutes_order_index_positive;

ALTER TABLE actual_instruction_minutes
ADD CONSTRAINT actual_instruction_minutes_order_index_positive
CHECK (order_index IS NULL OR order_index > 0);

CREATE INDEX IF NOT EXISTS idx_actual_instruction_minutes_order_index
ON actual_instruction_minutes(order_index);
