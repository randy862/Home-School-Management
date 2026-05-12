const { getPostgresPool } = require("./postgres-db");

async function listInstructors() {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      first_name AS "firstName",
      last_name AS "lastName",
      birthdate,
      category,
      education_level AS "educationLevel",
      age_recorded AS "ageRecorded",
      created_at AS "createdAt"
    FROM instructors
    ORDER BY lower(last_name), lower(first_name)
  `);
  return result.rows;
}

async function listInstructorsForUser(user) {
  if (user?.role !== "student") {
    return listInstructors();
  }

  const studentId = String(user?.studentId || "").trim();
  if (!studentId) return [];

  const pool = getPostgresPool();
  const result = await pool.query(`
    WITH assigned_instructors AS (
      SELECT c.instructor_id
      FROM courses c
      JOIN enrollments e
        ON e.course_id = c.id
      WHERE e.student_id = $1
        AND c.instructor_id IS NOT NULL

      UNION

      SELECT c.instructor_id
      FROM courses c
      JOIN course_sections cs
        ON cs.course_id = c.id
      JOIN section_enrollments se
        ON se.course_section_id = cs.id
      WHERE se.student_id = $1
        AND c.instructor_id IS NOT NULL

      UNION

      SELECT instructor_id
      FROM actual_instruction_minutes
      WHERE student_id = $1
        AND instructor_id IS NOT NULL
    )
    SELECT DISTINCT
      i.id,
      i.first_name AS "firstName",
      i.last_name AS "lastName",
      NULL::date AS birthdate,
      'other' AS category,
      '' AS "educationLevel",
      NULL::integer AS "ageRecorded",
      NULL::date AS "createdAt"
    FROM instructors i
    JOIN assigned_instructors assigned
      ON assigned.instructor_id = i.id
    ORDER BY lower(i.last_name), lower(i.first_name)
  `, [studentId]);
  return result.rows;
}

async function getInstructorById(id) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      first_name AS "firstName",
      last_name AS "lastName",
      birthdate,
      category,
      education_level AS "educationLevel",
      age_recorded AS "ageRecorded",
      created_at AS "createdAt"
    FROM instructors
    WHERE id = $1
    LIMIT 1
  `, [id]);
  return result.rows[0] || null;
}

async function createInstructor(instructor) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    INSERT INTO instructors (id, first_name, last_name, birthdate, category, education_level, age_recorded, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING
      id,
      first_name AS "firstName",
      last_name AS "lastName",
      birthdate,
      category,
      education_level AS "educationLevel",
      age_recorded AS "ageRecorded",
      created_at AS "createdAt"
  `, [
    instructor.id,
    instructor.firstName,
    instructor.lastName,
    instructor.birthdate,
    instructor.category,
    instructor.educationLevel || null,
    instructor.ageRecorded,
    instructor.createdAt
  ]);
  return result.rows[0];
}

async function updateInstructor(id, instructor) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    UPDATE instructors
    SET
      first_name = $2,
      last_name = $3,
      birthdate = $4,
      category = $5,
      education_level = $6,
      age_recorded = $7,
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      first_name AS "firstName",
      last_name AS "lastName",
      birthdate,
      category,
      education_level AS "educationLevel",
      age_recorded AS "ageRecorded",
      created_at AS "createdAt"
  `, [
    id,
    instructor.firstName,
    instructor.lastName,
    instructor.birthdate,
    instructor.category,
    instructor.educationLevel || null,
    instructor.ageRecorded
  ]);
  return result.rows[0] || null;
}

async function deleteInstructor(id) {
  const pool = getPostgresPool();
  const result = await pool.query("DELETE FROM instructors WHERE id = $1", [id]);
  return result.rowCount > 0;
}

module.exports = {
  createInstructor,
  deleteInstructor,
  getInstructorById,
  listInstructors,
  listInstructorsForUser,
  updateInstructor
};
