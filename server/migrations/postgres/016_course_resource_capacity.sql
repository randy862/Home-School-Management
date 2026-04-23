ALTER TABLE courses
ADD COLUMN IF NOT EXISTS resource_group TEXT NOT NULL DEFAULT '';

ALTER TABLE courses
ADD COLUMN IF NOT EXISTS resource_capacity INTEGER;

UPDATE courses
SET resource_capacity = 1
WHERE exclusive_resource = TRUE
  AND resource_capacity IS NULL;
