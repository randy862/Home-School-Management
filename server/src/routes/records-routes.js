const { randomUUID } = require("crypto");

function registerRecordsRoutes(app, deps) {
  const {
    createAttendance,
    createTest,
    deleteAttendance,
    deleteTest,
    isPostgresMode,
    listAttendanceForUser,
    listTestsForUser,
    updateAttendance,
    updateTest
  } = deps;

  app.get("/api/attendance", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Attendance")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await listAttendanceForUser(req.auth.user));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/attendance", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Attendance")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.status(201).json(await createAttendance(normalizeAttendancePayload(req.body)));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.patch("/api/attendance/:id", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Attendance")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const updated = await updateAttendance(req.params.id, normalizeAttendancePayload({ ...req.body, id: req.params.id }));
      if (!updated) {
        res.status(404).json({ error: "Attendance record not found." });
        return;
      }
      res.json(updated);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.delete("/api/attendance/:id", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Attendance")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const deleted = await deleteAttendance(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Attendance record not found." });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/tests", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Tests")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await listTestsForUser(req.auth.user));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tests", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Tests")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.status(201).json(await createTest(normalizeTestPayload(req.body)));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.patch("/api/tests/:id", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Tests")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const updated = await updateTest(req.params.id, normalizeTestPayload({ ...req.body, id: req.params.id }));
      if (!updated) {
        res.status(404).json({ error: "Test not found." });
        return;
      }
      res.json(updated);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.delete("/api/tests/:id", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Tests")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const deleted = await deleteTest(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Test not found." });
        return;
      }
      res.status(204).send();
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

function normalizeAttendancePayload(input) {
  const id = String(input?.id || "").trim() || randomUUID();
  const studentId = String(input?.studentId || "").trim();
  const date = String(input?.date || "").trim();
  const present = Boolean(input?.present);
  if (!studentId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const error = new Error("Provide valid attendance values.");
    error.statusCode = 400;
    throw error;
  }
  return { id, studentId, date, present };
}

function normalizeTestPayload(input) {
  const id = String(input?.id || "").trim() || randomUUID();
  const date = String(input?.date || "").trim();
  const studentId = String(input?.studentId || "").trim();
  const subjectId = String(input?.subjectId || "").trim();
  const courseId = String(input?.courseId || "").trim();
  const gradeType = String(input?.gradeType || "").trim();
  const testName = String(input?.testName || gradeType).trim();
  const score = Number(input?.score);
  const maxScore = input?.maxScore == null ? 100 : Number(input.maxScore);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
    || !studentId
    || !subjectId
    || !courseId
    || !gradeType
    || !testName
    || !Number.isFinite(score)
    || !Number.isFinite(maxScore)
    || maxScore <= 0) {
    const error = new Error("Provide valid grade values.");
    error.statusCode = 400;
    throw error;
  }
  return { id, date, studentId, subjectId, courseId, gradeType, testName, score, maxScore };
}

module.exports = {
  registerRecordsRoutes
};
