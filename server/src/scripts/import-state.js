const fs = require("fs");
const path = require("path");
const { sql, getPool } = require("../db");

function getArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1] || "";
}

function parseJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function uniqueById(items) {
  const map = new Map();
  (items || []).forEach((item) => {
    if (!item || !item.id) return;
    map.set(item.id, item);
  });
  return Array.from(map.values());
}

async function run() {
  const fileArg = getArg("--file");
  if (!fileArg) {
    throw new Error("Missing required argument: --file <path-to-exported-state-json>");
  }

  const importPath = path.resolve(process.cwd(), fileArg);
  const state = parseJson(importPath);
  const settings = state.settings || {};

  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    const students = uniqueById(state.students);
    for (const row of students) {
      await new sql.Request(tx)
        .input("id", sql.NVarChar(64), row.id)
        .input("first_name", sql.NVarChar(120), row.firstName || "")
        .input("last_name", sql.NVarChar(120), row.lastName || "")
        .input("birthdate", sql.Date, row.birthdate || null)
        .input("grade", sql.NVarChar(50), row.grade || "")
        .input("age_recorded", sql.Int, Number(row.ageRecorded || 0))
        .input("created_at", sql.Date, row.createdAt || null)
        .query(`
          INSERT INTO dbo.students (id, first_name, last_name, birthdate, grade, age_recorded, created_at)
          VALUES (@id, @first_name, @last_name, @birthdate, @grade, @age_recorded, @created_at)
        `);
    }

    const subjects = uniqueById(state.subjects);
    for (const row of subjects) {
      await new sql.Request(tx)
        .input("id", sql.NVarChar(64), row.id)
        .input("name", sql.NVarChar(120), row.name || "")
        .query(`INSERT INTO dbo.subjects (id, name) VALUES (@id, @name)`);
    }

    const courses = uniqueById(state.courses);
    for (const row of courses) {
      await new sql.Request(tx)
        .input("id", sql.NVarChar(64), row.id)
        .input("name", sql.NVarChar(150), row.name || "")
        .input("subject_id", sql.NVarChar(64), row.subjectId || "")
        .input("hours_per_day", sql.Decimal(6, 2), Number(row.hoursPerDay || 0))
        .query(`
          INSERT INTO dbo.courses (id, name, subject_id, hours_per_day)
          VALUES (@id, @name, @subject_id, @hours_per_day)
        `);
    }

    const enrollments = uniqueById(state.enrollments);
    for (const row of enrollments) {
      await new sql.Request(tx)
        .input("id", sql.NVarChar(64), row.id)
        .input("student_id", sql.NVarChar(64), row.studentId || "")
        .input("course_id", sql.NVarChar(64), row.courseId || "")
        .query(`
          INSERT INTO dbo.enrollments (id, student_id, course_id)
          VALUES (@id, @student_id, @course_id)
        `);
    }

    const schoolYears = uniqueById(settings.schoolYears);
    for (const row of schoolYears) {
      const isCurrent = row.id === settings.currentSchoolYearId ? 1 : 0;
      await new sql.Request(tx)
        .input("id", sql.NVarChar(64), row.id)
        .input("label", sql.NVarChar(100), row.label || "")
        .input("start_date", sql.Date, row.startDate || null)
        .input("end_date", sql.Date, row.endDate || null)
        .input("is_current", sql.Bit, isCurrent)
        .query(`
          INSERT INTO dbo.school_years (id, label, start_date, end_date, is_current)
          VALUES (@id, @label, @start_date, @end_date, @is_current)
        `);
    }

    const quarters = uniqueById(settings.allQuarters || settings.quarters);
    for (const row of quarters) {
      await new sql.Request(tx)
        .input("id", sql.NVarChar(64), row.id)
        .input("school_year_id", sql.NVarChar(64), row.schoolYearId || settings.currentSchoolYearId || "")
        .input("name", sql.NVarChar(20), row.name || "")
        .input("start_date", sql.Date, row.startDate || null)
        .input("end_date", sql.Date, row.endDate || null)
        .query(`
          INSERT INTO dbo.quarters (id, school_year_id, name, start_date, end_date)
          VALUES (@id, @school_year_id, @name, @start_date, @end_date)
        `);
    }

    const holidays = uniqueById(settings.holidays);
    for (const row of holidays) {
      await new sql.Request(tx)
        .input("id", sql.NVarChar(64), row.id)
        .input("name", sql.NVarChar(120), row.name || "")
        .input("holiday_type", sql.NVarChar(30), row.type || "Holiday")
        .input("start_date", sql.Date, row.startDate || null)
        .input("end_date", sql.Date, row.endDate || null)
        .query(`
          INSERT INTO dbo.holidays (id, name, holiday_type, start_date, end_date)
          VALUES (@id, @name, @holiday_type, @start_date, @end_date)
        `);
    }

    const gradeTypes = uniqueById(settings.gradeTypes);
    for (const row of gradeTypes) {
      const weight = row.weight == null || row.weight === "" ? null : Number(row.weight);
      await new sql.Request(tx)
        .input("id", sql.NVarChar(64), row.id)
        .input("name", sql.NVarChar(80), row.name || "")
        .input("weight", sql.Decimal(6, 2), weight)
        .query(`
          INSERT INTO dbo.grade_types (id, name, weight)
          VALUES (@id, @name, @weight)
        `);
    }

    const plans = uniqueById(state.plans);
    for (const row of plans) {
      const weekdaysJson = JSON.stringify(Array.isArray(row.weekdays) ? row.weekdays : []);
      await new sql.Request(tx)
        .input("id", sql.NVarChar(64), row.id)
        .input("plan_type", sql.NVarChar(30), row.planType || "")
        .input("student_id", sql.NVarChar(64), row.studentId || "")
        .input("course_id", sql.NVarChar(64), row.courseId || "")
        .input("start_date", sql.Date, row.startDate || null)
        .input("end_date", sql.Date, row.endDate || null)
        .input("weekdays_json", sql.NVarChar(100), weekdaysJson)
        .input("quarter_name", sql.NVarChar(20), row.quarterName || null)
        .query(`
          INSERT INTO dbo.plans (id, plan_type, student_id, course_id, start_date, end_date, weekdays_json, quarter_name)
          VALUES (@id, @plan_type, @student_id, @course_id, @start_date, @end_date, @weekdays_json, @quarter_name)
        `);
    }

    const attendance = uniqueById(state.attendance);
    for (const row of attendance) {
      await new sql.Request(tx)
        .input("id", sql.NVarChar(64), row.id)
        .input("student_id", sql.NVarChar(64), row.studentId || "")
        .input("attendance_date", sql.Date, row.date || null)
        .input("present", sql.Bit, row.present ? 1 : 0)
        .query(`
          INSERT INTO dbo.attendance (id, student_id, attendance_date, present)
          VALUES (@id, @student_id, @attendance_date, @present)
        `);
    }

    const tests = uniqueById(state.tests);
    for (const row of tests) {
      await new sql.Request(tx)
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

    await tx.commit();

    const summary = {
      students: students.length,
      subjects: subjects.length,
      courses: courses.length,
      enrollments: enrollments.length,
      schoolYears: schoolYears.length,
      quarters: quarters.length,
      holidays: holidays.length,
      gradeTypes: gradeTypes.length,
      plans: plans.length,
      attendance: attendance.length,
      tests: tests.length
    };
    console.log("Import completed:", summary);
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    await pool.close();
  }
}

run().catch((error) => {
  console.error("Import failed:", error.message);
  process.exit(1);
});
