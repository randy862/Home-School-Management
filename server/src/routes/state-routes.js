function registerStateRoutes(app, deps) {
  const {
    isPostgresMode,
    readState,
    writeState
  } = deps;

  app.get("/api/state", async (_req, res) => {
    if (isPostgresMode) {
      res.status(410).json({ error: "Full-state sync is disabled in postgres mode." });
      return;
    }

    try {
      const state = await readState();
      res.json(state);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/state", async (req, res) => {
    if (isPostgresMode) {
      res.status(410).json({ error: "Full-state sync is disabled in postgres mode." });
      return;
    }

    try {
      const payload = req.body || {};
      if (!isValidStatePayload(payload)) {
        res.status(400).json({ error: "Invalid state payload." });
        return;
      }

      await writeState(payload);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
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

module.exports = {
  registerStateRoutes
};
