function registerInfraRoutes(app) {
  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });
}

module.exports = {
  registerInfraRoutes
};
