function registerCalendarRoutes(app, deps) {
  const {
    calendarService,
    commercialPolicyService,
    isPostgresMode
  } = deps;

  app.get("/api/school-years", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "School years")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await calendarService.listSchoolYears());
    } catch (error) {
      sendCalendarRouteError(res, error);
    }
  });

  app.post("/api/school-years", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "School years")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.status(201).json(await calendarService.createSchoolYear(req.body));
    } catch (error) {
      sendCalendarRouteError(res, error);
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
      sendCalendarRouteError(res, error);
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
      sendCalendarRouteError(res, error);
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
      sendCalendarRouteError(res, error);
    }
  });

  app.get("/api/quarters", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Quarters")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await calendarService.listQuarters());
    } catch (error) {
      sendCalendarRouteError(res, error);
    }
  });

  app.put("/api/school-years/:id/quarters", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Quarters")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.json(await calendarService.replaceQuartersForSchoolYear(req.params.id, req.body));
    } catch (error) {
      sendCalendarRouteError(res, error);
    }
  });

  app.get("/api/daily-breaks", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Daily breaks")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await calendarService.listDailyBreaksForUser(req.auth.user));
    } catch (error) {
      sendCalendarRouteError(res, error);
    }
  });

  app.get("/api/schedule-blocks", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Schedule blocks")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await calendarService.listScheduleBlocksForUser(req.auth.user));
    } catch (error) {
      sendCalendarRouteError(res, error);
    }
  });

  app.post("/api/schedule-blocks", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Schedule blocks")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.status(201).json(await calendarService.createScheduleBlock(req.body));
    } catch (error) {
      sendCalendarRouteError(res, error);
    }
  });

  app.patch("/api/schedule-blocks/:id", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Schedule blocks")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const updated = await calendarService.updateScheduleBlock(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ error: "Schedule block not found." });
        return;
      }
      res.json(updated);
    } catch (error) {
      sendCalendarRouteError(res, error);
    }
  });

  app.delete("/api/schedule-blocks/:id", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Schedule blocks")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const deleted = await calendarService.deleteScheduleBlock(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Schedule block not found." });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      sendCalendarRouteError(res, error);
    }
  });

  app.post("/api/daily-breaks", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Daily breaks")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.status(201).json(await calendarService.createDailyBreak(req.body));
    } catch (error) {
      sendCalendarRouteError(res, error);
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
      sendCalendarRouteError(res, error);
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
      sendCalendarRouteError(res, error);
    }
  });

  app.get("/api/holidays", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Holidays")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await calendarService.listHolidays());
    } catch (error) {
      sendCalendarRouteError(res, error);
    }
  });

  app.post("/api/holidays", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Holidays")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.status(201).json(await calendarService.createHoliday(req.body));
    } catch (error) {
      sendCalendarRouteError(res, error);
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
      sendCalendarRouteError(res, error);
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
      sendCalendarRouteError(res, error);
    }
  });

  app.get("/api/plans", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Plans")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await calendarService.listPlansForUser(req.auth.user));
    } catch (error) {
      sendCalendarRouteError(res, error);
    }
  });

  app.post("/api/plans", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Plans")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const plansPayload = Array.isArray(req.body?.plans)
        ? req.body.plans
        : (Array.isArray(req.body) ? req.body : [req.body]);
      if (commercialPolicyService) {
        for (const plan of plansPayload) {
          await commercialPolicyService.assertPlanWriteAllowed(plan);
        }
      }
      res.status(201).json(await calendarService.createPlans(req.body));
    } catch (error) {
      sendCalendarRouteError(res, error);
    }
  });

  app.patch("/api/plans/:id", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Plans")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      if (commercialPolicyService) {
        await commercialPolicyService.assertPlanWriteAllowed({ ...req.body, id: req.params.id });
      }
      const updated = await calendarService.updatePlan(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ error: "Plan not found." });
        return;
      }
      res.json(updated);
    } catch (error) {
      sendCalendarRouteError(res, error);
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
      sendCalendarRouteError(res, error);
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

function sendCalendarRouteError(res, error) {
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
  registerCalendarRoutes
};
