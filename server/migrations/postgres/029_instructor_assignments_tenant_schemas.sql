DO $$
DECLARE
  target_schema TEXT;
BEGIN
  FOR target_schema IN
    SELECT DISTINCT table_schema
    FROM information_schema.tables
    WHERE table_name IN ('courses', 'actual_instruction_minutes')
      AND table_type = 'BASE TABLE'
      AND table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY table_schema
  LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I.instructors (
        id TEXT PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        birthdate DATE NOT NULL,
        category TEXT NOT NULL CHECK (category IN (''parent'', ''volunteer'', ''compensated'', ''other'')),
        age_recorded INTEGER NULL,
        created_at DATE NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )',
      target_schema
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_instructors_last_name ON %I.instructors(lower(last_name), lower(first_name))',
      target_schema
    );
  END LOOP;

  FOR target_schema IN
    SELECT c.table_schema
    FROM information_schema.tables c
    WHERE c.table_name = 'courses'
      AND c.table_type = 'BASE TABLE'
      AND c.table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY c.table_schema
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.courses ADD COLUMN IF NOT EXISTS instructor_id TEXT NULL REFERENCES %I.instructors(id) ON DELETE SET NULL',
      target_schema,
      target_schema
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_courses_instructor_id ON %I.courses(instructor_id)',
      target_schema
    );
  END LOOP;

  FOR target_schema IN
    SELECT a.table_schema
    FROM information_schema.tables a
    WHERE a.table_name = 'actual_instruction_minutes'
      AND a.table_type = 'BASE TABLE'
      AND a.table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY a.table_schema
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.actual_instruction_minutes ADD COLUMN IF NOT EXISTS instructor_id TEXT NULL REFERENCES %I.instructors(id) ON DELETE SET NULL',
      target_schema,
      target_schema
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_actual_instruction_minutes_instructor_id ON %I.actual_instruction_minutes(instructor_id)',
      target_schema
    );
  END LOOP;
END $$;
