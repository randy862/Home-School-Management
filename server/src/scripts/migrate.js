const fs = require("fs");
const path = require("path");
const { getPool } = require("../db");

async function run() {
  const migrationPath = path.resolve(__dirname, "../../migrations/001_initial_schema.sql");
  const sqlText = fs.readFileSync(migrationPath, "utf8");

  const pool = await getPool();
  await pool.request().batch(sqlText);
  console.log("Migration applied: 001_initial_schema.sql");
  await pool.close();
}

run().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exit(1);
});
