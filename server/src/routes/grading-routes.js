function registerGradingRoutes(app, deps) {
  const {
    gradingService,
    isPostgresMode,
  } = deps;

  app.get("/api/grade-types", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Grade types")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await gradingService.listGradeTypes());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/grade-types", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Grade types")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.json(await gradingService.replaceGradeTypes(req.body));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.get("/api/grading-criteria", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Grading criteria")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await gradingService.getGradingCriteria());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/grading-criteria", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Grading criteria")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.json(await gradingService.saveGradingCriteria(req.body));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });
}

function ensurePostgresMode(res, isPostgresMode, label) {
  if (isPostgresMode) return true;
  res.status(404).json({ error: `${label} endpoint is available only in postgres mode.` });
  return false;
}

function ensureAuthenticated(req, res) {
  if (req.auth?.user) return true;
  res.status(401).json({ error: "Authentication required." });
  return false;
}

function ensureAdmin(req, res) {
  if (!ensureAuthenticated(req, res)) return false;
  if (req.auth.user.role === "admin") return true;
  res.status(403).json({ error: "Admin access required." });
  return false;
}

module.exports = {
  registerGradingRoutes
};
