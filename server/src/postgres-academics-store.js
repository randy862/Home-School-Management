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

async function createSubject(subject) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    INSERT INTO subjects (id, name)
    VALUES ($1, $2)
    RETURNING
      id,
      name
  `, [subject.id, subject.name]);
  return result.rows[0];
}

async function updateSubject(id, subject) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    UPDATE subjects
    SET name = $2
    WHERE id = $1
    RETURNING
      id,
      name
  `, [id, subject.name]);
  return result.rows[0] || null;
}

async function deleteSubject(id) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const courseIdsResult = await client.query("SELECT id FROM courses WHERE subject_id = $1", [id]);
    const courseIds = courseIdsResult.rows.map((row) => row.id);
    if (courseIds.length) {
      await client.query("DELETE FROM tests WHERE subject_id = $1 OR course_id = ANY($2::text[])", [id, courseIds]);
      await client.query("DELETE FROM courses WHERE id = ANY($1::text[])", [courseIds]);
    } else {
      await client.query("DELETE FROM tests WHERE subject_id = $1", [id]);
    }
    const result = await client.query("DELETE FROM subjects WHERE id = $1", [id]);
    await client.query("COMMIT");
    return result.rowCount > 0;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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
        c.exclusive_resource AS "exclusiveResource",
        c.course_materials AS "courseMaterials"
      FROM courses c
      JOIN enrollments e ON e.course_id = c.id
      WHERE e.student_id = $1
      ORDER BY lower(c.name)
    `, [user.studentId || ""]);
    return result.rows.map((course) => ({
      ...course,
      hoursPerDay: Number(course.hoursPerDay || 0),
      exclusiveResource: !!course.exclusiveResource,
      materials: normalizeCourseMaterials(course.courseMaterials)
    }));
  }

  const result = await pool.query(`
    SELECT
      id,
      name,
      subject_id AS "subjectId",
      hours_per_day AS "hoursPerDay",
      exclusive_resource AS "exclusiveResource",
      course_materials AS "courseMaterials"
    FROM courses
    ORDER BY lower(name)
  `);
  return result.rows.map((course) => ({
    ...course,
    hoursPerDay: Number(course.hoursPerDay || 0),
    exclusiveResource: !!course.exclusiveResource,
    materials: normalizeCourseMaterials(course.courseMaterials)
  }));
}

async function createCourse(course) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    INSERT INTO courses (id, name, subject_id, hours_per_day, exclusive_resource, course_materials)
    VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    RETURNING
      id,
      name,
      subject_id AS "subjectId",
      hours_per_day AS "hoursPerDay",
      exclusive_resource AS "exclusiveResource",
      course_materials AS "courseMaterials"
  `, [
    course.id,
    course.name,
    course.subjectId,
    course.hoursPerDay,
    course.exclusiveResource,
    JSON.stringify(normalizeCourseMaterials(course.materials || course.material))
  ]);
  return {
    ...result.rows[0],
    hoursPerDay: Number(result.rows[0].hoursPerDay || 0),
    exclusiveResource: !!result.rows[0].exclusiveResource,
    materials: normalizeCourseMaterials(result.rows[0].courseMaterials)
  };
}

