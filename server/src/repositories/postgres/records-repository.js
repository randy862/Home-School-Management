function createRecordsRepository(deps) {
  const { getPostgresPool } = deps;

  return {
    createActualInstructionMinutes: async (record) => {
      const pool = getPostgresPool();
      await ensureFlexBlocksTable(pool);
      const result = await pool.query(`
        INSERT INTO actual_instruction_minutes (id, student_id, course_id, instructor_id, instruction_date, actual_minutes, start_minutes, order_index, completed)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING
          id,
          student_id AS "studentId",
          course_id AS "courseId",
          instructor_id AS "instructorId",
          instruction_date AS "date",
          actual_minutes AS "actualMinutes",
          start_minutes AS "startMinutes",
          order_index AS "orderIndex",
          completed
      `, [record.id, record.studentId, record.courseId, record.instructorId || null, record.date, record.actualMinutes, record.startMinutes ?? null, record.orderIndex ?? null, !!record.completed]);
      return mapActualInstructionRow(result.rows[0]);
    },

    createAttendance: async (attendance) => {
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
      return mapAttendanceRow(result.rows[0]);
    },

    createTest: async (test) => {
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
      return mapTestRow(result.rows[0]);
    },

    createFlexBlock: async (record) => {
      const pool = getPostgresPool();
      await ensureFlexBlocksTable(pool);
      const result = await pool.query(`
        INSERT INTO flex_blocks (id, student_id, block_date, start_minutes, end_minutes, purpose)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (student_id, block_date, start_minutes, end_minutes)
        DO UPDATE SET purpose = EXCLUDED.purpose
        RETURNING
          id,
          student_id AS "studentId",
          block_date AS "date",
          start_minutes AS "startMinutes",
          end_minutes AS "endMinutes",
          purpose
      `, [record.id, record.studentId, record.date, record.startMinutes, record.endMinutes, record.purpose || ""]);
      return mapFlexBlockRow(result.rows[0]);
    },

    deleteAttendance: async (id) => {
      const pool = getPostgresPool();
      const result = await pool.query("DELETE FROM attendance WHERE id = $1", [id]);
      return result.rowCount > 0;
    },

    deleteActualInstructionMinutes: async (id) => {
      const pool = getPostgresPool();
      const result = await pool.query("DELETE FROM actual_instruction_minutes WHERE id = $1", [id]);
      return result.rowCount > 0;
    },

    deleteTest: async (id) => {
      const pool = getPostgresPool();
      const result = await pool.query(`
        DELETE FROM tests
        WHERE id = $1
        RETURNING id
      `, [id]);
      return result.rowCount > 0;
    },

    listAttendanceForUser: async (user) => {
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
        return result.rows.map(mapAttendanceRow);
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
      return result.rows.map(mapAttendanceRow);
    },

    listActualInstructionMinutesForUser: async (user) => {
      const pool = getPostgresPool();
      await ensureFlexBlocksTable(pool);
      if (user?.role === "student") {
        const result = await pool.query(`
          SELECT
            id,
            student_id AS "studentId",
            course_id AS "courseId",
            instructor_id AS "instructorId",
            instruction_date AS "date",
            actual_minutes AS "actualMinutes",
            start_minutes AS "startMinutes",
            order_index AS "orderIndex",
            completed
          FROM actual_instruction_minutes
          WHERE student_id = $1
          ORDER BY instruction_date, course_id
        `, [user.studentId || ""]);
        return result.rows.map(mapActualInstructionRow);
      }

      const result = await pool.query(`
        SELECT
          id,
          student_id AS "studentId",
          course_id AS "courseId",
          instructor_id AS "instructorId",
          instruction_date AS "date",
          actual_minutes AS "actualMinutes",
          start_minutes AS "startMinutes",
          order_index AS "orderIndex",
          completed
        FROM actual_instruction_minutes
        ORDER BY instruction_date, student_id, course_id
      `);
      return result.rows.map(mapActualInstructionRow);
    },

    listTestsForUser: async (user) => {
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
        return result.rows.map(mapTestRow);
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
      return result.rows.map(mapTestRow);
    },

    listFlexBlocksForUser: async (user) => {
      const pool = getPostgresPool();
      await ensureFlexBlocksTable(pool);
      if (user?.role === "student") {
        const result = await pool.query(`
          SELECT
            id,
            student_id AS "studentId",
            block_date AS "date",
            start_minutes AS "startMinutes",
            end_minutes AS "endMinutes",
            purpose
          FROM flex_blocks
          WHERE student_id = $1
          ORDER BY block_date, start_minutes
        `, [user.studentId || ""]);
        return result.rows.map(mapFlexBlockRow);
      }
      const result = await pool.query(`
        SELECT
          id,
          student_id AS "studentId",
          block_date AS "date",
          start_minutes AS "startMinutes",
          end_minutes AS "endMinutes",
          purpose
        FROM flex_blocks
        ORDER BY block_date, student_id, start_minutes
      `);
      return result.rows.map(mapFlexBlockRow);
    },

    updateAttendance: async (id, attendance) => {
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
      return result.rows[0] ? mapAttendanceRow(result.rows[0]) : null;
    },

    updateActualInstructionMinutes: async (id, record) => {
      const pool = getPostgresPool();
      await ensureFlexBlocksTable(pool);
      const result = await pool.query(`
        UPDATE actual_instruction_minutes
        SET
          student_id = $2,
          course_id = $3,
          instructor_id = $4,
          instruction_date = $5,
          actual_minutes = $6,
          start_minutes = $7,
          order_index = $8,
          completed = $9
        WHERE id = $1
        RETURNING
          id,
          student_id AS "studentId",
          course_id AS "courseId",
          instructor_id AS "instructorId",
          instruction_date AS "date",
          actual_minutes AS "actualMinutes",
          start_minutes AS "startMinutes",
          order_index AS "orderIndex",
          completed
      `, [id, record.studentId, record.courseId, record.instructorId || null, record.date, record.actualMinutes, record.startMinutes ?? null, record.orderIndex ?? null, !!record.completed]);
      return result.rows[0] ? mapActualInstructionRow(result.rows[0]) : null;
    },

    updateTest: async (id, test) => {
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
      return result.rows[0] ? mapTestRow(result.rows[0]) : null;
    },

    updateFlexBlock: async (id, record) => {
      const pool = getPostgresPool();
      await ensureFlexBlocksTable(pool);
      const result = await pool.query(`
        UPDATE flex_blocks
        SET
          student_id = $2,
          block_date = $3,
          start_minutes = $4,
          end_minutes = $5,
          purpose = $6
        WHERE id = $1
        RETURNING
          id,
          student_id AS "studentId",
          block_date AS "date",
          start_minutes AS "startMinutes",
          end_minutes AS "endMinutes",
          purpose
      `, [id, record.studentId, record.date, record.startMinutes, record.endMinutes, record.purpose || ""]);
      return result.rows[0] ? mapFlexBlockRow(result.rows[0]) : null;
    },

    deleteFlexBlock: async (id) => {
      const pool = getPostgresPool();
      await ensureFlexBlocksTable(pool);
      const result = await pool.query("DELETE FROM flex_blocks WHERE id = $1", [id]);
      return result.rowCount > 0;
    }
  };
}

