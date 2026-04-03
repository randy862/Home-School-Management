CREATE TABLE IF NOT EXISTS instructors (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birthdate DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('parent', 'volunteer', 'compensated', 'other')),
  age_recorded INTEGER NULL,
  created_at DATE NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instructors_last_name ON instructors(lower(last_name), lower(first_name));
