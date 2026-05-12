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
      sendGradingRouteError(res, error);
    }
  });

  app.put("/api/grade-types", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Grade types")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.json(await gradingService.replaceGradeTypes(req.body));
    } catch (error) {
      sendGradingRouteError(res, error);
    }
  });

  app.get("/api/grading-criteria", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Grading criteria")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await gradingService.getGradingCriteria());
    } catch (error) {
      sendGradingRouteError(res, error);
    }
  });

  app.put("/api/grading-criteria", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Grading criteria")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.json(await gradingService.saveGradingCriteria(req.body));
    } catch (error) {
      sendGradingRouteError(res, error);
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

function sendGradingRouteError(res, error) {
  const statusCode = Number(error.statusCode || error.status || 500);
  const safeStatusCode = statusCode >= 400 && statusCode < 600 ? statusCode : 500;
  const isProduction = String(process.env.APP_ENV || "").toLowerCase() === "production";
  const message = safeStatusCode >= 500 && isProduction
    ? "Unexpected error."
    : (error.message || "Unexpected error.");
  if (safeStatusCode >= 500) {
    console.error(error);
  }
  res.status(safeStatusCode).json({ error: message });
}

module.exports = {
  registerGradingRoutes
};