async function updateCourse(id, course) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    UPDATE courses
    SET
      name = $2,
      subject_id = $3,
      hours_per_day = $4,
      exclusive_resource = $5,
      course_materials = $6::jsonb
    WHERE id = $1
    RETURNING
      id,
      name,
      subject_id AS "subjectId",
      hours_per_day AS "hoursPerDay",
      exclusive_resource AS "exclusiveResource",
      course_materials AS "courseMaterials"
  `, [
    id,
    course.name,
    course.subjectId,
    course.hoursPerDay,
    course.exclusiveResource,
    JSON.stringify(normalizeCourseMaterials(course.materials || course.material))
  ]);
  return result.rows[0]
    ? {
      ...result.rows[0],
      hoursPerDay: Number(result.rows[0].hoursPerDay || 0),
      exclusiveResource: !!result.rows[0].exclusiveResource,
      materials: normalizeCourseMaterials(result.rows[0].courseMaterials)
    }
    : null;
}

function hasCourseMaterialDetails(material) {
  return !!(material.type || material.other || material.isbn || material.title || material.publisher);
}

function normalizeCourseMaterials(materialsInput) {
  const rawMaterials = Array.isArray(materialsInput)
    ? materialsInput
    : (materialsInput ? [materialsInput] : []);
  return rawMaterials
    .map(normalizeCourseMaterial)
    .filter(hasCourseMaterialDetails);
}

function normalizeCourseMaterial(material) {
  const allowedTypes = new Set(["text_book", "workbook", "worksheets", "online_content", "other"]);
  const rawType = String(material?.type || "").trim().toLowerCase();
  const type = allowedTypes.has(rawType) ? rawType : "";
  return {
    type,
    other: type === "other" ? String(material?.other || "").trim() : "",
    isbn: String(material?.isbn || "").trim(),
    title: String(material?.title || "").trim(),
    publisher: String(material?.publisher || "").trim()
  };
}

async function deleteCourse(id) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM tests WHERE course_id = $1", [id]);
    const result = await client.query("DELETE FROM courses WHERE id = $1", [id]);
    await client.query("COMMIT");
    return result.rowCount > 0;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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

async function createEnrollment(enrollment) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    INSERT INTO enrollments (id, student_id, course_id, schedule_order)
    VALUES ($1, $2, $3, $4)
    RETURNING
      id,
      student_id AS "studentId",
      course_id AS "courseId",
      schedule_order AS "scheduleOrder"
  `, [enrollment.id, enrollment.studentId, enrollment.courseId, enrollment.scheduleOrder]);
  return {
    ...result.rows[0],
    scheduleOrder: result.rows[0].scheduleOrder == null ? null : Number(result.rows[0].scheduleOrder)
  };
}

