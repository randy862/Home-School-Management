const { getPostgresPool } = require("./postgres-db");

async function listStudents() {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      first_name AS "firstName",
      last_name AS "lastName",
      birthdate,
      grade,
      age_recorded AS "ageRecorded",
      created_at AS "createdAt",
      archived_at AS "archivedAt"
    FROM students
    ORDER BY lower(last_name), lower(first_name)
  `);
  return result.rows;
}

async function getStudentById(id) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      first_name AS "firstName",
      last_name AS "lastName",
      birthdate,
      grade,
      age_recorded AS "ageRecorded",
      created_at AS "createdAt",
      archived_at AS "archivedAt"
    FROM students
    WHERE id = $1
    LIMIT 1
  `, [id]);
  return result.rows[0] || null;
}

async function createStudent(student) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    INSERT INTO students (id, first_name, last_name, birthdate, grade, age_recorded, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING
      id,
      first_name AS "firstName",
      last_name AS "lastName",
      birthdate,
      grade,
      age_recorded AS "ageRecorded",
      created_at AS "createdAt",
      archived_at AS "archivedAt"
  `, [student.id, student.firstName, student.lastName, student.birthdate, student.grade, student.ageRecorded, student.createdAt]);
  return result.rows[0];
}

async function updateStudent(id, student) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    UPDATE students
    SET
      first_name = $2,
      last_name = $3,
      birthdate = $4,
      grade = $5,
      age_recorded = $6
    WHERE id = $1
    RETURNING
      id,
      first_name AS "firstName",
      last_name AS "lastName",
      birthdate,
      grade,
      age_recorded AS "ageRecorded",
      created_at AS "createdAt",
      archived_at AS "archivedAt"
  `, [id, student.firstName, student.lastName, student.birthdate, student.grade, student.ageRecorded]);
  return result.rows[0] || null;
}

async function deleteStudent(id) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    UPDATE students
    SET archived_at = COALESCE(archived_at, NOW())
    WHERE id = $1
    RETURNING id
  `, [id]);
  return result.rowCount > 0;
}

async function restoreStudent(id) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    UPDATE students
    SET archived_at = NULL
    WHERE id = $1
    RETURNING
      id,
      first_name AS "firstName",
      last_name AS "lastName",
      birthdate,
      grade,
      age_recorded AS "ageRecorded",
      created_at AS "createdAt",
      archived_at AS "archivedAt"
  `, [id]);
  return result.rows[0] || null;
}

module.exports = {
  createStudent,
  deleteStudent,
  getStudentById,
  listStudents,
  restoreStudent,
  updateStudent
};
