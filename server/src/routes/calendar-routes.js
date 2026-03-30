function registerCalendarRoutes(app, deps) {
  const {
    calendarService,
    isPostgresMode
  } = deps;

  app.get("/api/school-years", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "School years")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await calendarService.listSchoolYears());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/school-years", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "School years")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.status(201).json(await calendarService.createSchoolYear(req.body));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.patch("/api/school-years/:id", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "School years")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const updated = await calendarService.updateSchoolYear(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ error: "School year not found." });
        return;
      }
      res.json(updated);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.patch("/api/school-years/:id/current", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "School years")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const updated = await calendarService.setCurrentSchoolYear(req.params.id);
      if (!updated) {
        res.status(404).json({ error: "School year not found." });
        return;
      }
      res.json(updated);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.delete("/api/school-years/:id", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "School years")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const deleted = await calendarService.deleteSchoolYear(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "School year not found." });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/quarters", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Quarters")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await calendarService.listQuarters());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/school-years/:id/quarters", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Quarters")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.json(await calendarService.replaceQuartersForSchoolYear(req.params.id, req.body));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.get("/api/daily-breaks", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Daily breaks")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await calendarService.listDailyBreaksForUser(req.auth.user));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/daily-breaks", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Daily breaks")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.status(201).json(await calendarService.createDailyBreak(req.body));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.patch("/api/daily-breaks/:id", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Daily breaks")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const updated = await calendarService.updateDailyBreak(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ error: "Daily break not found." });
        return;
      }
      res.json(updated);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.delete("/api/daily-breaks/:id", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Daily breaks")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const deleted = await calendarService.deleteDailyBreak(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Daily break not found." });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/holidays", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Holidays")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await calendarService.listHolidays());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/holidays", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Holidays")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.status(201).json(await calendarService.createHoliday(req.body));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.patch("/api/holidays/:id", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Holidays")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const updated = await calendarService.updateHoliday(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ error: "Holiday not found." });
        return;
      }
      res.json(updated);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.delete("/api/holidays/:id", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Holidays")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const deleted = await calendarService.deleteHoliday(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Holiday not found." });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/plans", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Plans")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await calendarService.listPlansForUser(req.auth.user));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/plans", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Plans")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.status(201).json(await calendarService.createPlans(req.body));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.patch("/api/plans/:id", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Plans")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const updated = await calendarService.updatePlan(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ error: "Plan not found." });
        return;
      }
      res.json(updated);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.delete("/api/plans/:id", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Plans")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const deleted = await calendarService.deletePlan(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Plan not found." });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

function ensurePostgresMode(_req, res, isPostgresMode, label) {
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
  registerCalendarRoutes
};
