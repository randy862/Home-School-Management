const { getPostgresPool } = require("./postgres-db");

function mapUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    firstName: row.first_name || row.firstName || "",
    lastName: row.last_name || row.lastName || "",
    email: row.email || "",
    phone: row.phone || "",
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
      first_name,
      last_name,
      email,
      phone,
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
      first_name,
      last_name,
      email,
      phone,
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
      first_name AS "firstName",
      last_name AS "lastName",
      email,
      phone,
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

async function countAdmins() {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT COUNT(*)::int AS total
    FROM users
    WHERE role = 'admin'
  `);
  return Number(result.rows[0]?.total || 0);
}

async function createUser(user) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    INSERT INTO users (
      id,
      username,
      role,
      first_name,
      last_name,
      email,
      phone,
      student_id,
      password_hash,
      password_salt,
      password_algorithm,
      password_iterations,
      must_change_password,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_DATE, CURRENT_DATE)
    RETURNING
      id,
      username,
      role,
      first_name AS "firstName",
      last_name AS "lastName",
      email,
      phone,
      student_id AS "studentId",
      must_change_password AS "mustChangePassword",
      created_at AS "createdAt",
      updated_at AS "updatedAt",
      last_login_at AS "lastLoginAt"
  `, [
    user.id,
    user.username,
    user.role,
    user.firstName || null,
    user.lastName || null,
    user.email || null,
    user.phone || null,
    user.studentId || null,
    user.passwordHash,
    user.passwordSalt,
    user.passwordAlgorithm,
    user.passwordIterations,
    !!user.mustChangePassword
  ]);
  return result.rows[0];
}

async function updateUser(id, user) {
  const pool = getPostgresPool();
  const assignments = [
    "username = $2",
    "role = $3",
    "first_name = $4",
    "last_name = $5",
    "email = $6",
    "phone = $7",
    "student_id = $8",
    "must_change_password = $9",
    "updated_at = CURRENT_DATE"
  ];
  const values = [
    id,
    user.username,
    user.role,
    user.firstName || null,
    user.lastName || null,
    user.email || null,
    user.phone || null,
    user.studentId || null,
    !!user.mustChangePassword
  ];
  let nextIndex = 10;
  if (user.passwordHash) {
    assignments.push(`password_hash = $${nextIndex++}`);
    assignments.push(`password_salt = $${nextIndex++}`);
    assignments.push(`password_algorithm = $${nextIndex++}`);
    assignments.push(`password_iterations = $${nextIndex++}`);
    values.push(user.passwordHash, user.passwordSalt, user.passwordAlgorithm, user.passwordIterations);
  }
  const result = await pool.query(`
    UPDATE users
    SET ${assignments.join(", ")}
    WHERE id = $1
    RETURNING
      id,
      username,
      role,
      first_name AS "firstName",
      last_name AS "lastName",
      email,
      phone,
      student_id AS "studentId",
      must_change_password AS "mustChangePassword",
      created_at AS "createdAt",
      updated_at AS "updatedAt",
      last_login_at AS "lastLoginAt"
  `, values);
  return result.rows[0] || null;
}

async function deleteUser(id) {
  const pool = getPostgresPool();
  const result = await pool.query("DELETE FROM users WHERE id = $1", [id]);
  return result.rowCount > 0;
}

async function createSession(userId, tokenHash, expiresAt) {
  const pool = getPostgresPool();
  await pool.query(`
    INSERT INTO user_sessions (id, user_id, session_token_hash, expires_at, last_seen_at)
    VALUES (gen_random_uuid(), $1, $2, $3, NOW())
  `, [userId, tokenHash, expiresAt]);
}

async function getSessionByTokenHash(tokenHash, options = {}) {
  const pool = getPostgresPool();
  const idleTimeoutHours = Number(options.idleTimeoutHours || 0);
  const result = await pool.query(`
    SELECT
      s.id AS session_id,
      s.user_id,
      s.created_at,
      s.last_seen_at,
      s.expires_at,
      u.id,
      u.username,
      u.role,
      u.first_name,
      u.last_name,
      u.email,
      u.phone,
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
      AND (
        $2::NUMERIC <= 0
        OR COALESCE(s.last_seen_at, s.created_at) > NOW() - ($2::TEXT || ' hours')::INTERVAL
      )
    LIMIT 1
  `, [tokenHash, idleTimeoutHours]);

  const row = result.rows[0];
  if (!row) return null;

  await touchSessionById(row.session_id);

  return {
    sessionId: row.session_id,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    user: mapUserRow(row)
  };
}

