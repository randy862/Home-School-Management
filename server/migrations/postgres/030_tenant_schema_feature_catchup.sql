DO $$
DECLARE
  target_schema TEXT;
  has_actual_instruction_minutes BOOLEAN;
  has_course_sections BOOLEAN;
  has_courses BOOLEAN;
  has_grade_types BOOLEAN;
  has_school_years BOOLEAN;
  has_subjects BOOLEAN;
  has_user_sessions BOOLEAN;
BEGIN
  FOR target_schema IN
    SELECT table_schema
    FROM information_schema.tables
    WHERE table_name = 'students'
      AND table_type = 'BASE TABLE'
      AND table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY table_schema
  LOOP
    has_actual_instruction_minutes := FALSE;
    has_course_sections := FALSE;
    has_courses := FALSE;
    has_grade_types := FALSE;
    has_school_years := FALSE;
    has_subjects := FALSE;
    has_user_sessions := FALSE;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = target_schema
        AND table_name = 'courses'
        AND table_type = 'BASE TABLE'
    ) INTO has_courses;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = target_schema
        AND table_name = 'subjects'
        AND table_type = 'BASE TABLE'
    ) INTO has_subjects;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = target_schema
        AND table_name = 'school_years'
        AND table_type = 'BASE TABLE'
    ) INTO has_school_years;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = target_schema
        AND table_name = 'grade_types'
        AND table_type = 'BASE TABLE'
    ) INTO has_grade_types;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = target_schema
        AND table_name = 'user_sessions'
        AND table_type = 'BASE TABLE'
    ) INTO has_user_sessions;

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
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_instructors_last_name ON %I.instructors(lower(last_name), lower(first_name))',
      target_schema
    );

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I.workspace_config (
        id TEXT PRIMARY KEY,
        config_json JSONB NOT NULL DEFAULT ''{}''::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )',
      target_schema
    );

    EXECUTE format('ALTER TABLE %I.students ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL', target_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_students_archived_at ON %I.students(archived_at)', target_schema);

    IF has_courses THEN
      EXECUTE format(
        'ALTER TABLE %I.courses
           ADD COLUMN IF NOT EXISTS instructor_id TEXT NULL REFERENCES %I.instructors(id) ON DELETE SET NULL,
           ADD COLUMN IF NOT EXISTS course_materials JSONB NOT NULL DEFAULT ''[]''::jsonb,
           ADD COLUMN IF NOT EXISTS resource_group TEXT NOT NULL DEFAULT '''',
           ADD COLUMN IF NOT EXISTS resource_capacity INTEGER,
           ADD COLUMN IF NOT EXISTS quarter_names_json JSONB NOT NULL DEFAULT ''[]''::jsonb,
           ADD COLUMN IF NOT EXISTS weekdays_json JSONB NOT NULL DEFAULT ''[1,2,3,4,5]''::jsonb',
        target_schema,
        target_schema
      );
      EXECUTE format(
        'UPDATE %I.courses
         SET resource_capacity = 1
         WHERE exclusive_resource = TRUE
           AND resource_capacity IS NULL',
        target_schema
      );
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_courses_instructor_id ON %I.courses(instructor_id)', target_schema);

      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I.actual_instruction_minutes (
          id TEXT PRIMARY KEY,
          student_id TEXT NOT NULL REFERENCES %I.students(id) ON DELETE CASCADE,
          course_id TEXT NOT NULL REFERENCES %I.courses(id) ON DELETE CASCADE,
          instructor_id TEXT NULL REFERENCES %I.instructors(id) ON DELETE SET NULL,
          instruction_date DATE NOT NULL,
          actual_minutes NUMERIC(8, 2) NOT NULL,
          start_minutes INTEGER NULL,
          order_index INTEGER NULL,
          completed BOOLEAN NOT NULL DEFAULT FALSE,
          status TEXT NOT NULL DEFAULT ''scheduled'',
          CONSTRAINT actual_instruction_minutes_student_course_date_unique UNIQUE (student_id, course_id, instruction_date),
          CONSTRAINT actual_instruction_minutes_start_minutes_positive CHECK (start_minutes IS NULL OR (start_minutes >= 0 AND start_minutes < 1440)),
          CONSTRAINT actual_instruction_minutes_order_index_positive CHECK (order_index IS NULL OR order_index > 0),
          CONSTRAINT actual_instruction_minutes_status_check CHECK (status IN (''scheduled'', ''completed'', ''excused''))
        )',
        target_schema,
        target_schema,
        target_schema,
        target_schema
      );

      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I.course_sections (
          id TEXT PRIMARY KEY,
          course_id TEXT NOT NULL REFERENCES %I.courses(id) ON DELETE CASCADE,
          label TEXT NOT NULL,
          resource_group TEXT NOT NULL DEFAULT '''',
          concurrent_capacity INTEGER NULL,
          start_time TEXT NOT NULL DEFAULT ''08:00'',
          quarter_names_json JSONB NOT NULL DEFAULT ''[]''::jsonb,
          weekdays_json JSONB NOT NULL DEFAULT ''[1,2,3,4,5]''::jsonb,
          schedule_order INTEGER NULL
        )',
        target_schema,
        target_schema
      );

      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = target_schema
          AND table_name = 'actual_instruction_minutes'
          AND table_type = 'BASE TABLE'
      ) INTO has_actual_instruction_minutes;

      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = target_schema
          AND table_name = 'course_sections'
          AND table_type = 'BASE TABLE'
      ) INTO has_course_sections;

      IF has_actual_instruction_minutes THEN
        EXECUTE format(
          'ALTER TABLE %I.actual_instruction_minutes
             ADD COLUMN IF NOT EXISTS instructor_id TEXT NULL REFERENCES %I.instructors(id) ON DELETE SET NULL,
             ADD COLUMN IF NOT EXISTS start_minutes INTEGER,
             ADD COLUMN IF NOT EXISTS order_index INTEGER,
             ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT FALSE,
             ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT ''scheduled''',
          target_schema,
          target_schema
        );
        EXECUTE format(
          'UPDATE %I.actual_instruction_minutes
           SET status = CASE WHEN completed THEN ''completed'' ELSE ''scheduled'' END
           WHERE status IS NULL OR status = ''scheduled''',
          target_schema
        );
        EXECUTE format('ALTER TABLE %I.actual_instruction_minutes DROP CONSTRAINT IF EXISTS actual_instruction_minutes_start_minutes_positive', target_schema);
        EXECUTE format('ALTER TABLE %I.actual_instruction_minutes ADD CONSTRAINT actual_instruction_minutes_start_minutes_positive CHECK (start_minutes IS NULL OR (start_minutes >= 0 AND start_minutes < 1440))', target_schema);
        EXECUTE format('ALTER TABLE %I.actual_instruction_minutes DROP CONSTRAINT IF EXISTS actual_instruction_minutes_order_index_positive', target_schema);
        EXECUTE format('ALTER TABLE %I.actual_instruction_minutes ADD CONSTRAINT actual_instruction_minutes_order_index_positive CHECK (order_index IS NULL OR order_index > 0)', target_schema);
        EXECUTE format('ALTER TABLE %I.actual_instruction_minutes DROP CONSTRAINT IF EXISTS actual_instruction_minutes_status_check', target_schema);
        EXECUTE format('ALTER TABLE %I.actual_instruction_minutes ADD CONSTRAINT actual_instruction_minutes_status_check CHECK (status IN (''scheduled'', ''completed'', ''excused''))', target_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_actual_instruction_minutes_student_id ON %I.actual_instruction_minutes(student_id)', target_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_actual_instruction_minutes_course_id ON %I.actual_instruction_minutes(course_id)', target_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_actual_instruction_minutes_instruction_date ON %I.actual_instruction_minutes(instruction_date)', target_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_actual_instruction_minutes_instructor_id ON %I.actual_instruction_minutes(instructor_id)', target_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_actual_instruction_minutes_start_minutes ON %I.actual_instruction_minutes(start_minutes)', target_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_actual_instruction_minutes_order_index ON %I.actual_instruction_minutes(order_index)', target_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_actual_instruction_date_student_course ON %I.actual_instruction_minutes(instruction_date, student_id, course_id)', target_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_actual_instruction_student_date ON %I.actual_instruction_minutes(student_id, instruction_date)', target_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_actual_instruction_student_date_order ON %I.actual_instruction_minutes(student_id, instruction_date, order_index)', target_schema);
      END IF;

      IF has_course_sections THEN
        EXECUTE format(
          'ALTER TABLE %I.course_sections
             ADD COLUMN IF NOT EXISTS resource_group TEXT NOT NULL DEFAULT '''',
             ADD COLUMN IF NOT EXISTS concurrent_capacity INTEGER NULL,
             ADD COLUMN IF NOT EXISTS start_time TEXT NOT NULL DEFAULT ''08:00'',
             ADD COLUMN IF NOT EXISTS quarter_names_json JSONB NOT NULL DEFAULT ''[]''::jsonb,
             ADD COLUMN IF NOT EXISTS weekdays_json JSONB NOT NULL DEFAULT ''[1,2,3,4,5]''::jsonb,
             ADD COLUMN IF NOT EXISTS schedule_order INTEGER NULL',
          target_schema
        );
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_course_sections_course_id ON %I.course_sections(course_id)', target_schema);

        EXECUTE format(
          'CREATE TABLE IF NOT EXISTS %I.section_enrollments (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL REFERENCES %I.students(id) ON DELETE CASCADE,
            course_section_id TEXT NOT NULL REFERENCES %I.course_sections(id) ON DELETE CASCADE,
            schedule_order INTEGER NULL,
            UNIQUE (student_id, course_section_id)
          )',
          target_schema,
          target_schema,
          target_schema
        );
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_section_enrollments_student_id ON %I.section_enrollments(student_id)', target_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_section_enrollments_section_id ON %I.section_enrollments(course_section_id)', target_schema);
      END IF;
    END IF;

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I.schedule_blocks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        block_type TEXT NOT NULL CHECK (block_type IN (''lunch'', ''recess'', ''other_break'')),
        description TEXT NOT NULL DEFAULT '''',
        duration_minutes INTEGER NOT NULL CHECK (duration_minutes >= 5),
        weekdays_json JSONB NOT NULL DEFAULT ''[]''::jsonb
      )',
      target_schema
    );
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I.student_schedule_blocks (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL REFERENCES %I.students(id) ON DELETE CASCADE,
        schedule_block_id TEXT NOT NULL REFERENCES %I.schedule_blocks(id) ON DELETE CASCADE,
        schedule_order INTEGER NULL
      )',
      target_schema,
      target_schema,
      target_schema
    );
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_student_schedule_blocks_student_id ON %I.student_schedule_blocks(student_id)', target_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_student_schedule_blocks_block_id ON %I.student_schedule_blocks(schedule_block_id)', target_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_student_schedule_blocks_student_schedule ON %I.student_schedule_blocks(student_id, schedule_order, schedule_block_id)', target_schema);

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I.flex_blocks (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL REFERENCES %I.students(id) ON DELETE CASCADE,
        block_date DATE NOT NULL,
        start_minutes INTEGER NOT NULL,
        end_minutes INTEGER NOT NULL,
        purpose TEXT NOT NULL DEFAULT '''',
        UNIQUE (student_id, block_date, start_minutes, end_minutes)
      )',
      target_schema,
      target_schema
    );
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_flex_blocks_student_date ON %I.flex_blocks(student_id, block_date)', target_schema);

    IF has_school_years THEN
      EXECUTE format(
        'ALTER TABLE %I.school_years
           ADD COLUMN IF NOT EXISTS school_day_start_time TEXT NOT NULL DEFAULT ''08:00'',
           ADD COLUMN IF NOT EXISTS minutes_between_classes INTEGER NOT NULL DEFAULT 5',
        target_schema
      );
    END IF;

    IF has_user_sessions THEN
      EXECUTE format('ALTER TABLE %I.user_sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NULL', target_schema);
      EXECUTE format(
        'UPDATE %I.user_sessions
         SET last_seen_at = COALESCE(last_seen_at, created_at, NOW())
         WHERE last_seen_at IS NULL',
        target_schema
      );
      EXECUTE format(
        'ALTER TABLE %I.user_sessions
           ALTER COLUMN last_seen_at SET DEFAULT NOW(),
           ALTER COLUMN last_seen_at SET NOT NULL',
        target_schema
      );
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_sessions_last_seen_at ON %I.user_sessions(last_seen_at)', target_schema);
    END IF;

    IF has_grade_types THEN
      EXECUTE format('ALTER TABLE %I.grade_types ADD COLUMN IF NOT EXISTS icon_key TEXT NULL', target_schema);
    END IF;

    IF has_subjects THEN
      EXECUTE format('ALTER TABLE %I.subjects ADD COLUMN IF NOT EXISTS required BOOLEAN NOT NULL DEFAULT FALSE', target_schema);
    END IF;

    IF has_actual_instruction_minutes THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_attendance_date_student ON %I.attendance(attendance_date, student_id)', target_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_attendance_student_date_present ON %I.attendance(student_id, attendance_date, present)', target_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_tests_date_student ON %I.tests(test_date, student_id)', target_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_tests_student_course_date ON %I.tests(student_id, course_id, test_date)', target_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_tests_student_subject_date ON %I.tests(student_id, subject_id, test_date)', target_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_enrollments_student_schedule ON %I.enrollments(student_id, schedule_order, course_id)', target_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_plans_student_date_window ON %I.plans(student_id, start_date, end_date)', target_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_plans_course_date_window ON %I.plans(course_id, start_date, end_date)', target_schema);
    END IF;
  END LOOP;
END $$;
