DO $$
DECLARE
  target_schema text;
BEGIN
  SELECT table_schema
  INTO target_schema
  FROM information_schema.tables
  WHERE table_name = 'instructors'
  ORDER BY CASE WHEN table_schema = current_schema() THEN 0 ELSE 1 END, table_schema
  LIMIT 1;

  IF target_schema IS NULL THEN
    RAISE EXCEPTION 'instructors table not found';
  END IF;

  EXECUTE format(
    'ALTER TABLE %I.instructors
       ADD COLUMN IF NOT EXISTS education_level TEXT NULL
       CHECK (
         education_level IS NULL
         OR education_level IN (
           ''high_school_diploma_or_ged'',
           ''some_college'',
           ''associate_degree'',
           ''bachelors_degree'',
           ''masters_degree'',
           ''doctoral_degree'',
           ''other''
         )
       )',
    target_schema
  );
END $$;
