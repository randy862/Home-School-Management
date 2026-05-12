function registerRecordsRoutes(app, deps) {
  const {
    commercialPolicyService,
    isPostgresMode,
    recordsService
  } = deps;

  app.get("/api/attendance", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Attendance")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await recordsService.listAttendanceForUser(req.auth.user));
    } catch (error) {
      sendRecordsRouteError(res, error);
    }
  });

  app.get("/api/instruction-actuals", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Actual instructional minutes")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await recordsService.listActualInstructionMinutesForUser(req.auth.user));
    } catch (error) {
      sendRecordsRouteError(res, error);
    }
  });

  app.get("/api/flex-blocks", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Flex blocks")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await recordsService.listFlexBlocksForUser(req.auth.user));
    } catch (error) {
      sendRecordsRouteError(res, error);
    }
  });

  app.post("/api/attendance", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Attendance")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      if (commercialPolicyService) {
        await commercialPolicyService.assertAttendanceWriteAllowed(req.body);
      }
      res.status(201).json(await recordsService.createAttendance(req.body));
    } catch (error) {
      sendRecordsRouteError(res, error);
    }
  });

  app.post("/api/instruction-actuals", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Actual instructional minutes")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.status(201).json(await recordsService.createActualInstructionMinutes(req.body));
    } catch (error) {
      sendRecordsRouteError(res, error);
    }
  });

  app.post("/api/flex-blocks", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Flex blocks")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.status(201).json(await recordsService.createFlexBlock(req.body));
    } catch (error) {
      sendRecordsRouteError(res, error);
    }
  });

  app.patch("/api/attendance/:id", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Attendance")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      if (commercialPolicyService) {
        await commercialPolicyService.assertAttendanceWriteAllowed({ ...req.body, id: req.params.id });
      }
      const updated = await recordsService.updateAttendance(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ error: "Attendance record not found." });
        return;
      }
      res.json(updated);
    } catch (error) {
      sendRecordsRouteError(res, error);
    }
  });

  app.delete("/api/attendance/:id", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Attendance")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const deleted = await recordsService.deleteAttendance(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Attendance record not found." });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      sendRecordsRouteError(res, error);
    }
  });

  app.patch("/api/instruction-actuals/:id", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Actual instructional minutes")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const updated = await recordsService.updateActualInstructionMinutes(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ error: "Actual instructional minute record not found." });
        return;
      }
      res.json(updated);
    } catch (error) {
      sendRecordsRouteError(res, error);
    }
  });

  app.patch("/api/flex-blocks/:id", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Flex blocks")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const updated = await recordsService.updateFlexBlock(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ error: "Flex block not found." });
        return;
      }
      res.json(updated);
    } catch (error) {
      sendRecordsRouteError(res, error);
    }
  });

  app.delete("/api/instruction-actuals/:id", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Actual instructional minutes")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const deleted = await recordsService.deleteActualInstructionMinutes(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Actual instructional minute record not found." });
        return;
      }
      res.status(204).send();
    } catch (error) {
      sendRecordsRouteError(res, error);
    }
  });

  app.delete("/api/flex-blocks/:id", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Flex blocks")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const deleted = await recordsService.deleteFlexBlock(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Flex block not found." });
        return;
      }
      res.status(204).send();
    } catch (error) {
      sendRecordsRouteError(res, error);
    }
  });

  app.get("/api/tests", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Tests")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await recordsService.listTestsForUser(req.auth.user));
    } catch (error) {
      sendRecordsRouteError(res, error);
    }
  });

  app.post("/api/tests", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Tests")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      if (commercialPolicyService) {
        await commercialPolicyService.assertTestWriteAllowed(req.body);
      }
      res.status(201).json(await recordsService.createTest(req.body));
    } catch (error) {
      sendRecordsRouteError(res, error);
    }
  });

  app.patch("/api/tests/:id", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Tests")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      if (commercialPolicyService) {
        await commercialPolicyService.assertTestWriteAllowed({ ...req.body, id: req.params.id });
      }
      const updated = await recordsService.updateTest(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ error: "Test not found." });
        return;
      }
      res.json(updated);
    } catch (error) {
      sendRecordsRouteError(res, error);
    }
  });

  app.delete("/api/tests/:id", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Tests")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const deleted = await recordsService.deleteTest(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Test not found." });
        return;
      }
      res.status(204).send();
    } catch (error) {
      sendRecordsRouteError(res, error);
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

function sendRecordsRouteError(res, error) {
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
  registerRecordsRoutes
};
