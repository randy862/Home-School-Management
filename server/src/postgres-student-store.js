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
      created_at AS "createdAt"
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
      created_at AS "createdAt"
  `, [id, student.firstName, student.lastName, student.birthdate, student.grade, student.ageRecorded]);
  return result.rows[0] || null;
}

async function deleteStudent(id) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      UPDATE daily_breaks
      SET student_ids_json = (
        SELECT COALESCE(jsonb_agg(value), '[]'::jsonb)
        FROM jsonb_array_elements_text(student_ids_json) AS value
        WHERE value <> $1
      )
      WHERE student_ids_json @> to_jsonb(ARRAY[$1]::text[])
    `, [id]);
    await client.query(`DELETE FROM daily_breaks WHERE student_ids_json = '[]'::jsonb`, []);
    await client.query(`UPDATE users SET student_id = NULL WHERE student_id = $1`, [id]);
    const result = await client.query(`DELETE FROM students WHERE id = $1`, [id]);
    await client.query("COMMIT");
    return result.rowCount > 0;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createStudent,
  deleteStudent,
  getStudentById,
  listStudents,
  updateStudent
};
