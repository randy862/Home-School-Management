DO $$
DECLARE
  target_schema text;
  has_completed_column boolean;
BEGIN
  FOR target_schema IN
    SELECT table_schema
    FROM information_schema.tables
    WHERE table_name = 'actual_instruction_minutes'
      AND table_type = 'BASE TABLE'
      AND table_schema NOT IN ('pg_catalog', 'information_schema')
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.actual_instruction_minutes ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT ''scheduled''',
      target_schema
    );

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = target_schema
        AND table_name = 'actual_instruction_minutes'
        AND column_name = 'completed'
    )
    INTO has_completed_column;

    IF has_completed_column THEN
      EXECUTE format(
        'UPDATE %I.actual_instruction_minutes SET status = CASE WHEN completed THEN ''completed'' ELSE ''scheduled'' END WHERE status IS NULL OR status = ''scheduled''',
        target_schema
      );
    END IF;

    EXECUTE format(
      'ALTER TABLE %I.actual_instruction_minutes DROP CONSTRAINT IF EXISTS actual_instruction_minutes_status_check',
      target_schema
    );
    EXECUTE format(
      'ALTER TABLE %I.actual_instruction_minutes ADD CONSTRAINT actual_instruction_minutes_status_check CHECK (status IN (''scheduled'', ''completed'', ''excused''))',
      target_schema
    );
  END LOOP;
END $$;
