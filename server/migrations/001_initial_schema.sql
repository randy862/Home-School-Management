IF OBJECT_ID('dbo.tests', 'U') IS NOT NULL DROP TABLE dbo.tests;
IF OBJECT_ID('dbo.users', 'U') IS NOT NULL DROP TABLE dbo.users;
IF OBJECT_ID('dbo.attendance', 'U') IS NOT NULL DROP TABLE dbo.attendance;
IF OBJECT_ID('dbo.plans', 'U') IS NOT NULL DROP TABLE dbo.plans;
IF OBJECT_ID('dbo.enrollments', 'U') IS NOT NULL DROP TABLE dbo.enrollments;
IF OBJECT_ID('dbo.courses', 'U') IS NOT NULL DROP TABLE dbo.courses;
IF OBJECT_ID('dbo.subjects', 'U') IS NOT NULL DROP TABLE dbo.subjects;
IF OBJECT_ID('dbo.students', 'U') IS NOT NULL DROP TABLE dbo.students;
IF OBJECT_ID('dbo.holidays', 'U') IS NOT NULL DROP TABLE dbo.holidays;
IF OBJECT_ID('dbo.quarters', 'U') IS NOT NULL DROP TABLE dbo.quarters;
IF OBJECT_ID('dbo.school_years', 'U') IS NOT NULL DROP TABLE dbo.school_years;
IF OBJECT_ID('dbo.grade_types', 'U') IS NOT NULL DROP TABLE dbo.grade_types;

CREATE TABLE dbo.students (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  first_name NVARCHAR(120) NOT NULL,
  last_name NVARCHAR(120) NOT NULL,
  birthdate DATE NOT NULL,
  grade NVARCHAR(50) NOT NULL,
  age_recorded INT NULL,
  created_at DATE NULL
);

CREATE TABLE dbo.subjects (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  name NVARCHAR(120) NOT NULL UNIQUE
);

CREATE TABLE dbo.courses (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  name NVARCHAR(150) NOT NULL,
  subject_id NVARCHAR(64) NOT NULL,
  hours_per_day DECIMAL(6,2) NOT NULL,
  CONSTRAINT FK_courses_subjects FOREIGN KEY (subject_id) REFERENCES dbo.subjects(id)
);

CREATE TABLE dbo.enrollments (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  student_id NVARCHAR(64) NOT NULL,
  course_id NVARCHAR(64) NOT NULL,
  CONSTRAINT FK_enrollments_students FOREIGN KEY (student_id) REFERENCES dbo.students(id),
  CONSTRAINT FK_enrollments_courses FOREIGN KEY (course_id) REFERENCES dbo.courses(id),
  CONSTRAINT UQ_enrollments_student_course UNIQUE (student_id, course_id)
);

CREATE TABLE dbo.school_years (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  label NVARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BIT NOT NULL DEFAULT 0
);

CREATE TABLE dbo.quarters (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  school_year_id NVARCHAR(64) NOT NULL,
  name NVARCHAR(20) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  CONSTRAINT FK_quarters_school_years FOREIGN KEY (school_year_id) REFERENCES dbo.school_years(id),
  CONSTRAINT UQ_quarters_school_year_name UNIQUE (school_year_id, name)
);

CREATE TABLE dbo.holidays (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  name NVARCHAR(120) NOT NULL,
  holiday_type NVARCHAR(30) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL
);

CREATE TABLE dbo.grade_types (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  name NVARCHAR(80) NOT NULL UNIQUE,
  weight DECIMAL(6,2) NULL
);

CREATE TABLE dbo.plans (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  plan_type NVARCHAR(30) NOT NULL,
  student_id NVARCHAR(64) NOT NULL,
  course_id NVARCHAR(64) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  weekdays_json NVARCHAR(100) NOT NULL,
  quarter_name NVARCHAR(20) NULL,
  CONSTRAINT FK_plans_students FOREIGN KEY (student_id) REFERENCES dbo.students(id),
  CONSTRAINT FK_plans_courses FOREIGN KEY (course_id) REFERENCES dbo.courses(id)
);

CREATE TABLE dbo.attendance (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  student_id NVARCHAR(64) NOT NULL,
  attendance_date DATE NOT NULL,
  present BIT NOT NULL,
  CONSTRAINT FK_attendance_students FOREIGN KEY (student_id) REFERENCES dbo.students(id),
  CONSTRAINT UQ_attendance_student_date UNIQUE (student_id, attendance_date)
);

CREATE TABLE dbo.tests (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  test_date DATE NOT NULL,
  student_id NVARCHAR(64) NOT NULL,
  subject_id NVARCHAR(64) NOT NULL,
  course_id NVARCHAR(64) NOT NULL,
  grade_type NVARCHAR(80) NOT NULL,
  test_name NVARCHAR(120) NOT NULL,
  score DECIMAL(9,2) NOT NULL,
  max_score DECIMAL(9,2) NOT NULL,
  CONSTRAINT FK_tests_students FOREIGN KEY (student_id) REFERENCES dbo.students(id),
  CONSTRAINT FK_tests_subjects FOREIGN KEY (subject_id) REFERENCES dbo.subjects(id),
  CONSTRAINT FK_tests_courses FOREIGN KEY (course_id) REFERENCES dbo.courses(id)
);

CREATE TABLE dbo.users (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  username NVARCHAR(120) NOT NULL UNIQUE,
  user_role NVARCHAR(20) NOT NULL,
  student_id NVARCHAR(64) NULL,
  password_hash NVARCHAR(255) NOT NULL,
  password_salt NVARCHAR(255) NULL,
  must_change_password BIT NOT NULL DEFAULT 0,
  created_at DATE NULL,
  updated_at DATE NULL,
  CONSTRAINT FK_users_students FOREIGN KEY (student_id) REFERENCES dbo.students(id)
);

CREATE INDEX IX_tests_student_date ON dbo.tests(student_id, test_date);
CREATE INDEX IX_attendance_student_date ON dbo.attendance(student_id, attendance_date);
