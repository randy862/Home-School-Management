CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birthdate DATE NULL,
  grade TEXT NOT NULL DEFAULT '',
  age_recorded INTEGER NULL,
  created_at DATE NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS school_years (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  required_instructional_days INTEGER NULL,
  required_instructional_hours NUMERIC(8, 2) NULL,
  is_current BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS grade_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  weight NUMERIC(6, 2) NULL
);

CREATE TABLE IF NOT EXISTS grading_criteria (
  id TEXT PRIMARY KEY,
  letter_scale_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  gpa_scale_option TEXT NOT NULL DEFAULT '4',
  gpa_max INTEGER NOT NULL DEFAULT 4
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'student')),
  student_id TEXT NULL REFERENCES students(id) ON DELETE SET NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NULL,
  password_algorithm TEXT NOT NULL DEFAULT 'legacy_frontend',
  password_iterations INTEGER NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATE NULL,
  updated_at DATE NULL,
  last_login_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  hours_per_day NUMERIC(6, 2) NOT NULL DEFAULT 0,
  exclusive_resource BOOLEAN NOT NULL DEFAULT FALSE,
  quarter_names_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  weekdays_json JSONB NOT NULL DEFAULT '[1,2,3,4,5]'::jsonb,
  course_materials JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  schedule_order INTEGER NULL
);

CREATE TABLE IF NOT EXISTS quarters (
  id TEXT PRIMARY KEY,
  school_year_id TEXT NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_breaks (
  id TEXT PRIMARY KEY,
  school_year_id TEXT NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
  student_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  break_type TEXT NOT NULL,
  description TEXT NULL,
  start_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  weekdays_json JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS holidays (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  holiday_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  plan_type TEXT NOT NULL,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  weekdays_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  quarter_name TEXT NULL
);

CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  present BOOLEAN NOT NULL,
  CONSTRAINT attendance_student_date_unique UNIQUE (student_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS tests (
  id TEXT PRIMARY KEY,
  test_date DATE NOT NULL,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id TEXT NULL REFERENCES subjects(id) ON DELETE SET NULL,
  course_id TEXT NULL REFERENCES courses(id) ON DELETE SET NULL,
  grade_type TEXT NOT NULL,
  test_name TEXT NOT NULL,
  score NUMERIC(9, 2) NOT NULL,
  max_score NUMERIC(9, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_courses_subject_id ON courses(subject_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_quarters_school_year_id ON quarters(school_year_id);
CREATE INDEX IF NOT EXISTS idx_plans_student_id ON plans(student_id);
CREATE INDEX IF NOT EXISTS idx_plans_course_id ON plans(course_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_tests_student_id ON tests(student_id);
