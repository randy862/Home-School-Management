const { getPostgresPool } = require("../postgres-db");

async function main() {
  const pool = getPostgresPool();
  try {
    const result = await pool.query(`
      SELECT
        id,
        username,
        first_name AS "firstName",
        last_name AS "lastName",
        role,
        permissions_json AS permissions,
        is_active AS "isActive",
        created_at AS "createdAt",
        last_login_at AS "lastLoginAt"
      FROM operator_users
      ORDER BY created_at ASC
    `);
    console.log(JSON.stringify(result.rows, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
