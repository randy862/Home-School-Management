const { ensureAuthenticated } = require("./route-auth");

function registerControlCommercialRoutes(app, deps) {
  const { listCommercialOverview } = deps;

  app.get("/api/control/commercial/overview", async (req, res) => {
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await listCommercialOverview());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = {
  registerControlCommercialRoutes
};