async function touchSessionById(sessionId) {
  const pool = getPostgresPool();
  await pool.query(`
    UPDATE user_sessions
    SET last_seen_at = NOW()
    WHERE id = $1
      AND revoked_at IS NULL
      AND (
        last_seen_at IS NULL
        OR last_seen_at < NOW() - INTERVAL '5 minutes'
      )
  `, [sessionId]);
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

async function getSetupStatus() {
  const pool = getPostgresPool();
  const [runtimeResult, adminCountResult] = await Promise.all([
    pool.query(`
      SELECT
        setup_completed_at AS "setupCompletedAt",
        initialized_by_user_id AS "initializedByUserId"
      FROM app_runtime_state
      WHERE id = 'singleton'
      LIMIT 1
    `),
    pool.query(`
      SELECT COUNT(*)::int AS total
      FROM users
      WHERE role = 'admin'
    `)
  ]);

  const runtime = runtimeResult.rows[0] || { setupCompletedAt: null, initializedByUserId: null };
  const adminCount = Number(adminCountResult.rows[0]?.total || 0);
  return {
    initialized: !!runtime.setupCompletedAt || adminCount > 0,
    setupCompletedAt: runtime.setupCompletedAt || null,
    initializedByUserId: runtime.initializedByUserId || "",
    adminCount
  };
}

async function createSetupToken(tokenHash, expiresAt, options = {}) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    INSERT INTO setup_tokens (token_hash, expires_at, created_by, notes)
    VALUES ($1, $2, $3, $4)
    RETURNING
      id,
      purpose,
      created_at AS "createdAt",
      expires_at AS "expiresAt"
  `, [
    tokenHash,
    expiresAt,
    options.createdBy || null,
    options.notes || null
  ]);
  return result.rows[0];
}

async function initializeSetup(user, setupTokenHash, sessionTokenHash, sessionExpiresAt) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const runtimeResult = await client.query(`
      SELECT setup_completed_at
      FROM app_runtime_state
      WHERE id = 'singleton'
      FOR UPDATE
    `);
    const runtime = runtimeResult.rows[0] || { setup_completed_at: null };
    const adminCountResult = await client.query(`
      SELECT COUNT(*)::int AS total
      FROM users
      WHERE role = 'admin'
    `);
    const adminCount = Number(adminCountResult.rows[0]?.total || 0);
    if (runtime.setup_completed_at || adminCount > 0) {
      const error = new Error("Hosted setup is already complete.");
      error.statusCode = 409;
      throw error;
    }

    const tokenResult = await client.query(`
      SELECT id
      FROM setup_tokens
      WHERE token_hash = $1
        AND used_at IS NULL
        AND expires_at > NOW()
      LIMIT 1
      FOR UPDATE
    `, [setupTokenHash]);
    const token = tokenResult.rows[0];
    if (!token) {
      const error = new Error("Setup token is invalid or expired.");
      error.statusCode = 400;
      throw error;
    }

    const userResult = await client.query(`
      INSERT INTO users (
        id,
        username,
        role,
        first_name,
        last_name,
        email,
        phone,
        student_id,
        password_hash,
        password_salt,
        password_algorithm,
        password_iterations,
        must_change_password,
        created_at,
        updated_at
      )
      VALUES ($1, $2, 'admin', $3, $4, $5, $6, NULL, $7, $8, $9, $10, FALSE, CURRENT_DATE, CURRENT_DATE)
      RETURNING
        id,
        username,
        role,
        first_name AS "firstName",
        last_name AS "lastName",
        email,
        phone,
        student_id AS "studentId",
        must_change_password AS "mustChangePassword",
        created_at AS "createdAt",
        updated_at AS "updatedAt",
        last_login_at AS "lastLoginAt"
    `, [
      user.id,
      user.username,
      user.firstName || null,
      user.lastName || null,
      user.email || null,
      user.phone || null,
      user.passwordHash,
      user.passwordSalt,
      user.passwordAlgorithm,
      user.passwordIterations
    ]);
    const createdUser = userResult.rows[0];

    await client.query(`
      UPDATE setup_tokens
      SET used_at = NOW()
      WHERE id = $1
    `, [token.id]);

    await client.query(`
      UPDATE app_runtime_state
      SET
        setup_completed_at = NOW(),
        initialized_by_user_id = $1,
        updated_at = NOW()
      WHERE id = 'singleton'
    `, [createdUser.id]);

    await client.query(`
      INSERT INTO user_sessions (id, user_id, session_token_hash, expires_at, last_seen_at)
      VALUES (gen_random_uuid(), $1, $2, $3, NOW())
    `, [createdUser.id, sessionTokenHash, sessionExpiresAt]);

    await client.query(`
      UPDATE users
      SET last_login_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `, [createdUser.id]);

    await client.query("COMMIT");
    return {
      ...createdUser,
      lastLoginAt: new Date().toISOString()
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  countAdmins,
  createUser,
  createSession,
  createSetupToken,
  deleteUser,
  getSessionByTokenHash,
  getSetupStatus,
  getUserById,
  getUserByUsername,
  initializeSetup,
  listUsers,
  revokeSessionByTokenHash,
  updateLastLogin,
  updateUser
};
