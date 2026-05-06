DO $$
DECLARE
  target_schema TEXT;
BEGIN
  FOR target_schema IN
    SELECT t.table_schema
    FROM information_schema.tables t
    WHERE t.table_name = 'users'
      AND t.table_type = 'BASE TABLE'
      AND t.table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY t.table_schema
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.users ADD COLUMN IF NOT EXISTS profile_photo_data_url TEXT NULL',
      target_schema
    );
  END LOOP;
END $$;
