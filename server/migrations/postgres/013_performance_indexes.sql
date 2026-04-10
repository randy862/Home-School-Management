CREATE INDEX IF NOT EXISTS idx_attendance_date_student
  ON attendance(attendance_date, student_id);

CREATE INDEX IF NOT EXISTS idx_attendance_student_date_present
  ON attendance(student_id, attendance_date, present);

CREATE INDEX IF NOT EXISTS idx_actual_instruction_date_student_course
  ON actual_instruction_minutes(instruction_date, student_id, course_id);

CREATE INDEX IF NOT EXISTS idx_actual_instruction_student_date
  ON actual_instruction_minutes(student_id, instruction_date);

CREATE INDEX IF NOT EXISTS idx_actual_instruction_student_date_order
  ON actual_instruction_minutes(student_id, instruction_date, order_index);

CREATE INDEX IF NOT EXISTS idx_tests_date_student
  ON tests(test_date, student_id);

CREATE INDEX IF NOT EXISTS idx_tests_student_course_date
  ON tests(student_id, course_id, test_date);

CREATE INDEX IF NOT EXISTS idx_tests_student_subject_date
  ON tests(student_id, subject_id, test_date);

CREATE INDEX IF NOT EXISTS idx_enrollments_student_schedule
  ON enrollments(student_id, schedule_order, course_id);

CREATE INDEX IF NOT EXISTS idx_student_schedule_blocks_student_schedule
  ON student_schedule_blocks(student_id, schedule_order, schedule_block_id);

CREATE INDEX IF NOT EXISTS idx_plans_student_date_window
  ON plans(student_id, start_date, end_date, course_id);

CREATE INDEX IF NOT EXISTS idx_plans_course_date_window
  ON plans(course_id, start_date, end_date);
