DO $$
DECLARE
  target_schema TEXT;
BEGIN
  FOR target_schema IN
    SELECT schemaname
    FROM pg_tables
    WHERE tablename = 'courses'
      AND schemaname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY schemaname
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.courses
       ADD COLUMN IF NOT EXISTS grade_levels_json JSONB NOT NULL DEFAULT ''["all"]''::jsonb',
      target_schema
    );

    IF EXISTS (
      SELECT 1
      FROM pg_tables
      WHERE schemaname = target_schema
        AND tablename = 'course_sections'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I.course_sections
         ADD COLUMN IF NOT EXISTS grade_levels_json JSONB NOT NULL DEFAULT ''["all"]''::jsonb',
        target_schema
      );
    END IF;
  END LOOP;
END $$;
