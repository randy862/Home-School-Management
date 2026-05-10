DO $$
DECLARE
  schema_record RECORD;
BEGIN
  FOR schema_record IN
    SELECT table_schema
    FROM information_schema.tables
    WHERE table_name = 'subjects'
      AND table_schema NOT IN ('pg_catalog', 'information_schema')
  LOOP
    EXECUTE format('ALTER TABLE %I.subjects ADD COLUMN IF NOT EXISTS required BOOLEAN NOT NULL DEFAULT FALSE', schema_record.table_schema);
  END LOOP;
END $$;
