const { ensureAuthenticated } = require("./route-auth");

function registerAuditRoutes(app, deps) {
  const { listOperatorAuditLog } = deps;

  app.get("/api/control/audit", async (req, res) => {
    if (!ensureAuthenticated(req, res)) return;

    try {
      const entries = await listOperatorAuditLog({
        tenantId: String(req.query?.tenantId || "").trim() || null,
        targetType: String(req.query?.targetType || "").trim() || null,
        targetId: String(req.query?.targetId || "").trim() || null,
        actionType: String(req.query?.actionType || "").trim() || null,
        limit: req.query?.limit
      });
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = {
  registerAuditRoutes
};
