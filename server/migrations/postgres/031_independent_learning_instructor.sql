DO $$
DECLARE
  target_schema TEXT;
BEGIN
  FOR target_schema IN
    SELECT table_schema
    FROM information_schema.tables
    WHERE table_name = 'instructors'
      AND table_type = 'BASE TABLE'
      AND table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY table_schema
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.instructors
         ADD COLUMN IF NOT EXISTS education_level TEXT NULL',
      target_schema
    );
    EXECUTE format(
      'INSERT INTO %I.instructors (
         id,
         first_name,
         last_name,
         birthdate,
         category,
         education_level,
         age_recorded,
         created_at,
         updated_at
       )
       VALUES (
         ''independent-learning'',
         ''Independent'',
         ''Learning'',
         DATE ''1900-01-01'',
         ''other'',
         ''other'',
         NULL,
         DATE ''1900-01-01'',
         NOW()
       )
       ON CONFLICT (id) DO UPDATE
       SET
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         category = EXCLUDED.category,
         education_level = EXCLUDED.education_level,
         updated_at = NOW()',
      target_schema
    );
  END LOOP;

  FOR target_schema IN
    SELECT table_schema
    FROM information_schema.tables
    WHERE table_name = 'course_sections'
      AND table_type = 'BASE TABLE'
      AND table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY table_schema
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.course_sections
         ADD COLUMN IF NOT EXISTS instructor_id TEXT NULL REFERENCES %I.instructors(id) ON DELETE SET NULL',
      target_schema,
      target_schema
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_course_sections_instructor_id ON %I.course_sections(instructor_id)',
      target_schema
    );
  END LOOP;
END $$;
