DO $$
DECLARE
  target_schema TEXT;
  fallback_school_year_id TEXT;
BEGIN
  FOR target_schema IN
    SELECT schemaname
    FROM pg_tables
    WHERE tablename = 'enrollments'
      AND schemaname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY schemaname
  LOOP
    EXECUTE format(
      'SELECT id
         FROM %I.school_years
        ORDER BY is_current DESC, start_date DESC, id
        LIMIT 1',
      target_schema
    )
    INTO fallback_school_year_id;

    IF fallback_school_year_id IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I.enrollments ADD COLUMN IF NOT EXISTS school_year_id TEXT', target_schema);
    EXECUTE format('ALTER TABLE %I.enrollments ADD COLUMN IF NOT EXISTS student_grade TEXT NOT NULL DEFAULT ''''', target_schema);
    EXECUTE format('UPDATE %I.enrollments SET school_year_id = %L WHERE school_year_id IS NULL OR school_year_id = ''''', target_schema, fallback_school_year_id);
    EXECUTE format(
      'UPDATE %I.enrollments e
          SET student_grade = COALESCE(NULLIF(e.student_grade, ''''), s.grade, '''')
         FROM %I.students s
        WHERE s.id = e.student_id',
      target_schema,
      target_schema
    );
    EXECUTE format('ALTER TABLE %I.enrollments ALTER COLUMN school_year_id SET NOT NULL', target_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_enrollments_school_year_student ON %I.enrollments(school_year_id, student_id, schedule_order, course_id)', target_schema);

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = target_schema AND tablename = 'section_enrollments') THEN
      EXECUTE format('ALTER TABLE %I.section_enrollments ADD COLUMN IF NOT EXISTS school_year_id TEXT', target_schema);
      EXECUTE format('ALTER TABLE %I.section_enrollments ADD COLUMN IF NOT EXISTS student_grade TEXT NOT NULL DEFAULT ''''', target_schema);
      EXECUTE format('UPDATE %I.section_enrollments SET school_year_id = %L WHERE school_year_id IS NULL OR school_year_id = ''''', target_schema, fallback_school_year_id);
      EXECUTE format(
        'UPDATE %I.section_enrollments se
            SET student_grade = COALESCE(NULLIF(se.student_grade, ''''), s.grade, '''')
           FROM %I.students s
          WHERE s.id = se.student_id',
        target_schema,
        target_schema
      );
      EXECUTE format('ALTER TABLE %I.section_enrollments ALTER COLUMN school_year_id SET NOT NULL', target_schema);
      EXECUTE format('ALTER TABLE %I.section_enrollments DROP CONSTRAINT IF EXISTS section_enrollments_student_id_course_section_id_key', target_schema);
      EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS idx_section_enrollments_student_section_year ON %I.section_enrollments(student_id, course_section_id, school_year_id)', target_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_section_enrollments_school_year_student ON %I.section_enrollments(school_year_id, student_id, schedule_order, course_section_id)', target_schema);
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = target_schema AND tablename = 'student_schedule_blocks') THEN
      EXECUTE format('ALTER TABLE %I.student_schedule_blocks ADD COLUMN IF NOT EXISTS school_year_id TEXT', target_schema);
      EXECUTE format('ALTER TABLE %I.student_schedule_blocks ADD COLUMN IF NOT EXISTS student_grade TEXT NOT NULL DEFAULT ''''', target_schema);
      EXECUTE format('UPDATE %I.student_schedule_blocks SET school_year_id = %L WHERE school_year_id IS NULL OR school_year_id = ''''', target_schema, fallback_school_year_id);
      EXECUTE format(
        'UPDATE %I.student_schedule_blocks ssb
            SET student_grade = COALESCE(NULLIF(ssb.student_grade, ''''), s.grade, '''')
           FROM %I.students s
          WHERE s.id = ssb.student_id',
        target_schema,
        target_schema
      );
      EXECUTE format('ALTER TABLE %I.student_schedule_blocks ALTER COLUMN school_year_id SET NOT NULL', target_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_student_schedule_blocks_school_year_student ON %I.student_schedule_blocks(school_year_id, student_id, schedule_order, schedule_block_id)', target_schema);
    END IF;
  END LOOP;
END $$;
