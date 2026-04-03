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
      age_recorded AS "ageRecorded",
      created_at AS "createdAt"
    FROM instructors
    ORDER BY lower(last_name), lower(first_name)
  `);
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
    INSERT INTO instructors (id, first_name, last_name, birthdate, category, age_recorded, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING
      id,
      first_name AS "firstName",
      last_name AS "lastName",
      birthdate,
      category,
      age_recorded AS "ageRecorded",
      created_at AS "createdAt"
  `, [
    instructor.id,
    instructor.firstName,
    instructor.lastName,
    instructor.birthdate,
    instructor.category,
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
      age_recorded = $6,
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      first_name AS "firstName",
      last_name AS "lastName",
      birthdate,
      category,
      age_recorded AS "ageRecorded",
      created_at AS "createdAt"
  `, [
    id,
    instructor.firstName,
    instructor.lastName,
    instructor.birthdate,
    instructor.category,
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
  updateInstructor
};
