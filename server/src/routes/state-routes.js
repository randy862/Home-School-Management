function registerStateRoutes(app, deps) {
  const {
    allowLegacyStateSync,
    isPostgresMode,
    readLegacyBridgeState,
    writeLegacyBridgeState
  } = deps;

  app.get("/api/state", async (_req, res) => {
    if (!ensureLegacyStateSyncAllowed(res, isPostgresMode, allowLegacyStateSync)) return;

    try {
      const state = await readLegacyBridgeState();
      res.json(state);
    } catch (error) {
      sendStateRouteError(res, error);
    }
  });

  app.put("/api/state", async (req, res) => {
    if (!ensureLegacyStateSyncAllowed(res, isPostgresMode, allowLegacyStateSync)) return;

    try {
      const payload = req.body || {};
      if (!isValidStatePayload(payload)) {
        res.status(400).json({ error: "Invalid state payload." });
        return;
      }

      await writeLegacyBridgeState(payload);
      res.json({ ok: true });
    } catch (error) {
      sendStateRouteError(res, error);
    }
  });
}

function ensureLegacyStateSyncAllowed(res, isPostgresMode, allowLegacyStateSync) {
  if (isPostgresMode) {
    res.status(410).json({ error: "Legacy full-state sync is disabled in postgres mode." });
    return false;
  }
  if (!allowLegacyStateSync) {
    res.status(410).json({ error: "Legacy full-state sync is disabled." });
    return false;
  }
  return true;
}

function isValidStatePayload(payload) {
  return Array.isArray(payload.students)
    && Array.isArray(payload.subjects)
    && Array.isArray(payload.courses)
    && Array.isArray(payload.enrollments)
    && Array.isArray(payload.plans)
    && Array.isArray(payload.attendance)
    && Array.isArray(payload.tests)
    && Array.isArray(payload.users)
    && !!payload.settings;
}

function sendStateRouteError(res, error) {
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
  registerStateRoutes
};