async function updateEnrollment(id, enrollment) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    UPDATE enrollments
    SET
      student_id = $2,
      course_id = $3,
      schedule_order = $4
    WHERE id = $1
    RETURNING
      id,
      student_id AS "studentId",
      course_id AS "courseId",
      schedule_order AS "scheduleOrder"
  `, [id, enrollment.studentId, enrollment.courseId, enrollment.scheduleOrder]);
  return result.rows[0]
    ? {
      ...result.rows[0],
      scheduleOrder: result.rows[0].scheduleOrder == null ? null : Number(result.rows[0].scheduleOrder)
    }
    : null;
}

async function deleteEnrollment(id) {
  const pool = getPostgresPool();
  const result = await pool.query("DELETE FROM enrollments WHERE id = $1", [id]);
  return result.rowCount > 0;
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
  return result.rows.map(mapSchoolYearRow);
}

async function createSchoolYear(schoolYear) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (schoolYear.isCurrent) {
      await client.query("UPDATE school_years SET is_current = FALSE WHERE is_current = TRUE");
    }
    const result = await client.query(`
      INSERT INTO school_years (
        id,
        label,
        start_date,
        end_date,
        required_instructional_days,
        required_instructional_hours,
        is_current
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        id,
        label,
        start_date AS "startDate",
        end_date AS "endDate",
        required_instructional_days AS "requiredInstructionalDays",
        required_instructional_hours AS "requiredInstructionalHours",
        is_current AS "isCurrent"
    `, [
      schoolYear.id,
      schoolYear.label,
      schoolYear.startDate,
      schoolYear.endDate,
      schoolYear.requiredInstructionalDays,
      schoolYear.requiredInstructionalHours,
      !!schoolYear.isCurrent
    ]);
    await client.query("COMMIT");
    return mapSchoolYearRow(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateSchoolYear(id, schoolYear) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existingResult = await client.query(`
      SELECT start_date AS "startDate", end_date AS "endDate", is_current AS "isCurrent"
      FROM school_years
      WHERE id = $1
      LIMIT 1
    `, [id]);
    const existing = existingResult.rows[0];
    if (!existing) {
      await client.query("ROLLBACK");
      return null;
    }
    if (schoolYear.isCurrent) {
      await client.query("UPDATE school_years SET is_current = FALSE WHERE id <> $1 AND is_current = TRUE", [id]);
    }
    const result = await client.query(`
      UPDATE school_years
      SET
        label = $2,
        start_date = $3,
        end_date = $4,
        required_instructional_days = $5,
        required_instructional_hours = $6,
        is_current = $7
      WHERE id = $1
      RETURNING
        id,
        label,
        start_date AS "startDate",
        end_date AS "endDate",
        required_instructional_days AS "requiredInstructionalDays",
        required_instructional_hours AS "requiredInstructionalHours",
        is_current AS "isCurrent"
    `, [
      id,
      schoolYear.label,
      schoolYear.startDate,
      schoolYear.endDate,
      schoolYear.requiredInstructionalDays,
      schoolYear.requiredInstructionalHours,
      !!schoolYear.isCurrent
    ]);
    await client.query(`
      UPDATE plans
      SET start_date = $3, end_date = $4
      WHERE plan_type = 'annual'
        AND start_date = $1
        AND end_date = $2
    `, [existing.startDate, existing.endDate, schoolYear.startDate, schoolYear.endDate]);
    await client.query("COMMIT");
    return mapSchoolYearRow(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function deleteSchoolYear(id) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existingResult = await client.query(`
      SELECT is_current AS "isCurrent"
      FROM school_years
      WHERE id = $1
      LIMIT 1
    `, [id]);
    const existing = existingResult.rows[0];
    if (!existing) {
      await client.query("ROLLBACK");
      return false;
    }
    const result = await client.query("DELETE FROM school_years WHERE id = $1", [id]);
    if (existing.isCurrent) {
      await client.query(`
        WITH next_year AS (
          SELECT id
          FROM school_years
          ORDER BY start_date DESC, id DESC
          LIMIT 1
        )
        UPDATE school_years
        SET is_current = TRUE
        WHERE id IN (SELECT id FROM next_year)
      `);
    }
    await client.query("COMMIT");
    return result.rowCount > 0;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function setCurrentSchoolYear(id) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE school_years SET is_current = FALSE WHERE is_current = TRUE");
    const result = await client.query(`
      UPDATE school_years
      SET is_current = TRUE
      WHERE id = $1
      RETURNING
        id,
        label,
        start_date AS "startDate",
        end_date AS "endDate",
        required_instructional_days AS "requiredInstructionalDays",
        required_instructional_hours AS "requiredInstructionalHours",
        is_current AS "isCurrent"
    `, [id]);
    await client.query("COMMIT");
    return result.rows[0] ? mapSchoolYearRow(result.rows[0]) : null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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

async function replaceQuartersForSchoolYear(schoolYearId, quarters) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const schoolYearResult = await client.query(`
      SELECT is_current AS "isCurrent"
      FROM school_years
      WHERE id = $1
      LIMIT 1
    `, [schoolYearId]);
    if (!schoolYearResult.rows[0]) {
      await client.query("ROLLBACK");
      throw new Error("School year not found.");
    }
    const existingQuartersResult = await client.query(`
      SELECT
        name,
        start_date AS "startDate",
        end_date AS "endDate"
      FROM quarters
      WHERE school_year_id = $1
    `, [schoolYearId]);
    const previousQuarterByName = new Map(existingQuartersResult.rows.map((row) => [row.name, row]));
    await client.query("DELETE FROM quarters WHERE school_year_id = $1", [schoolYearId]);
    const saved = [];
    for (const quarter of quarters) {
      const result = await client.query(`
        INSERT INTO quarters (id, school_year_id, name, start_date, end_date)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
          id,
          school_year_id AS "schoolYearId",
          name,
          start_date AS "startDate",
          end_date AS "endDate"
      `, [quarter.id, schoolYearId, quarter.name, quarter.startDate, quarter.endDate]);
      saved.push(result.rows[0]);
    }
    if (schoolYearResult.rows[0].isCurrent) {
      const nextQuarterByName = new Map(saved.map((row) => [row.name, row]));
      for (const [name, previousQuarter] of previousQuarterByName.entries()) {
        const nextQuarter = nextQuarterByName.get(name);
        if (!nextQuarter) continue;
        await client.query(`
          UPDATE plans
          SET start_date = $3, end_date = $4
          WHERE plan_type = 'quarterly'
            AND quarter_name = $1
            AND start_date = $5
            AND end_date = $6
        `, [name, schoolYearId, nextQuarter.startDate, nextQuarter.endDate, previousQuarter.startDate, previousQuarter.endDate]);
      }
    }
    await client.query("COMMIT");
    return saved;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listDailyBreaksForUser(user) {
  const pool = getPostgresPool();
  if (user?.role === "student") {
    const result = await pool.query(`
      SELECT
        id,
        school_year_id AS "schoolYearId",
        student_ids_json AS "studentIdsJson",
        break_type AS "type",
        description,
        start_time AS "startTime",
        duration_minutes AS "durationMinutes",
        weekdays_json AS "weekdaysJson"
      FROM daily_breaks
      WHERE student_ids_json @> to_jsonb(ARRAY[$1]::text[])
      ORDER BY start_time, id
    `, [user.studentId || ""]);
    return result.rows.map(mapDailyBreakRow);
  }

  const result = await pool.query(`
    SELECT
      id,
      school_year_id AS "schoolYearId",
      student_ids_json AS "studentIdsJson",
      break_type AS "type",
      description,
      start_time AS "startTime",
      duration_minutes AS "durationMinutes",
      weekdays_json AS "weekdaysJson"
    FROM daily_breaks
    ORDER BY start_time, id
  `);
  return result.rows.map(mapDailyBreakRow);
}

async function createDailyBreak(dailyBreak) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    INSERT INTO daily_breaks (
      id,
      school_year_id,
      student_ids_json,
      break_type,
      description,
      start_time,
      duration_minutes,
      weekdays_json
    )
    VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8::jsonb)
    RETURNING
      id,
      school_year_id AS "schoolYearId",
      student_ids_json AS "studentIdsJson",
      break_type AS "type",
      description,
      start_time AS "startTime",
      duration_minutes AS "durationMinutes",
      weekdays_json AS "weekdaysJson"
  `, [
    dailyBreak.id,
    dailyBreak.schoolYearId,
    JSON.stringify(dailyBreak.studentIds || []),
    dailyBreak.type,
    dailyBreak.description || "",
    dailyBreak.startTime,
    dailyBreak.durationMinutes,
    JSON.stringify(dailyBreak.weekdays || [])
  ]);
  return mapDailyBreakRow(result.rows[0]);
}

