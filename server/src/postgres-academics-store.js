const { getPostgresPool } = require("./postgres-db");

async function listSubjectsForUser(user) {
  const pool = getPostgresPool();
  if (user?.role === "student") {
    const result = await pool.query(`
      SELECT DISTINCT
        s.id,
        s.name
      FROM subjects s
      JOIN courses c ON c.subject_id = s.id
      JOIN enrollments e ON e.course_id = c.id
      WHERE e.student_id = $1
      ORDER BY lower(s.name)
    `, [user.studentId || ""]);
    return result.rows;
  }

  const result = await pool.query(`
    SELECT
      id,
      name
    FROM subjects
    ORDER BY lower(name)
  `);
  return result.rows;
}

async function listCoursesForUser(user) {
  const pool = getPostgresPool();
  if (user?.role === "student") {
    const result = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.subject_id AS "subjectId",
        c.hours_per_day AS "hoursPerDay",
        c.exclusive_resource AS "exclusiveResource"
      FROM courses c
      JOIN enrollments e ON e.course_id = c.id
      WHERE e.student_id = $1
      ORDER BY lower(c.name)
    `, [user.studentId || ""]);
    return result.rows.map((course) => ({
      ...course,
      hoursPerDay: Number(course.hoursPerDay || 0),
      exclusiveResource: !!course.exclusiveResource
    }));
  }

  const result = await pool.query(`
    SELECT
      id,
      name,
      subject_id AS "subjectId",
      hours_per_day AS "hoursPerDay",
      exclusive_resource AS "exclusiveResource"
    FROM courses
    ORDER BY lower(name)
  `);
  return result.rows.map((course) => ({
    ...course,
    hoursPerDay: Number(course.hoursPerDay || 0),
    exclusiveResource: !!course.exclusiveResource
  }));
}

async function listEnrollmentsForUser(user) {
  const pool = getPostgresPool();
  if (user?.role === "student") {
    const result = await pool.query(`
      SELECT
        id,
        student_id AS "studentId",
        course_id AS "courseId",
        schedule_order AS "scheduleOrder"
      FROM enrollments
      WHERE student_id = $1
      ORDER BY id
    `, [user.studentId || ""]);
    return result.rows.map((enrollment) => ({
      ...enrollment,
      scheduleOrder: enrollment.scheduleOrder == null ? null : Number(enrollment.scheduleOrder)
    }));
  }

  const result = await pool.query(`
    SELECT
      id,
      student_id AS "studentId",
      course_id AS "courseId",
      schedule_order AS "scheduleOrder"
    FROM enrollments
    ORDER BY id
  `);
  return result.rows.map((enrollment) => ({
    ...enrollment,
    scheduleOrder: enrollment.scheduleOrder == null ? null : Number(enrollment.scheduleOrder)
  }));
}

async function listSchoolYears() {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      label,
      start_date AS "startDate",
      end_date AS "endDate",
      required_instructional_days AS "requiredInstructionalDays",
      required_instructional_hours AS "requiredInstructionalHours",
      is_current AS "isCurrent"
    FROM school_years
    ORDER BY start_date
  `);
  return result.rows.map((year) => ({
    ...year,
    requiredInstructionalDays: year.requiredInstructionalDays == null ? null : Number(year.requiredInstructionalDays),
    requiredInstructionalHours: year.requiredInstructionalHours == null ? null : Number(year.requiredInstructionalHours),
    isCurrent: !!year.isCurrent
  }));
}

async function listQuarters() {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      school_year_id AS "schoolYearId",
      name,
      start_date AS "startDate",
      end_date AS "endDate"
    FROM quarters
    ORDER BY start_date
  `);
  return result.rows;
}

async function listAttendanceForUser(user) {
  const pool = getPostgresPool();
  if (user?.role === "student") {
    const result = await pool.query(`
      SELECT
        id,
        student_id AS "studentId",
        attendance_date AS "date",
        present
      FROM attendance
      WHERE student_id = $1
      ORDER BY attendance_date
    `, [user.studentId || ""]);
    return result.rows.map((row) => ({
      ...row,
      present: !!row.present
    }));
  }

  const result = await pool.query(`
    SELECT
      id,
      student_id AS "studentId",
      attendance_date AS "date",
      present
    FROM attendance
    ORDER BY attendance_date
  `);
  return result.rows.map((row) => ({
    ...row,
    present: !!row.present
  }));
}

async function listTestsForUser(user) {
  const pool = getPostgresPool();
  if (user?.role === "student") {
    const result = await pool.query(`
      SELECT
        id,
        test_date AS "date",
        student_id AS "studentId",
        subject_id AS "subjectId",
        course_id AS "courseId",
        grade_type AS "gradeType",
        test_name AS "testName",
        score,
        max_score AS "maxScore"
      FROM tests
      WHERE student_id = $1
      ORDER BY test_date
    `, [user.studentId || ""]);
    return result.rows.map((row) => ({
      ...row,
      score: Number(row.score || 0),
      maxScore: Number(row.maxScore || 0)
    }));
  }

  const result = await pool.query(`
    SELECT
      id,
      test_date AS "date",
      student_id AS "studentId",
      subject_id AS "subjectId",
      course_id AS "courseId",
      grade_type AS "gradeType",
      test_name AS "testName",
      score,
      max_score AS "maxScore"
    FROM tests
    ORDER BY test_date
  `);
  return result.rows.map((row) => ({
    ...row,
    score: Number(row.score || 0),
    maxScore: Number(row.maxScore || 0)
  }));
}

module.exports = {
  listAttendanceForUser,
  listCoursesForUser,
  listEnrollmentsForUser,
  listQuarters,
  listSchoolYears,
  listSubjectsForUser,
  listTestsForUser
};
