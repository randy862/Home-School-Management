const { sql, getPool } = require("./db");

const DEFAULT_GRADE_TYPES = ["Assignment", "Quiz", "Test", "Quarterly Final", "Final"];
const DEFAULT_LETTER_GRADE_SCALE = [
  { label: "A", start: 90, end: 100 },
  { label: "B", start: 80, end: 89 },
  { label: "C", start: 70, end: 79 },
  { label: "D", start: 60, end: 69 },
  { label: "F", start: 0, end: 59 }
];

function toIsoDate(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

function fallbackSettings() {
  const year = new Date().getFullYear();
  const schoolYearId = "default-school-year";
  const schoolYear = { id: schoolYearId, label: `${year}-${year + 1}`, startDate: `${year}-01-01`, endDate: `${year}-12-31`, requiredInstructionalDays: null, requiredInstructionalHours: null };
  const quarters = [
    { id: "default-q1", schoolYearId, name: "Q1", startDate: `${year}-01-01`, endDate: `${year}-03-31` },
    { id: "default-q2", schoolYearId, name: "Q2", startDate: `${year}-04-01`, endDate: `${year}-06-30` },
    { id: "default-q3", schoolYearId, name: "Q3", startDate: `${year}-07-01`, endDate: `${year}-09-30` },
    { id: "default-q4", schoolYearId, name: "Q4", startDate: `${year}-10-01`, endDate: `${year}-12-31` }
  ];
  return {
    schoolYear,
    schoolYears: [schoolYear],
    currentSchoolYearId: schoolYearId,
    quarters: quarters.map((q) => ({ ...q })),
    allQuarters: quarters,
    dailyBreaks: [],
    holidays: [],
    gradeTypes: DEFAULT_GRADE_TYPES.map((name, idx) => ({ id: `default-grade-type-${idx + 1}`, name, weight: null })),
    gradingCriteria: {
      letterScale: DEFAULT_LETTER_GRADE_SCALE.map(({ label }) => ({ label, start: null, end: null })),
      gpaScaleOption: "4",
      gpaMax: 4
    }
  };
}

function fallbackUsers() {
  return [{
    id: "default-admin-user",
    username: "admin",
    role: "admin",
    studentId: "",
    passwordHash: "legacy-115582537",
    passwordSalt: "",
    mustChangePassword: true,
    createdAt: toIsoDate(new Date()),
    updatedAt: toIsoDate(new Date())
  }];
}

async function readState() {
  const pool = await getPool();
  const schoolYearColumns = await pool.request().query(`
    SELECT
      CAST(CASE WHEN COL_LENGTH('dbo.school_years', 'required_instructional_days') IS NULL THEN 0 ELSE 1 END AS INT) AS has_required_instructional_days,
      CAST(CASE WHEN COL_LENGTH('dbo.school_years', 'required_instructional_hours') IS NULL THEN 0 ELSE 1 END AS INT) AS has_required_instructional_hours
  `);
  const hasRequiredInstructionalDays = !!schoolYearColumns.recordset[0]?.has_required_instructional_days;
  const hasRequiredInstructionalHours = !!schoolYearColumns.recordset[0]?.has_required_instructional_hours;
  const schoolYearsQuery = hasRequiredInstructionalDays && hasRequiredInstructionalHours
    ? `
      SELECT
        id,
        label,
        start_date,
        end_date,
        required_instructional_days,
        required_instructional_hours,
        is_current
      FROM dbo.school_years
      ORDER BY start_date
    `
    : `
      SELECT
        id,
        label,
        start_date,
        end_date,
        CAST(NULL AS INT) AS required_instructional_days,
        CAST(NULL AS DECIMAL(8,2)) AS required_instructional_hours,
        is_current
      FROM dbo.school_years
      ORDER BY start_date
    `;
  const queries = [
    "SELECT id, first_name, last_name, birthdate, grade, age_recorded, created_at FROM dbo.students ORDER BY last_name, first_name",
    "SELECT id, name FROM dbo.subjects ORDER BY name",
    `
      SELECT
        id,
        name,
        subject_id,
        hours_per_day,
        CASE
          WHEN COL_LENGTH('dbo.courses', 'resource_group') IS NULL THEN CAST('' AS NVARCHAR(150))
          ELSE resource_group
        END AS resource_group,
        CASE
          WHEN COL_LENGTH('dbo.courses', 'resource_capacity') IS NULL THEN NULL
          ELSE resource_capacity
        END AS resource_capacity,
        CASE
          WHEN COL_LENGTH('dbo.courses', 'exclusive_resource') IS NULL THEN CAST(0 AS bit)
          ELSE exclusive_resource
        END AS exclusive_resource
      FROM dbo.courses
      ORDER BY name
    `,
    `
      SELECT
        id,
        student_id,
        course_id,
        CASE
          WHEN COL_LENGTH('dbo.enrollments', 'schedule_order') IS NULL THEN NULL
          ELSE schedule_order
        END AS schedule_order
      FROM dbo.enrollments
      ORDER BY id
    `,
    schoolYearsQuery,
    "SELECT id, school_year_id, name, start_date, end_date FROM dbo.quarters ORDER BY start_date",
    `
      IF OBJECT_ID('dbo.daily_breaks', 'U') IS NULL
      BEGIN
        SELECT
          CAST(NULL AS NVARCHAR(64)) AS id,
          CAST(NULL AS NVARCHAR(64)) AS school_year_id,
          CAST(NULL AS NVARCHAR(MAX)) AS student_ids_json,
          CAST(NULL AS NVARCHAR(30)) AS break_type,
          CAST(NULL AS NVARCHAR(150)) AS description,
          CAST(NULL AS NVARCHAR(5)) AS start_time,
          CAST(NULL AS INT) AS duration_minutes,
          CAST(NULL AS NVARCHAR(100)) AS weekdays_json
        WHERE 1 = 0
      END
      ELSE
      BEGIN
        SELECT id, school_year_id, student_ids_json, break_type, description, start_time, duration_minutes, weekdays_json
        FROM dbo.daily_breaks
        ORDER BY start_time
      END
    `,
    "SELECT id, name, holiday_type, start_date, end_date FROM dbo.holidays ORDER BY start_date",
    "SELECT id, name, weight FROM dbo.grade_types ORDER BY name",
    `
      IF OBJECT_ID('dbo.grading_criteria', 'U') IS NULL
      BEGIN
        SELECT
          CAST(NULL AS NVARCHAR(MAX)) AS letter_scale_json,
          CAST(NULL AS NVARCHAR(20)) AS gpa_scale_option,
          CAST(NULL AS INT) AS gpa_max
        WHERE 1 = 0
      END
      ELSE
      BEGIN
        SELECT TOP 1 letter_scale_json, gpa_scale_option, gpa_max
        FROM dbo.grading_criteria
      END
    `,
    "SELECT id, plan_type, student_id, course_id, start_date, end_date, weekdays_json, quarter_name FROM dbo.plans ORDER BY start_date",
    "SELECT id, student_id, attendance_date, present FROM dbo.attendance ORDER BY attendance_date",
    "SELECT id, test_date, student_id, subject_id, course_id, grade_type, test_name, score, max_score FROM dbo.tests ORDER BY test_date",
    `
      IF OBJECT_ID('dbo.users', 'U') IS NULL
      BEGIN
        SELECT
          CAST(NULL AS NVARCHAR(64)) AS id,
          CAST(NULL AS NVARCHAR(120)) AS username,
          CAST(NULL AS NVARCHAR(20)) AS user_role,
          CAST(NULL AS NVARCHAR(64)) AS student_id,
          CAST(NULL AS NVARCHAR(255)) AS password_hash,
          CAST(NULL AS NVARCHAR(255)) AS password_salt,
          CAST(NULL AS BIT) AS must_change_password,
          CAST(NULL AS DATE) AS created_at,
          CAST(NULL AS DATE) AS updated_at
        WHERE 1 = 0
      END
      ELSE
      BEGIN
        SELECT id, username, user_role, student_id, password_hash, password_salt, must_change_password, created_at, updated_at
        FROM dbo.users
        ORDER BY username
      END
    `
  ];

  const [
    studentsR,
    subjectsR,
    coursesR,
    enrollmentsR,
    schoolYearsR,
    quartersR,
    dailyBreaksR,
    holidaysR,
    gradeTypesR,
    gradingCriteriaR,
    plansR,
    attendanceR,
    testsR,
    usersR
  ] = await Promise.all(queries.map((text) => pool.request().query(text)));

  const students = studentsR.recordset.map((r) => ({
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    birthdate: toIsoDate(r.birthdate),
    grade: r.grade,
    ageRecorded: r.age_recorded == null ? null : Number(r.age_recorded),
    createdAt: toIsoDate(r.created_at)
  }));

  const subjects = subjectsR.recordset.map((r) => ({ id: r.id, name: r.name }));
  const courses = coursesR.recordset.map((r) => ({
    id: r.id,
    name: r.name,
    subjectId: r.subject_id,
    hoursPerDay: Number(r.hours_per_day),
    exclusiveResource: !!r.exclusive_resource,
    resourceGroup: r.resource_group || "",
    resourceCapacity: r.resource_capacity == null ? null : Number(r.resource_capacity)
  }));
  const enrollments = enrollmentsR.recordset.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    courseId: r.course_id,
    scheduleOrder: r.schedule_order == null ? null : Number(r.schedule_order)
  }));

  const schoolYears = schoolYearsR.recordset.map((r) => ({
    id: r.id,
    label: r.label,
    startDate: toIsoDate(r.start_date),
    endDate: toIsoDate(r.end_date),
    requiredInstructionalDays: r.required_instructional_days == null ? null : Number(r.required_instructional_days),
    requiredInstructionalHours: r.required_instructional_hours == null ? null : Number(r.required_instructional_hours),
    isCurrent: !!r.is_current
  }));
  const allQuarters = quartersR.recordset.map((r) => ({
    id: r.id,
    schoolYearId: r.school_year_id,
    name: r.name,
    startDate: toIsoDate(r.start_date),
    endDate: toIsoDate(r.end_date)
  }));
  const dailyBreaks = dailyBreaksR.recordset.map((r) => {
    let studentIds = [];
    let weekdays = [];
    try {
      studentIds = JSON.parse(r.student_ids_json || "[]");
      if (!Array.isArray(studentIds)) studentIds = [];
    } catch {
      studentIds = [];
    }
    try {
      weekdays = JSON.parse(r.weekdays_json || "[]");
      if (!Array.isArray(weekdays)) weekdays = [];
    } catch {
      weekdays = [];
    }
    return {
      id: r.id,
      schoolYearId: r.school_year_id,
      studentIds,
      type: r.break_type,
      description: r.description || "",
      startTime: r.start_time || "12:00",
      durationMinutes: r.duration_minutes == null ? 60 : Number(r.duration_minutes),
      weekdays
    };
  });
  const holidays = holidaysR.recordset.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.holiday_type,
    startDate: toIsoDate(r.start_date),
    endDate: toIsoDate(r.end_date)
  }));
  const gradeTypes = gradeTypesR.recordset.map((r) => ({
    id: r.id,
    name: r.name,
    weight: r.weight == null ? null : Number(r.weight)
  }));
  let gradingLetterScale = DEFAULT_LETTER_GRADE_SCALE.map(({ label }) => ({ label, start: null, end: null }));
  const gradingCriteriaRow = gradingCriteriaR.recordset[0];
  if (gradingCriteriaRow?.letter_scale_json) {
    try {
      const parsed = JSON.parse(gradingCriteriaRow.letter_scale_json);
      if (Array.isArray(parsed)) gradingLetterScale = parsed;
    } catch {
      gradingLetterScale = DEFAULT_LETTER_GRADE_SCALE.map(({ label }) => ({ label, start: null, end: null }));
    }
  }

  const plans = plansR.recordset.map((r) => {
    let weekdays = [];
    try {
      weekdays = JSON.parse(r.weekdays_json || "[]");
      if (!Array.isArray(weekdays)) weekdays = [];
    } catch {
      weekdays = [];
    }
    return {
      id: r.id,
      planType: r.plan_type,
      studentId: r.student_id,
      courseId: r.course_id,
      startDate: toIsoDate(r.start_date),
      endDate: toIsoDate(r.end_date),
      weekdays,
      ...(r.quarter_name ? { quarterName: r.quarter_name } : {})
    };
  });

  const attendance = attendanceR.recordset.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    date: toIsoDate(r.attendance_date),
    present: !!r.present
  }));

  const tests = testsR.recordset.map((r) => ({
    id: r.id,
    date: toIsoDate(r.test_date),
    studentId: r.student_id,
    subjectId: r.subject_id,
    courseId: r.course_id,
    gradeType: r.grade_type,
    testName: r.test_name,
    score: Number(r.score),
    maxScore: Number(r.max_score)
  }));
  const users = usersR.recordset.map((r) => ({
    id: r.id,
    username: r.username,
    role: r.user_role,
    studentId: r.student_id || "",
    passwordHash: r.password_hash,
    passwordSalt: r.password_salt || "",
    mustChangePassword: !!r.must_change_password,
    createdAt: toIsoDate(r.created_at),
    updatedAt: toIsoDate(r.updated_at)
  }));

  if (!schoolYears.length) {
    return { students, subjects, courses, enrollments, plans, attendance, tests, users: users.length ? users : fallbackUsers(), settings: fallbackSettings() };
  }

  const current = schoolYears.find((year) => year.isCurrent) || schoolYears[0];
  const settings = {
    schoolYear: {
      label: current.label,
      startDate: current.startDate,
      endDate: current.endDate,
      requiredInstructionalDays: current.requiredInstructionalDays,
      requiredInstructionalHours: current.requiredInstructionalHours
    },
    schoolYears: schoolYears.map(({ isCurrent, ...rest }) => rest),
    currentSchoolYearId: current.id,
    quarters: allQuarters.filter((q) => q.schoolYearId === current.id),
    allQuarters,
    dailyBreaks,
    holidays,
    gradeTypes: gradeTypes.length
      ? gradeTypes
      : DEFAULT_GRADE_TYPES.map((name, idx) => ({ id: `default-grade-type-${idx + 1}`, name, weight: null })),
    gradingCriteria: {
      letterScale: gradingLetterScale,
      gpaScaleOption: gradingCriteriaRow?.gpa_scale_option || "4",
      gpaMax: gradingCriteriaRow?.gpa_max == null ? 4 : Number(gradingCriteriaRow.gpa_max)
    }
  };

  return { students, subjects, courses, enrollments, plans, attendance, tests, users: users.length ? users : fallbackUsers(), settings };
}