function mapAttendanceRow(row) {
  return {
    ...row,
    present: !!row.present
  };
}

function mapActualInstructionRow(row) {
  return {
    ...row,
    instructorId: row.instructorId || "",
    completed: !!row.completed,
    actualMinutes: Number(row.actualMinutes || 0),
    startMinutes: row.startMinutes == null || row.startMinutes === ""
      ? null
      : Number(row.startMinutes),
    orderIndex: row.orderIndex == null || row.orderIndex === ""
      ? null
      : Number(row.orderIndex)
  };
}

function mapTestRow(row) {
  return {
    ...row,
    score: Number(row.score || 0),
    maxScore: Number(row.maxScore || 0)
  };
}

function mapFlexBlockRow(row) {
  return {
    ...row,
    date: row.date,
    startMinutes: Number(row.startMinutes || 0),
    endMinutes: Number(row.endMinutes || 0),
    purpose: String(row.purpose || "").trim()
  };
}

async function ensureFlexBlocksTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS flex_blocks (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      block_date DATE NOT NULL,
      start_minutes INTEGER NOT NULL,
      end_minutes INTEGER NOT NULL,
      purpose TEXT NOT NULL DEFAULT '',
      UNIQUE (student_id, block_date, start_minutes, end_minutes)
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_flex_blocks_student_date
    ON flex_blocks(student_id, block_date)
  `);
}

module.exports = {
  createRecordsRepository
};
