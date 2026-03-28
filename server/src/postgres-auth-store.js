const { getPostgresPool } = require("./postgres-db");

function mapUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    studentId: row.student_id || "",
    mustChangePassword: row.must_change_password,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    passwordAlgorithm: row.password_algorithm,
    passwordIterations: row.password_iterations
  };
}

async function getUserByUsername(username) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      username,
      role,
      student_id,
      must_change_password,
      password_hash,
      password_salt,
      password_algorithm,
      password_iterations
    FROM users
    WHERE lower(username) = lower($1)
    LIMIT 1
  `, [username]);
  return mapUserRow(result.rows[0]);
}

async function getUserById(id) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      username,
      role,
      student_id,
      must_change_password,
      password_hash,
      password_salt,
      password_algorithm,
      password_iterations
    FROM users
    WHERE id = $1
    LIMIT 1
  `, [id]);
  return mapUserRow(result.rows[0]);
}

async function listUsers() {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      username,
      role,
      student_id AS "studentId",
      must_change_password AS "mustChangePassword",
      created_at AS "createdAt",
      updated_at AS "updatedAt",
      last_login_at AS "lastLoginAt"
    FROM users
    ORDER BY lower(username)
  `);
  return result.rows;
}

async function createSession(userId, tokenHash, expiresAt) {
  const pool = getPostgresPool();
  await pool.query(`
    INSERT INTO user_sessions (id, user_id, session_token_hash, expires_at)
    VALUES (gen_random_uuid(), $1, $2, $3)
  `, [userId, tokenHash, expiresAt]);
}

async function getSessionByTokenHash(tokenHash) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      s.id AS session_id,
      s.user_id,
      s.expires_at,
      u.id,
      u.username,
      u.role,
      u.student_id,
      u.must_change_password,
      u.password_hash,
      u.password_salt,
      u.password_algorithm,
      u.password_iterations
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.session_token_hash = $1
      AND s.revoked_at IS NULL
      AND s.expires_at > NOW()
    LIMIT 1
  `, [tokenHash]);

  const row = result.rows[0];
  if (!row) return null;

  return {
    sessionId: row.session_id,
    user: mapUserRow(row)
  };
}

async function revokeSessionByTokenHash(tokenHash) {
  const pool = getPostgresPool();
  await pool.query(`
    UPDATE user_sessions
    SET revoked_at = NOW()
    WHERE session_token_hash = $1
      AND revoked_at IS NULL
  `, [tokenHash]);
}

async function updateLastLogin(userId) {
  const pool = getPostgresPool();
  await pool.query(`
    UPDATE users
    SET last_login_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
  `, [userId]);
}

module.exports = {
  createSession,
  getSessionByTokenHash,
  getUserById,
  getUserByUsername,
  listUsers,
  revokeSessionByTokenHash,
  updateLastLogin
};