async function updateDailyBreak(id, dailyBreak) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    UPDATE daily_breaks
    SET
      school_year_id = $2,
      student_ids_json = $3::jsonb,
      break_type = $4,
      description = $5,
      start_time = $6,
      duration_minutes = $7,
      weekdays_json = $8::jsonb
    WHERE id = $1
    RETURNING
      id,
      school_year_id AS "schoolYearId",
      student_ids_json AS "studentIdsJson",
      break_type AS "type",
      description,
      start_time AS "startTime",
      duration_minutes AS "durationMinutes",
      weekdays_json AS "weekdaysJson"
  `, [
    id,
    dailyBreak.schoolYearId,
    JSON.stringify(dailyBreak.studentIds || []),
    dailyBreak.type,
    dailyBreak.description || "",
    dailyBreak.startTime,
    dailyBreak.durationMinutes,
    JSON.stringify(dailyBreak.weekdays || [])
  ]);
  return result.rows[0] ? mapDailyBreakRow(result.rows[0]) : null;
}

async function deleteDailyBreak(id) {
  const pool = getPostgresPool();
  const result = await pool.query("DELETE FROM daily_breaks WHERE id = $1", [id]);
  return result.rowCount > 0;
}

async function listHolidays() {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      name,
      holiday_type AS "type",
      start_date AS "startDate",
      end_date AS "endDate"
    FROM holidays
    ORDER BY start_date, end_date, lower(name)
  `);
  return result.rows;
}

