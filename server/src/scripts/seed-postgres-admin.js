const { getPostgresPool } = require("../postgres-db");
const { hashPassword } = require("../auth-service");

async function run() {
  const username = String(process.env.BOOTSTRAP_ADMIN_USERNAME || "admin").trim();
  const password = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || "").trim();

  if (!username || !password) {
    throw new Error("BOOTSTRAP_ADMIN_USERNAME and BOOTSTRAP_ADMIN_PASSWORD are required.");
  }

  const credentials = await hashPassword(password);
  const pool = getPostgresPool();

  await pool.query(`
    INSERT INTO users (
      id,
      username,
      role,
      student_id,
      password_hash,
      password_salt,
      password_algorithm,
      password_iterations,
      must_change_password,
      created_at,
      updated_at
    )
    VALUES ($1, $2, 'admin', NULL, $3, $4, $5, $6, TRUE, CURRENT_DATE, CURRENT_DATE)
    ON CONFLICT (username)
    DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      password_salt = EXCLUDED.password_salt,
      password_algorithm = EXCLUDED.password_algorithm,
      password_iterations = EXCLUDED.password_iterations,
      must_change_password = TRUE,
      updated_at = CURRENT_DATE
  `, [
    "default-admin-user",
    username,
    credentials.passwordHash,
    credentials.passwordSalt,
    credentials.passwordAlgorithm,
    credentials.passwordIterations
  ]);

  await pool.end();
  console.log(`Bootstrap admin ensured for username "${username}".`);
}

run().catch((error) => {
  console.error("Bootstrap admin seed failed:", error.message);
  process.exit(1);
});
