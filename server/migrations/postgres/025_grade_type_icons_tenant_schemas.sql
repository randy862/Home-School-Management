DO $$
DECLARE
  schema_record RECORD;
BEGIN
  FOR schema_record IN
    SELECT table_schema
    FROM information_schema.tables
    WHERE table_name = 'grade_types'
      AND table_schema NOT IN ('pg_catalog', 'information_schema')
  LOOP
    EXECUTE format('ALTER TABLE %I.grade_types ADD COLUMN IF NOT EXISTS icon_key TEXT NULL', schema_record.table_schema);
  END LOOP;
END $$;