async function createHoliday(holiday) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    INSERT INTO holidays (id, name, holiday_type, start_date, end_date)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING
      id,
      name,
      holiday_type AS "type",
      start_date AS "startDate",
      end_date AS "endDate"
  `, [holiday.id, holiday.name, holiday.type, holiday.startDate, holiday.endDate]);
  return result.rows[0];
}

async function updateHoliday(id, holiday) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    UPDATE holidays
    SET
      name = $2,
      holiday_type = $3,
      start_date = $4,
      end_date = $5
    WHERE id = $1
    RETURNING
      id,
      name,
      holiday_type AS "type",
      start_date AS "startDate",
      end_date AS "endDate"
  `, [id, holiday.name, holiday.type, holiday.startDate, holiday.endDate]);
  return result.rows[0] || null;
}

async function deleteHoliday(id) {
  const pool = getPostgresPool();
  const result = await pool.query("DELETE FROM holidays WHERE id = $1", [id]);
  return result.rowCount > 0;
}

async function listPlansForUser(user) {
  const pool = getPostgresPool();
  if (user?.role === "student") {
    const result = await pool.query(`
      SELECT
        id,
        plan_type AS "planType",
        student_id AS "studentId",
        course_id AS "courseId",
        start_date AS "startDate",
        end_date AS "endDate",
        weekdays_json AS "weekdaysJson",
        quarter_name AS "quarterName"
      FROM plans
      WHERE student_id = $1
      ORDER BY start_date, end_date, id
    `, [user.studentId || ""]);
    return result.rows.map(mapPlanRow);
  }

  const result = await pool.query(`
    SELECT
      id,
      plan_type AS "planType",
      student_id AS "studentId",
      course_id AS "courseId",
      start_date AS "startDate",
      end_date AS "endDate",
      weekdays_json AS "weekdaysJson",
      quarter_name AS "quarterName"
    FROM plans
    ORDER BY start_date, end_date, id
  `);
  return result.rows.map(mapPlanRow);
}

async function createPlans(plans) {
  if (!Array.isArray(plans) || !plans.length) return [];
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const created = [];
    for (const plan of plans) {
      const result = await client.query(`
        INSERT INTO plans (id, plan_type, student_id, course_id, start_date, end_date, weekdays_json, quarter_name)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
        RETURNING
          id,
          plan_type AS "planType",
          student_id AS "studentId",
          course_id AS "courseId",
          start_date AS "startDate",
          end_date AS "endDate",
          weekdays_json AS "weekdaysJson",
          quarter_name AS "quarterName"
      `, [
        plan.id,
        plan.planType,
        plan.studentId,
        plan.courseId,
        plan.startDate,
        plan.endDate,
        JSON.stringify(plan.weekdays || []),
        plan.quarterName || null
      ]);
      created.push(mapPlanRow(result.rows[0]));
    }
    await client.query("COMMIT");
    return created;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updatePlan(id, plan) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    UPDATE plans
    SET
      plan_type = $2,
      student_id = $3,
      course_id = $4,
      start_date = $5,
      end_date = $6,
      weekdays_json = $7::jsonb,
      quarter_name = $8
    WHERE id = $1
    RETURNING
      id,
      plan_type AS "planType",
      student_id AS "studentId",
      course_id AS "courseId",
      start_date AS "startDate",
      end_date AS "endDate",
      weekdays_json AS "weekdaysJson",
      quarter_name AS "quarterName"
  `, [
    id,
    plan.planType,
    plan.studentId,
    plan.courseId,
    plan.startDate,
    plan.endDate,
    JSON.stringify(plan.weekdays || []),
    plan.quarterName || null
  ]);
  return result.rows[0] ? mapPlanRow(result.rows[0]) : null;
}

async function deletePlan(id) {
  const pool = getPostgresPool();
  const result = await pool.query("DELETE FROM plans WHERE id = $1", [id]);
  return result.rowCount > 0;
}

async function listGradeTypes() {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      name,
      weight
    FROM grade_types
    ORDER BY lower(name)
  `);
  return result.rows.map((row) => ({
    ...row,
    weight: row.weight == null ? null : Number(row.weight)
  }));
}

