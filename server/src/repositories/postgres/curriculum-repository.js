function createCurriculumRepository(deps) {
  const { getPostgresPool } = deps;

  return {
    createCourse: async (course) => {
      const pool = getPostgresPool();
      const materials = normalizeCourseMaterials(course.materials || course.material);
      const features = await getCourseTableFeatures(pool);
      const insertColumns = ["id", "name", "subject_id"];
      const insertValues = [course.id, course.name, course.subjectId];
      const returningColumns = buildCourseSelectColumns(features);

      if (features.hasInstructorId) {
        insertColumns.push("instructor_id");
        insertValues.push(course.instructorId || null);
      }
      insertColumns.push("hours_per_day");
      insertValues.push(course.hoursPerDay);
      if (features.hasExclusiveResource) {
        insertColumns.push("exclusive_resource");
        insertValues.push(course.exclusiveResource);
      }
      if (features.hasResourceGroup) {
        insertColumns.push("resource_group");
        insertValues.push(course.resourceGroup || "");
      }
      if (features.hasResourceCapacity) {
        insertColumns.push("resource_capacity");
        insertValues.push(course.resourceCapacity == null ? null : Number(course.resourceCapacity));
      }
      if (features.hasCourseMaterials) {
        insertColumns.push("course_materials");
        insertValues.push(JSON.stringify(materials));
      }

      const placeholders = insertColumns.map((column, index) =>
        column === "course_materials" ? `$${index + 1}::jsonb` : `$${index + 1}`);
      const result = await pool.query(`
        INSERT INTO courses (
          ${insertColumns.join(",\n          ")}
        )
        VALUES (${placeholders.join(", ")})
        RETURNING
          ${returningColumns}
      `, insertValues);
      return mapCourseRow(result.rows[0]);
    },

    createEnrollment: async (enrollment) => {
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
      return mapEnrollmentRow(result.rows[0]);
    },

    createCourseSection: async (section) => {
      const pool = getPostgresPool();
      await ensureCourseSectionTables(pool);
      const result = await pool.query(`
        INSERT INTO course_sections (
          id,
          course_id,
          label,
          resource_group,
          concurrent_capacity,
          start_time,
          weekdays_json,
          schedule_order
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
        RETURNING
          id,
          course_id AS "courseId",
          label,
          resource_group AS "resourceGroup",
          concurrent_capacity AS "concurrentCapacity",
          start_time AS "startTime",
          weekdays_json AS "weekdaysJson",
          schedule_order AS "scheduleOrder"
      `, [
        section.id,
        section.courseId,
        section.label,
        section.resourceGroup || "",
        section.concurrentCapacity == null ? null : Number(section.concurrentCapacity),
        section.startTime,
        JSON.stringify(section.weekdays || []),
        section.scheduleOrder
      ]);
      return mapCourseSectionRow(result.rows[0]);
    },

    createSectionEnrollment: async (sectionEnrollment) => {
      const pool = getPostgresPool();
      await ensureCourseSectionTables(pool);
      const result = await pool.query(`
        INSERT INTO section_enrollments (id, student_id, course_section_id, schedule_order)
        VALUES ($1, $2, $3, $4)
        RETURNING
          id,
          student_id AS "studentId",
          course_section_id AS "courseSectionId",
          schedule_order AS "scheduleOrder"
      `, [sectionEnrollment.id, sectionEnrollment.studentId, sectionEnrollment.courseSectionId, sectionEnrollment.scheduleOrder]);
      return mapSectionEnrollmentRow(result.rows[0]);
    },

    createStudentScheduleBlock: async (scheduledBlock) => {
      const pool = getPostgresPool();
      const result = await pool.query(`
        INSERT INTO student_schedule_blocks (id, student_id, schedule_block_id, schedule_order)
        VALUES ($1, $2, $3, $4)
        RETURNING
          id,
          student_id AS "studentId",
          schedule_block_id AS "scheduleBlockId",
          schedule_order AS "scheduleOrder"
      `, [scheduledBlock.id, scheduledBlock.studentId, scheduledBlock.scheduleBlockId, scheduledBlock.scheduleOrder]);
      return mapStudentScheduleBlockRow(result.rows[0]);
    },

    createSubject: async (subject) => {
      const pool = getPostgresPool();
      const result = await pool.query(`
        INSERT INTO subjects (id, name)
        VALUES ($1, $2)
        RETURNING
          id,
          name
      `, [subject.id, subject.name]);
      return result.rows[0];
    },

    deleteCourse: async (id) => {
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
    },

    deleteEnrollment: async (id) => {
      const pool = getPostgresPool();
      const result = await pool.query("DELETE FROM enrollments WHERE id = $1", [id]);
      return result.rowCount > 0;
    },

    deleteCourseSection: async (id) => {
      const pool = getPostgresPool();
      await ensureCourseSectionTables(pool);
      const result = await pool.query("DELETE FROM course_sections WHERE id = $1", [id]);
      return result.rowCount > 0;
    },

    deleteSectionEnrollment: async (id) => {
      const pool = getPostgresPool();
      await ensureCourseSectionTables(pool);
      const result = await pool.query("DELETE FROM section_enrollments WHERE id = $1", [id]);
      return result.rowCount > 0;
    },

    deleteStudentScheduleBlock: async (id) => {
      const pool = getPostgresPool();
      const result = await pool.query("DELETE FROM student_schedule_blocks WHERE id = $1", [id]);
      return result.rowCount > 0;
    },

    deleteSubject: async (id) => {
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
    },

    listCoursesForUser: async (user) => {
      const pool = getPostgresPool();
      const features = await getCourseTableFeatures(pool);
      const selectColumns = buildCourseSelectColumns(features, user?.role === "student" ? "c" : "");
      if (user?.role === "student") {
        await ensureCourseSectionTables(pool);
        const result = await pool.query(`
          SELECT DISTINCT
            ${selectColumns}
          FROM courses c
          LEFT JOIN enrollments e ON e.course_id = c.id AND e.student_id = $1
          LEFT JOIN course_sections cs ON cs.course_id = c.id
          LEFT JOIN section_enrollments se ON se.course_section_id = cs.id AND se.student_id = $1
          WHERE e.student_id IS NOT NULL OR se.student_id IS NOT NULL
          ORDER BY lower(c.name)
        `, [user.studentId || ""]);
        return result.rows.map(mapCourseRow);
      }

      const result = await pool.query(`
        SELECT
          ${selectColumns}
        FROM courses
        ORDER BY lower(name)
      `);
      return result.rows.map(mapCourseRow);
    },

    listEnrollmentsForUser: async (user) => {
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
        return result.rows.map(mapEnrollmentRow);
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
      return result.rows.map(mapEnrollmentRow);
    },

    listCourseSectionsForUser: async (user) => {
      const pool = getPostgresPool();
      await ensureCourseSectionTables(pool);
      const result = user?.role === "student"
        ? await pool.query(`
          SELECT DISTINCT
            cs.id,
            cs.course_id AS "courseId",
            cs.label,
            cs.resource_group AS "resourceGroup",
            cs.concurrent_capacity AS "concurrentCapacity",
            cs.start_time AS "startTime",
            cs.weekdays_json AS "weekdaysJson",
            cs.schedule_order AS "scheduleOrder"
          FROM course_sections cs
          JOIN section_enrollments se ON se.course_section_id = cs.id
          WHERE se.student_id = $1
          ORDER BY lower(cs.label), cs.id
        `, [user.studentId || ""])
        : await pool.query(`
          SELECT
            id,
            course_id AS "courseId",
            label,
            resource_group AS "resourceGroup",
            concurrent_capacity AS "concurrentCapacity",
            start_time AS "startTime",
            weekdays_json AS "weekdaysJson",
            schedule_order AS "scheduleOrder"
          FROM course_sections
          ORDER BY lower(label), id
        `);
      return result.rows.map(mapCourseSectionRow);
    },

    listSectionEnrollmentsForUser: async (user) => {
      const pool = getPostgresPool();
      await ensureCourseSectionTables(pool);
      const result = user?.role === "student"
        ? await pool.query(`
          SELECT
            id,
            student_id AS "studentId",
            course_section_id AS "courseSectionId",
            schedule_order AS "scheduleOrder"
          FROM section_enrollments
          WHERE student_id = $1
          ORDER BY id
        `, [user.studentId || ""])
        : await pool.query(`
          SELECT
            id,
            student_id AS "studentId",
            course_section_id AS "courseSectionId",
            schedule_order AS "scheduleOrder"
          FROM section_enrollments
          ORDER BY id
        `);
      return result.rows.map(mapSectionEnrollmentRow);
    },

    listStudentScheduleBlocksForUser: async (user) => {
      const pool = getPostgresPool();
      const result = user?.role === "student"
        ? await pool.query(`
          SELECT
            id,
            student_id AS "studentId",
            schedule_block_id AS "scheduleBlockId",
            schedule_order AS "scheduleOrder"
          FROM student_schedule_blocks
          WHERE student_id = $1
          ORDER BY id
        `, [user.studentId || ""])
        : await pool.query(`
          SELECT
            id,
            student_id AS "studentId",
            schedule_block_id AS "scheduleBlockId",
            schedule_order AS "scheduleOrder"
          FROM student_schedule_blocks
          ORDER BY id
        `);
      return result.rows.map(mapStudentScheduleBlockRow);
    },

    listSubjectsForUser: async (user) => {
      const pool = getPostgresPool();
      if (user?.role === "student") {
        await ensureCourseSectionTables(pool);
        const result = await pool.query(`
          SELECT DISTINCT
            s.id,
            s.name
          FROM subjects s
          JOIN courses c ON c.subject_id = s.id
          LEFT JOIN enrollments e ON e.course_id = c.id AND e.student_id = $1
          LEFT JOIN course_sections cs ON cs.course_id = c.id
          LEFT JOIN section_enrollments se ON se.course_section_id = cs.id AND se.student_id = $1
          WHERE e.student_id IS NOT NULL OR se.student_id IS NOT NULL
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
    },

    updateCourse: async (id, course) => {
      const pool = getPostgresPool();
      const materials = normalizeCourseMaterials(course.materials || course.material);
      const features = await getCourseTableFeatures(pool);
      const setClauses = [
        "name = $2",
        "subject_id = $3"
      ];
      const values = [id, course.name, course.subjectId];
      let parameterIndex = 4;

      if (features.hasInstructorId) {
        setClauses.push(`instructor_id = $${parameterIndex}`);
        values.push(course.instructorId || null);
        parameterIndex += 1;
      }
      setClauses.push(`hours_per_day = $${parameterIndex}`);
      values.push(course.hoursPerDay);
      parameterIndex += 1;
      if (features.hasExclusiveResource) {
        setClauses.push(`exclusive_resource = $${parameterIndex}`);
        values.push(course.exclusiveResource);
        parameterIndex += 1;
      }
      if (features.hasResourceGroup) {
        setClauses.push(`resource_group = $${parameterIndex}`);
        values.push(course.resourceGroup || "");
        parameterIndex += 1;
      }
      if (features.hasResourceCapacity) {
        setClauses.push(`resource_capacity = $${parameterIndex}`);
        values.push(course.resourceCapacity == null ? null : Number(course.resourceCapacity));
        parameterIndex += 1;
      }
      if (features.hasCourseMaterials) {
        setClauses.push(`course_materials = $${parameterIndex}::jsonb`);
        values.push(JSON.stringify(materials));
      }

      const result = await pool.query(`
        UPDATE courses
        SET
          ${setClauses.join(",\n          ")}
        WHERE id = $1
        RETURNING
          ${buildCourseSelectColumns(features)}
      `, values);
      return result.rows[0] ? mapCourseRow(result.rows[0]) : null;
    },

    updateEnrollment: async (id, enrollment) => {
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
      return result.rows[0] ? mapEnrollmentRow(result.rows[0]) : null;
    },

    updateCourseSection: async (id, section) => {
      const pool = getPostgresPool();
      await ensureCourseSectionTables(pool);
      const result = await pool.query(`
        UPDATE course_sections
        SET
          course_id = $2,
          label = $3,
          resource_group = $4,
          concurrent_capacity = $5,
          start_time = $6,
          weekdays_json = $7::jsonb,
          schedule_order = $8
        WHERE id = $1
        RETURNING
          id,
          course_id AS "courseId",
          label,
          resource_group AS "resourceGroup",
          concurrent_capacity AS "concurrentCapacity",
          start_time AS "startTime",
          weekdays_json AS "weekdaysJson",
          schedule_order AS "scheduleOrder"
      `, [
        id,
        section.courseId,
        section.label,
        section.resourceGroup || "",
        section.concurrentCapacity == null ? null : Number(section.concurrentCapacity),
        section.startTime,
        JSON.stringify(section.weekdays || []),
        section.scheduleOrder
      ]);
      return result.rows[0] ? mapCourseSectionRow(result.rows[0]) : null;
    },

    updateSectionEnrollment: async (id, sectionEnrollment) => {
      const pool = getPostgresPool();
      await ensureCourseSectionTables(pool);
      const result = await pool.query(`
        UPDATE section_enrollments
        SET
          student_id = $2,
          course_section_id = $3,
          schedule_order = $4
        WHERE id = $1
        RETURNING
          id,
          student_id AS "studentId",
          course_section_id AS "courseSectionId",
          schedule_order AS "scheduleOrder"
      `, [id, sectionEnrollment.studentId, sectionEnrollment.courseSectionId, sectionEnrollment.scheduleOrder]);
      return result.rows[0] ? mapSectionEnrollmentRow(result.rows[0]) : null;
    },

    updateStudentScheduleBlock: async (id, scheduledBlock) => {
      const pool = getPostgresPool();
      const result = await pool.query(`
        UPDATE student_schedule_blocks
        SET
          student_id = $2,
          schedule_block_id = $3,
          schedule_order = $4
        WHERE id = $1
        RETURNING
          id,
          student_id AS "studentId",
          schedule_block_id AS "scheduleBlockId",
          schedule_order AS "scheduleOrder"
      `, [id, scheduledBlock.studentId, scheduledBlock.scheduleBlockId, scheduledBlock.scheduleOrder]);
      return result.rows[0] ? mapStudentScheduleBlockRow(result.rows[0]) : null;
    },

    updateSubject: async (id, subject) => {
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
  };
}

async function getCourseTableFeatures(pool) {
  await ensureCourseTableColumns(pool);
  const result = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'courses'
  `);
  const columns = new Set(result.rows.map((row) => row.column_name));
  return {
    hasInstructorId: columns.has("instructor_id"),
    hasExclusiveResource: columns.has("exclusive_resource"),
    hasResourceGroup: columns.has("resource_group"),
    hasResourceCapacity: columns.has("resource_capacity"),
    hasCourseMaterials: columns.has("course_materials")
  };
}

async function ensureCourseTableColumns(pool) {
  await pool.query(`
    ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS resource_group TEXT NOT NULL DEFAULT ''
  `);
  await pool.query(`
    ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS resource_capacity INTEGER
  `);
  await pool.query(`
    UPDATE courses
    SET resource_capacity = 1
    WHERE exclusive_resource = TRUE
      AND resource_capacity IS NULL
  `);
}

async function ensureCourseSectionTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS course_sections (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      resource_group TEXT NOT NULL DEFAULT '',
      concurrent_capacity INTEGER,
      start_time TEXT NOT NULL DEFAULT '08:00',
      weekdays_json JSONB NOT NULL DEFAULT '[1,2,3,4,5]'::jsonb,
      schedule_order INTEGER
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS section_enrollments (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      course_section_id TEXT NOT NULL REFERENCES course_sections(id) ON DELETE CASCADE,
      schedule_order INTEGER,
      UNIQUE (student_id, course_section_id)
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_course_sections_course_id
    ON course_sections(course_id)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_section_enrollments_student_id
    ON section_enrollments(student_id)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_section_enrollments_section_id
    ON section_enrollments(course_section_id)
  `);
}

function buildCourseSelectColumns(features, tableAlias = "") {
  const prefix = tableAlias ? `${tableAlias}.` : "";
  return [
    `${prefix}id`,
    `${prefix}name`,
    `${prefix}subject_id AS "subjectId"`,
    features.hasInstructorId
      ? `${prefix}instructor_id AS "instructorId"`
      : `'' AS "instructorId"`,
    `${prefix}hours_per_day AS "hoursPerDay"`,
    features.hasExclusiveResource
      ? `${prefix}exclusive_resource AS "exclusiveResource"`
      : `FALSE AS "exclusiveResource"`,
    features.hasResourceGroup
      ? `${prefix}resource_group AS "resourceGroup"`
      : `'' AS "resourceGroup"`,
    features.hasResourceCapacity
      ? `${prefix}resource_capacity AS "resourceCapacity"`
      : `NULL::integer AS "resourceCapacity"`,
    features.hasCourseMaterials
      ? `${prefix}course_materials AS "courseMaterials"`
      : `'[]'::jsonb AS "courseMaterials"`
  ].join(",\n          ");
}

function mapCourseRow(row) {
  return {
    id: row.id,
    name: row.name,
    subjectId: row.subjectId,
    instructorId: row.instructorId || "",
    hoursPerDay: Number(row.hoursPerDay || 0),
    exclusiveResource: !!row.exclusiveResource,
    resourceGroup: row.resourceGroup || "",
    resourceCapacity: row.resourceCapacity == null ? null : Number(row.resourceCapacity),
    materials: normalizeCourseMaterials(row.courseMaterials)
  };
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

function mapEnrollmentRow(row) {
  return {
    ...row,
    scheduleOrder: row.scheduleOrder == null ? null : Number(row.scheduleOrder)
  };
}

function mapCourseSectionRow(row) {
  return {
    id: row.id,
    courseId: row.courseId,
    label: row.label || "",
    resourceGroup: row.resourceGroup || "",
    concurrentCapacity: row.concurrentCapacity == null ? null : Number(row.concurrentCapacity),
    startTime: row.startTime || "08:00",
    weekdays: Array.isArray(row.weekdaysJson) ? row.weekdaysJson.map((day) => Number(day)).filter(Number.isInteger) : [],
    scheduleOrder: row.scheduleOrder == null ? null : Number(row.scheduleOrder)
  };
}

function mapSectionEnrollmentRow(row) {
  return {
    id: row.id,
    studentId: row.studentId,
    courseSectionId: row.courseSectionId,
    scheduleOrder: row.scheduleOrder == null ? null : Number(row.scheduleOrder)
  };
}

function mapStudentScheduleBlockRow(row) {
  return {
    ...row,
    scheduleOrder: row.scheduleOrder == null ? null : Number(row.scheduleOrder)
  };
}

module.exports = {
  createCurriculumRepository
};
