const { randomUUID } = require("crypto");

function registerCalendarRoutes(app, deps) {
  const {
    createSchoolYear,
    isPostgresMode,
    deleteSchoolYear,
    createDailyBreak,
    createHoliday,
    createPlans,
    deleteDailyBreak,
    deleteHoliday,
    deletePlan,
    listDailyBreaksForUser,
    listHolidays,
    listPlansForUser,
    listQuarters,
    listSchoolYears,
    replaceQuartersForSchoolYear,
    setCurrentSchoolYear,
    updateDailyBreak,
    updateHoliday,
    updatePlan,
    updateSchoolYear
  } = deps;

  app.get("/api/school-years", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "School years")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await listSchoolYears());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/school-years", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "School years")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.status(201).json(await createSchoolYear(normalizeSchoolYearPayload(req.body)));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.patch("/api/school-years/:id", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "School years")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const updated = await updateSchoolYear(req.params.id, normalizeSchoolYearPayload({ ...req.body, id: req.params.id }));
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
      const updated = await setCurrentSchoolYear(req.params.id);
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
      const deleted = await deleteSchoolYear(req.params.id);
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
      res.json(await listQuarters());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/school-years/:id/quarters", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Quarters")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const quarters = Array.isArray(req.body?.quarters)
        ? req.body.quarters.map((quarter) => normalizeQuarterPayload(quarter, req.params.id))
        : [];
      res.json(await replaceQuartersForSchoolYear(req.params.id, quarters));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.get("/api/daily-breaks", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Daily breaks")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await listDailyBreaksForUser(req.auth.user));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/daily-breaks", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Daily breaks")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.status(201).json(await createDailyBreak(normalizeDailyBreakPayload(req.body)));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.patch("/api/daily-breaks/:id", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Daily breaks")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const updated = await updateDailyBreak(req.params.id, normalizeDailyBreakPayload({ ...req.body, id: req.params.id }));
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
      const deleted = await deleteDailyBreak(req.params.id);
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
      res.json(await listHolidays());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/holidays", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Holidays")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.status(201).json(await createHoliday(normalizeHolidayPayload(req.body)));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.patch("/api/holidays/:id", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Holidays")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const updated = await updateHoliday(req.params.id, normalizeHolidayPayload({ ...req.body, id: req.params.id }));
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
      const deleted = await deleteHoliday(req.params.id);
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
      res.json(await listPlansForUser(req.auth.user));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/plans", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Plans")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const plansPayload = Array.isArray(req.body?.plans) ? req.body.plans : [req.body];
      const plans = plansPayload.map(normalizePlanPayload);
      if (!plans.length) {
        res.status(400).json({ error: "At least one plan is required." });
        return;
      }
      res.status(201).json(await createPlans(plans));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.patch("/api/plans/:id", async (req, res) => {
    if (!ensurePostgresMode(req, res, isPostgresMode, "Plans")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const updated = await updatePlan(req.params.id, normalizePlanPayload({ ...req.body, id: req.params.id }));
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
      const deleted = await deletePlan(req.params.id);
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

function normalizeHolidayPayload(input) {
  const id = String(input?.id || "").trim() || randomUUID();
  const name = String(input?.name || "").trim();
  const type = String(input?.type || "").trim();
  const startDate = String(input?.startDate || "").trim();
  const endDate = String(input?.endDate || "").trim();
  if (!name || !type || !isIsoDate(startDate) || !isIsoDate(endDate) || startDate > endDate) {
    const error = new Error("Provide valid holiday/break values.");
    error.statusCode = 400;
    throw error;
  }
  return { id, name, type, startDate, endDate };
}

function normalizeSchoolYearPayload(input) {
  const id = String(input?.id || "").trim() || randomUUID();
  const label = String(input?.label || "").trim();
  const startDate = String(input?.startDate || "").trim();
  const endDate = String(input?.endDate || "").trim();
  const requiredInstructionalDays = input?.requiredInstructionalDays === "" || input?.requiredInstructionalDays == null
    ? null
    : Number(input.requiredInstructionalDays);
  const requiredInstructionalHours = input?.requiredInstructionalHours === "" || input?.requiredInstructionalHours == null
    ? null
    : Number(input.requiredInstructionalHours);
  const isCurrent = !!input?.isCurrent;
  if (!label
    || !isIsoDate(startDate)
    || !isIsoDate(endDate)
    || startDate > endDate
    || (requiredInstructionalDays != null && (!Number.isInteger(requiredInstructionalDays) || requiredInstructionalDays < 0))
    || (requiredInstructionalHours != null && (!Number.isFinite(requiredInstructionalHours) || requiredInstructionalHours < 0))) {
    const error = new Error("Provide valid school year values.");
    error.statusCode = 400;
    throw error;
  }
  return { id, label, startDate, endDate, requiredInstructionalDays, requiredInstructionalHours, isCurrent };
}

function normalizeQuarterPayload(input, schoolYearId) {
  const id = String(input?.id || "").trim() || randomUUID();
  const name = String(input?.name || "").trim();
  const startDate = String(input?.startDate || "").trim();
  const endDate = String(input?.endDate || "").trim();
  if (!name || !isIsoDate(startDate) || !isIsoDate(endDate) || startDate > endDate) {
    const error = new Error("Each quarter needs a valid date range.");
    error.statusCode = 400;
    throw error;
  }
  return { id, schoolYearId, name, startDate, endDate };
}

function normalizeDailyBreakPayload(input) {
  const id = String(input?.id || "").trim() || randomUUID();
  const schoolYearId = String(input?.schoolYearId || "").trim();
  const type = String(input?.type || "").trim();
  const description = String(input?.description || "").trim();
  const startTime = String(input?.startTime || "").trim();
  const durationMinutes = Number(input?.durationMinutes);
  const studentIds = Array.isArray(input?.studentIds)
    ? Array.from(new Set(input.studentIds.map((studentId) => String(studentId || "").trim()).filter(Boolean)))
    : [];
  const weekdays = Array.isArray(input?.weekdays)
    ? Array.from(new Set(input.weekdays.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 1 && day <= 5))).sort((a, b) => a - b)
    : [];

  if (!schoolYearId
    || !["lunch", "recess", "other"].includes(type)
    || !/^\d{2}:\d{2}$/.test(startTime)
    || !Number.isFinite(durationMinutes)
    || durationMinutes < 5
    || !studentIds.length
    || !weekdays.length
    || (type === "other" && !description)) {
    const error = new Error("Provide students, a valid start time, a duration of at least 5 minutes, and at least one weekday.");
    error.statusCode = 400;
    throw error;
  }

  return {
    id,
    schoolYearId,
    studentIds,
    type,
    description: type === "other" ? description : "",
    startTime,
    durationMinutes,
    weekdays
  };
}

function normalizePlanPayload(input) {
  const id = String(input?.id || "").trim() || randomUUID();
  const planType = String(input?.planType || "").trim();
  const studentId = String(input?.studentId || "").trim();
  const courseId = String(input?.courseId || "").trim();
  const startDate = String(input?.startDate || "").trim();
  const endDate = String(input?.endDate || "").trim();
  const weekdays = Array.isArray(input?.weekdays)
    ? Array.from(new Set(input.weekdays.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 1 && day <= 5))).sort((a, b) => a - b)
    : [];
  const quarterName = input?.quarterName == null ? null : String(input.quarterName).trim();

  if (!["annual", "quarterly", "weekly"].includes(planType)
    || !studentId
    || !courseId
    || !isIsoDate(startDate)
    || !isIsoDate(endDate)
    || startDate > endDate
    || !weekdays.length) {
    const error = new Error("Provide valid plan values.");
    error.statusCode = 400;
    throw error;
  }

  return {
    id,
    planType,
    studentId,
    courseId,
    startDate,
    endDate,
    weekdays,
    quarterName: quarterName || null
  };
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

module.exports = {
  registerCalendarRoutes
};