async function replaceGradeTypes(gradeTypes) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM grade_types");
    const saved = [];
    for (const gradeType of gradeTypes) {
      const result = await client.query(`
        INSERT INTO grade_types (id, name, weight)
        VALUES ($1, $2, $3)
        RETURNING
          id,
          name,
          weight
      `, [gradeType.id, gradeType.name, gradeType.weight]);
      saved.push({
        ...result.rows[0],
        weight: result.rows[0].weight == null ? null : Number(result.rows[0].weight)
      });
    }
    await client.query("COMMIT");
    return saved.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getGradingCriteria() {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      letter_scale_json AS "letterScale",
      gpa_scale_option AS "gpaScaleOption",
      gpa_max AS "gpaMax"
    FROM grading_criteria
    ORDER BY id
    LIMIT 1
  `);
  const row = result.rows[0];
  if (!row) {
    return {
      letterScale: [],
      gpaScaleOption: "4",
      gpaMax: 4
    };
  }

  return {
    letterScale: Array.isArray(row.letterScale) ? row.letterScale : [],
    gpaScaleOption: row.gpaScaleOption || "4",
    gpaMax: row.gpaMax == null ? 4 : Number(row.gpaMax)
  };
}

async function saveGradingCriteria(criteria) {
  const pool = getPostgresPool();
  const existing = await pool.query("SELECT id FROM grading_criteria ORDER BY id LIMIT 1");
  const id = existing.rows[0]?.id || "default-grading-criteria";
  const result = await pool.query(`
    INSERT INTO grading_criteria (id, letter_scale_json, gpa_scale_option, gpa_max)
    VALUES ($1, $2::jsonb, $3, $4)
    ON CONFLICT (id) DO UPDATE SET
      letter_scale_json = EXCLUDED.letter_scale_json,
      gpa_scale_option = EXCLUDED.gpa_scale_option,
      gpa_max = EXCLUDED.gpa_max
    RETURNING
      letter_scale_json AS "letterScale",
      gpa_scale_option AS "gpaScaleOption",
      gpa_max AS "gpaMax"
  `, [id, JSON.stringify(criteria.letterScale || []), criteria.gpaScaleOption, criteria.gpaMax]);
  return {
    letterScale: Array.isArray(result.rows[0].letterScale) ? result.rows[0].letterScale : [],
    gpaScaleOption: result.rows[0].gpaScaleOption || "4",
    gpaMax: result.rows[0].gpaMax == null ? 4 : Number(result.rows[0].gpaMax)
  };
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

async function createAttendance(attendance) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    INSERT INTO attendance (id, student_id, attendance_date, present)
    VALUES ($1, $2, $3, $4)
    RETURNING
      id,
      student_id AS "studentId",
      attendance_date AS "date",
      present
  `, [attendance.id, attendance.studentId, attendance.date, attendance.present]);
  return {
    ...result.rows[0],
    present: !!result.rows[0].present
  };
}

async function updateAttendance(id, attendance) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    UPDATE attendance
    SET
      student_id = $2,
      attendance_date = $3,
      present = $4
    WHERE id = $1
    RETURNING
      id,
      student_id AS "studentId",
      attendance_date AS "date",
      present
  `, [id, attendance.studentId, attendance.date, attendance.present]);
  return result.rows[0]
    ? {
      ...result.rows[0],
      present: !!result.rows[0].present
    }
    : null;
}

async function deleteAttendance(id) {
  const pool = getPostgresPool();
  const result = await pool.query("DELETE FROM attendance WHERE id = $1", [id]);
  return result.rowCount > 0;
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

async function createTest(test) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    INSERT INTO tests (id, test_date, student_id, subject_id, course_id, grade_type, test_name, score, max_score)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING
      id,
      test_date AS "date",
      student_id AS "studentId",
      subject_id AS "subjectId",
      course_id AS "courseId",
      grade_type AS "gradeType",
      test_name AS "testName",
      score,
      max_score AS "maxScore"
  `, [test.id, test.date, test.studentId, test.subjectId, test.courseId, test.gradeType, test.testName, test.score, test.maxScore]);
  return {
    ...result.rows[0],
    score: Number(result.rows[0].score || 0),
    maxScore: Number(result.rows[0].maxScore || 0)
  };
}

