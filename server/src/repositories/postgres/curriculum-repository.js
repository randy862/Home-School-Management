function createCurriculumRepository(deps) {
  const { getPostgresPool } = deps;

  return {
    createCourse: async (course) => {
      const pool = getPostgresPool();
      const result = await pool.query(`
        INSERT INTO courses (id, name, subject_id, hours_per_day, exclusive_resource)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
          id,
          name,
          subject_id AS "subjectId",
          hours_per_day AS "hoursPerDay",
          exclusive_resource AS "exclusiveResource"
      `, [course.id, course.name, course.subjectId, course.hoursPerDay, course.exclusiveResource]);
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
        return result.rows.map(mapCourseRow);
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

    listSubjectsForUser: async (user) => {
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
    },

    updateCourse: async (id, course) => {
      const pool = getPostgresPool();
      const result = await pool.query(`
        UPDATE courses
        SET
          name = $2,
          subject_id = $3,
          hours_per_day = $4,
          exclusive_resource = $5
        WHERE id = $1
        RETURNING
          id,
          name,
          subject_id AS "subjectId",
          hours_per_day AS "hoursPerDay",
          exclusive_resource AS "exclusiveResource"
      `, [id, course.name, course.subjectId, course.hoursPerDay, course.exclusiveResource]);
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

function mapCourseRow(row) {
  return {
    ...row,
    hoursPerDay: Number(row.hoursPerDay || 0),
    exclusiveResource: !!row.exclusiveResource
  };
}

function mapEnrollmentRow(row) {
  return {
    ...row,
    scheduleOrder: row.scheduleOrder == null ? null : Number(row.scheduleOrder)
  };
}

module.exports = {
  createCurriculumRepository
};
