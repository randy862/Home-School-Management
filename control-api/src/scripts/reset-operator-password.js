const { getPostgresPool } = require("../postgres-db");
const { hashPassword } = require("../auth-service");

async function main() {
  const username = String(process.env.OPERATOR_USERNAME || "").trim();
  const password = String(process.env.OPERATOR_PASSWORD || "");
  if (!username || !password) {
    throw new Error("OPERATOR_USERNAME and OPERATOR_PASSWORD are required.");
  }

  const credentials = await hashPassword(password);
  const pool = getPostgresPool();
  try {
    const result = await pool.query(`
      UPDATE operator_users
      SET
        password_hash = $2,
        password_salt = $3,
        password_algorithm = $4,
        password_iterations = $5,
        updated_at = NOW()
      WHERE lower(username) = lower($1)
      RETURNING
        id,
        username,
        role,
        is_active AS "isActive"
    `, [
      username,
      credentials.passwordHash,
      credentials.passwordSalt,
      credentials.passwordAlgorithm,
      credentials.passwordIterations
    ]);

    if (!result.rows[0]) {
      throw new Error(`Operator ${username} was not found.`);
    }

    console.log(JSON.stringify({
      operator: result.rows[0],
      passwordReset: true
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