async function updateTest(id, test) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    UPDATE tests
    SET
      test_date = $2,
      student_id = $3,
      subject_id = $4,
      course_id = $5,
      grade_type = $6,
      test_name = $7,
      score = $8,
      max_score = $9
    WHERE id = $1
    RETURNING
      id,
      test_date AS "date",
      student_id AS "studentId",
      subject_id AS "subjectId",
      course_id AS "courseId",
      grade_type AS "gradeType",
      test_name AS "testName",
      score,
      max_score AS "maxScore"
  `, [id, test.date, test.studentId, test.subjectId, test.courseId, test.gradeType, test.testName, test.score, test.maxScore]);
  return result.rows[0]
    ? {
      ...result.rows[0],
      score: Number(result.rows[0].score || 0),
      maxScore: Number(result.rows[0].maxScore || 0)
    }
    : null;
}

async function deleteTest(id) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    DELETE FROM tests
    WHERE id = $1
    RETURNING id
  `, [id]);
  return result.rowCount > 0;
}

function mapDailyBreakRow(row) {
  return {
    id: row.id,
    schoolYearId: row.schoolYearId,
    studentIds: Array.isArray(row.studentIdsJson) ? row.studentIdsJson : [],
    type: row.type,
    description: row.description || "",
    startTime: row.startTime || "12:00",
    durationMinutes: row.durationMinutes == null ? 60 : Number(row.durationMinutes),
    weekdays: Array.isArray(row.weekdaysJson) ? row.weekdaysJson.map((day) => Number(day)).filter(Number.isInteger) : []
  };
}

function mapSchoolYearRow(row) {
  return {
    ...row,
    requiredInstructionalDays: row.requiredInstructionalDays == null ? null : Number(row.requiredInstructionalDays),
    requiredInstructionalHours: row.requiredInstructionalHours == null ? null : Number(row.requiredInstructionalHours),
    isCurrent: !!row.isCurrent
  };
}

function mapPlanRow(row) {
  return {
    id: row.id,
    planType: row.planType,
    studentId: row.studentId,
    courseId: row.courseId,
    startDate: row.startDate,
    endDate: row.endDate,
    weekdays: Array.isArray(row.weekdaysJson) ? row.weekdaysJson.map((day) => Number(day)).filter(Number.isInteger) : [],
    ...(row.quarterName ? { quarterName: row.quarterName } : {})
  };
}

module.exports = {
  createAttendance,
  createCourse,
  createSchoolYear,
  createEnrollment,
  createSubject,
  createHoliday,
  createDailyBreak,
  createPlans,
  createTest,
  deleteAttendance,
  deleteTest,
  deleteSchoolYear,
  deleteCourse,
  deleteEnrollment,
  deleteDailyBreak,
  deleteHoliday,
  deletePlan,
  deleteSubject,
  getGradingCriteria,
  listAttendanceForUser,
  listCoursesForUser,
  listDailyBreaksForUser,
  listEnrollmentsForUser,
  listGradeTypes,
  listHolidays,
  listPlansForUser,
  listQuarters,
  listSchoolYears,
  listSubjectsForUser,
  listTestsForUser,
  replaceQuartersForSchoolYear,
  replaceGradeTypes,
  saveGradingCriteria,
  setCurrentSchoolYear,
  updateAttendance,
  updateCourse,
  updateDailyBreak,
  updateEnrollment,
  updateHoliday,
  updatePlan,
  updateSchoolYear,
  updateSubject,
  updateTest
};
