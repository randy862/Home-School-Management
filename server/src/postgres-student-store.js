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
      created_at AS "createdAt"
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
      created_at AS "createdAt"
    FROM students
    WHERE id = $1
    LIMIT 1
  `, [id]);
  return result.rows[0] || null;
}

module.exports = {
  getStudentById,
  listStudents
};
