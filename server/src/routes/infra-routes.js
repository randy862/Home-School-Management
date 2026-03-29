function registerInfraRoutes(app, deps) {
  const {
    getPool,
    getPostgresPool,
    isPostgresMode
  } = deps;

  app.get("/health", async (_req, res) => {
    try {
      if (isPostgresMode) {
        const pool = getPostgresPool();
        await pool.query("SELECT 1 AS ok");
      } else {
        const pool = await getPool();
        await pool.request().query("SELECT 1 AS ok");
      }
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
}

module.exports = {
  registerInfraRoutes
};