function uniqueById(items) {
  const map = new Map();
  (items || []).forEach((item) => {
    if (!item || !item.id) return;
    map.set(item.id, item);
  });
  return Array.from(map.values());
}

async function writeState(state) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const request = () => new sql.Request(tx);
    await request().query(`
      IF OBJECT_ID('dbo.users', 'U') IS NULL
      BEGIN
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
        )
      END
    `);
    await request().query("DELETE FROM dbo.tests");
    await request().query("DELETE FROM dbo.users");
    await request().query("DELETE FROM dbo.attendance");
    await request().query("DELETE FROM dbo.plans");
    await request().query("DELETE FROM dbo.enrollments");
    await request().query("DELETE FROM dbo.courses");
    await request().query("DELETE FROM dbo.subjects");
    await request().query("DELETE FROM dbo.students");
    await request().query(`
      IF OBJECT_ID('dbo.daily_breaks', 'U') IS NULL
      BEGIN
        CREATE TABLE dbo.daily_breaks (
          id NVARCHAR(64) NOT NULL PRIMARY KEY,
          school_year_id NVARCHAR(64) NOT NULL,
          student_ids_json NVARCHAR(MAX) NOT NULL,
          break_type NVARCHAR(30) NOT NULL,
          description NVARCHAR(150) NULL,
          start_time NVARCHAR(5) NOT NULL,
          duration_minutes INT NOT NULL,
          weekdays_json NVARCHAR(100) NOT NULL,
          CONSTRAINT FK_daily_breaks_school_years FOREIGN KEY (school_year_id) REFERENCES dbo.school_years(id)
        )
      END
    `);
    await request().query("DELETE FROM dbo.daily_breaks");
    await request().query("DELETE FROM dbo.holidays");
    await request().query("DELETE FROM dbo.quarters");
    await request().query("DELETE FROM dbo.school_years");
    await request().query("DELETE FROM dbo.grade_types");
    await request().query(`
      IF OBJECT_ID('dbo.grading_criteria', 'U') IS NULL
      BEGIN
        CREATE TABLE dbo.grading_criteria (
          id NVARCHAR(64) NOT NULL PRIMARY KEY,
          letter_scale_json NVARCHAR(MAX) NOT NULL,
          gpa_scale_option NVARCHAR(20) NOT NULL,
          gpa_max INT NOT NULL
        )
      END
    `);
    await request().query("DELETE FROM dbo.grading_criteria");

    const students = uniqueById(state.students);
    for (const row of students) {
      await request()
        .input("id", sql.NVarChar(64), row.id)
        .input("first_name", sql.NVarChar(120), row.firstName || "")
        .input("last_name", sql.NVarChar(120), row.lastName || "")
        .input("birthdate", sql.Date, row.birthdate || null)
        .input("grade", sql.NVarChar(50), row.grade || "")
        .input("age_recorded", sql.Int, row.ageRecorded == null ? null : Number(row.ageRecorded))
        .input("created_at", sql.Date, row.createdAt || null)
        .query(`
          INSERT INTO dbo.students (id, first_name, last_name, birthdate, grade, age_recorded, created_at)
          VALUES (@id, @first_name, @last_name, @birthdate, @grade, @age_recorded, @created_at)
        `);
    }

    const subjects = uniqueById(state.subjects);
    for (const row of subjects) {
      await request()
        .input("id", sql.NVarChar(64), row.id)
        .input("name", sql.NVarChar(120), row.name || "")
        .query("INSERT INTO dbo.subjects (id, name) VALUES (@id, @name)");
    }

    const courses = uniqueById(state.courses);
    await request().query(`
      IF COL_LENGTH('dbo.courses', 'exclusive_resource') IS NULL
      BEGIN
        ALTER TABLE dbo.courses
        ADD exclusive_resource BIT NOT NULL CONSTRAINT DF_courses_exclusive_resource DEFAULT 0
      END
    `);
    await request().query(`
      IF COL_LENGTH('dbo.courses', 'resource_group') IS NULL
      BEGIN
        ALTER TABLE dbo.courses
        ADD resource_group NVARCHAR(150) NOT NULL CONSTRAINT DF_courses_resource_group DEFAULT ''
      END
    `);
    await request().query(`
      IF COL_LENGTH('dbo.courses', 'resource_capacity') IS NULL
      BEGIN
        ALTER TABLE dbo.courses
        ADD resource_capacity INT NULL
      END
    `);
    for (const row of courses) {
      await request()
        .input("id", sql.NVarChar(64), row.id)
        .input("name", sql.NVarChar(150), row.name || "")
        .input("subject_id", sql.NVarChar(64), row.subjectId || "")
        .input("hours_per_day", sql.Decimal(6, 2), Number(row.hoursPerDay || 0))
        .input("exclusive_resource", sql.Bit, row.exclusiveResource ? 1 : 0)
        .input("resource_group", sql.NVarChar(150), row.resourceGroup || "")
        .input("resource_capacity", sql.Int, row.resourceCapacity == null ? null : Number(row.resourceCapacity))
        .query("INSERT INTO dbo.courses (id, name, subject_id, hours_per_day, exclusive_resource, resource_group, resource_capacity) VALUES (@id, @name, @subject_id, @hours_per_day, @exclusive_resource, @resource_group, @resource_capacity)");
    }

    await request().query(`
      IF COL_LENGTH('dbo.enrollments', 'schedule_order') IS NULL
      BEGIN
        ALTER TABLE dbo.enrollments
        ADD schedule_order INT NULL
      END
    `);

    const enrollments = uniqueById(state.enrollments);
    for (const row of enrollments) {
      await request()
        .input("id", sql.NVarChar(64), row.id)
        .input("student_id", sql.NVarChar(64), row.studentId || "")
        .input("course_id", sql.NVarChar(64), row.courseId || "")
        .input("schedule_order", sql.Int, row.scheduleOrder == null ? null : Number(row.scheduleOrder))
        .query("INSERT INTO dbo.enrollments (id, student_id, course_id, schedule_order) VALUES (@id, @student_id, @course_id, @schedule_order)");
    }

    const settings = state.settings || {};
    const schoolYears = uniqueById(settings.schoolYears);
    for (const row of schoolYears) {
      await request()
        .input("id", sql.NVarChar(64), row.id)
        .input("label", sql.NVarChar(100), row.label || "")
        .input("start_date", sql.Date, row.startDate || null)
        .input("end_date", sql.Date, row.endDate || null)
        .input("required_instructional_days", sql.Int, row.requiredInstructionalDays == null ? null : Number(row.requiredInstructionalDays))
        .input("required_instructional_hours", sql.Decimal(8, 2), row.requiredInstructionalHours == null ? null : Number(row.requiredInstructionalHours))
        .input("is_current", sql.Bit, row.id === settings.currentSchoolYearId ? 1 : 0)
        .query(`
          IF COL_LENGTH('dbo.school_years', 'required_instructional_days') IS NULL
          BEGIN
            ALTER TABLE dbo.school_years ADD required_instructional_days INT NULL
          END
          IF COL_LENGTH('dbo.school_years', 'required_instructional_hours') IS NULL
          BEGIN
            ALTER TABLE dbo.school_years ADD required_instructional_hours DECIMAL(8,2) NULL
          END
          INSERT INTO dbo.school_years (id, label, start_date, end_date, required_instructional_days, required_instructional_hours, is_current)
          VALUES (@id, @label, @start_date, @end_date, @required_instructional_days, @required_instructional_hours, @is_current)
        `);
    }

    const quarters = uniqueById(settings.allQuarters || settings.quarters);
    for (const row of quarters) {
      await request()
        .input("id", sql.NVarChar(64), row.id)
        .input("school_year_id", sql.NVarChar(64), row.schoolYearId || settings.currentSchoolYearId || "")
        .input("name", sql.NVarChar(20), row.name || "")
        .input("start_date", sql.Date, row.startDate || null)
        .input("end_date", sql.Date, row.endDate || null)
        .query("INSERT INTO dbo.quarters (id, school_year_id, name, start_date, end_date) VALUES (@id, @school_year_id, @name, @start_date, @end_date)");
    }

    const dailyBreaks = uniqueById(settings.dailyBreaks);
    for (const row of dailyBreaks) {
      await request()
        .input("id", sql.NVarChar(64), row.id)
        .input("school_year_id", sql.NVarChar(64), row.schoolYearId || settings.currentSchoolYearId || "")
        .input("student_ids_json", sql.NVarChar(sql.MAX), JSON.stringify(Array.isArray(row.studentIds) ? row.studentIds : []))
        .input("break_type", sql.NVarChar(30), row.type || "lunch")
        .input("description", sql.NVarChar(150), row.description || null)
        .input("start_time", sql.NVarChar(5), row.startTime || "12:00")
        .input("duration_minutes", sql.Int, Number(row.durationMinutes || 60))
        .input("weekdays_json", sql.NVarChar(100), JSON.stringify(Array.isArray(row.weekdays) ? row.weekdays : []))
        .query(`
          INSERT INTO dbo.daily_breaks (id, school_year_id, student_ids_json, break_type, description, start_time, duration_minutes, weekdays_json)
          VALUES (@id, @school_year_id, @student_ids_json, @break_type, @description, @start_time, @duration_minutes, @weekdays_json)
        `);
    }

    const holidays = uniqueById(settings.holidays);
    for (const row of holidays) {
      await request()
        .input("id", sql.NVarChar(64), row.id)
        .input("name", sql.NVarChar(120), row.name || "")
        .input("holiday_type", sql.NVarChar(30), row.type || "Holiday")
        .input("start_date", sql.Date, row.startDate || null)
        .input("end_date", sql.Date, row.endDate || null)
        .query("INSERT INTO dbo.holidays (id, name, holiday_type, start_date, end_date) VALUES (@id, @name, @holiday_type, @start_date, @end_date)");
    }

    const gradeTypes = uniqueById(settings.gradeTypes);
    for (const row of gradeTypes) {
      await request()
        .input("id", sql.NVarChar(64), row.id)
        .input("name", sql.NVarChar(80), row.name || "")
        .input("weight", sql.Decimal(6, 2), row.weight == null || row.weight === "" ? null : Number(row.weight))
        .query("INSERT INTO dbo.grade_types (id, name, weight) VALUES (@id, @name, @weight)");
    }

    const gradingCriteria = settings.gradingCriteria || {};
    await request()
      .input("id", sql.NVarChar(64), "grading-criteria")
      .input("letter_scale_json", sql.NVarChar(sql.MAX), JSON.stringify(Array.isArray(gradingCriteria.letterScale) ? gradingCriteria.letterScale : DEFAULT_LETTER_GRADE_SCALE.map(({ label }) => ({ label, start: null, end: null }))))
      .input("gpa_scale_option", sql.NVarChar(20), gradingCriteria.gpaScaleOption || "4")
      .input("gpa_max", sql.Int, Number(gradingCriteria.gpaMax || 4))
      .query(`
        INSERT INTO dbo.grading_criteria (id, letter_scale_json, gpa_scale_option, gpa_max)
        VALUES (@id, @letter_scale_json, @gpa_scale_option, @gpa_max)
      `);

    const plans = uniqueById(state.plans);
    for (const row of plans) {
      await request()
        .input("id", sql.NVarChar(64), row.id)
        .input("plan_type", sql.NVarChar(30), row.planType || "")
        .input("student_id", sql.NVarChar(64), row.studentId || "")
        .input("course_id", sql.NVarChar(64), row.courseId || "")
        .input("start_date", sql.Date, row.startDate || null)
        .input("end_date", sql.Date, row.endDate || null)
        .input("weekdays_json", sql.NVarChar(100), JSON.stringify(Array.isArray(row.weekdays) ? row.weekdays : []))
        .input("quarter_name", sql.NVarChar(20), row.quarterName || null)
        .query(`
          INSERT INTO dbo.plans (id, plan_type, student_id, course_id, start_date, end_date, weekdays_json, quarter_name)
          VALUES (@id, @plan_type, @student_id, @course_id, @start_date, @end_date, @weekdays_json, @quarter_name)
        `);
    }

    const attendance = uniqueById(state.attendance);
    for (const row of attendance) {
      await request()
        .input("id", sql.NVarChar(64), row.id)
        .input("student_id", sql.NVarChar(64), row.studentId || "")
        .input("attendance_date", sql.Date, row.date || null)
        .input("present", sql.Bit, row.present ? 1 : 0)
        .query("INSERT INTO dbo.attendance (id, student_id, attendance_date, present) VALUES (@id, @student_id, @attendance_date, @present)");
    }

    const tests = uniqueById(state.tests);
    for (const row of tests) {
      await request()
        .input("id", sql.NVarChar(64), row.id)
        .input("test_date", sql.Date, row.date || null)
        .input("student_id", sql.NVarChar(64), row.studentId || "")
        .input("subject_id", sql.NVarChar(64), row.subjectId || "")
        .input("course_id", sql.NVarChar(64), row.courseId || "")
        .input("grade_type", sql.NVarChar(80), row.gradeType || row.testName || "Test")
        .input("test_name", sql.NVarChar(120), row.testName || row.gradeType || "Test")
        .input("score", sql.Decimal(9, 2), Number(row.score || 0))
        .input("max_score", sql.Decimal(9, 2), Number(row.maxScore || 100))
        .query(`
          INSERT INTO dbo.tests (id, test_date, student_id, subject_id, course_id, grade_type, test_name, score, max_score)
          VALUES (@id, @test_date, @student_id, @subject_id, @course_id, @grade_type, @test_name, @score, @max_score)
        `);
    }

    const users = uniqueById(state.users);
    for (const row of users) {
      await request()
        .input("id", sql.NVarChar(64), row.id)
        .input("username", sql.NVarChar(120), row.username || "")
        .input("user_role", sql.NVarChar(20), row.role === "student" ? "student" : "admin")
        .input("student_id", sql.NVarChar(64), row.studentId || null)
        .input("password_hash", sql.NVarChar(255), row.passwordHash || "")
        .input("password_salt", sql.NVarChar(255), row.passwordSalt || null)
        .input("must_change_password", sql.Bit, row.mustChangePassword ? 1 : 0)
        .input("created_at", sql.Date, row.createdAt || null)
        .input("updated_at", sql.Date, row.updatedAt || null)
        .query(`
          INSERT INTO dbo.users (id, username, user_role, student_id, password_hash, password_salt, must_change_password, created_at, updated_at)
          VALUES (@id, @username, @user_role, @student_id, @password_hash, @password_salt, @must_change_password, @created_at, @updated_at)
        `);
    }

    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

module.exports = {
  readState,
  writeState
};
