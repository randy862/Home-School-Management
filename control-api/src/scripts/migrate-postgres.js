const fs = require("fs");
const path = require("path");
const { getPostgresPool } = require("../postgres-db");

async function run() {
  const migrationsDir = path.resolve(__dirname, "../../migrations/postgres");
  const files = fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const pool = getPostgresPool();

  for (const file of files) {
    const sqlText = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    await pool.query(sqlText);
    console.log(`Migration applied: ${file}`);
  }

  await pool.end();
}

run().catch((error) => {
  console.error("Control API PostgreSQL migration failed:", error.message);
  process.exit(1);
});
