const { createSessionToken, hashSessionToken } = require("../auth-service");
const { getPostgresPool } = require("../postgres-db");
const { createSetupToken, getSetupStatus } = require("../postgres-auth-store");

async function run() {
  const pool = getPostgresPool();
  const status = await getSetupStatus();
  if (status.initialized) {
    throw new Error("Hosted setup is already complete for this deployment.");
  }

  const rawToken = createSessionToken();
  const ttlHours = Number(process.env.SETUP_TOKEN_TTL_HOURS || 2);
  const expiresAt = new Date(Date.now() + (Math.max(1, ttlHours) * 60 * 60 * 1000));
  const token = await createSetupToken(hashSessionToken(rawToken), expiresAt, {
    notes: "CLI-generated initial admin setup token"
  });

  await pool.end();

  console.log("Setup token created.");
  console.log(`Token: ${rawToken}`);
  console.log(`Expires: ${token.expiresAt}`);
}

run().catch(async (error) => {
  try {
    const pool = getPostgresPool();
    await pool.end();
  } catch {
    // ignore close errors during failure cleanup
  }
  console.error("Setup token creation failed:", error.message);
  process.exit(1);
});
