const { randomUUID } = require("crypto");

function registerGradingRoutes(app, deps) {
  const {
    getGradingCriteria,
    isPostgresMode,
    listGradeTypes,
    replaceGradeTypes,
    saveGradingCriteria
  } = deps;

  app.get("/api/grade-types", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Grade types")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await listGradeTypes());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/grade-types", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Grade types")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const gradeTypes = Array.isArray(req.body?.gradeTypes)
        ? req.body.gradeTypes.map(normalizeGradeTypePayload)
        : [];
      res.json(await replaceGradeTypes(gradeTypes));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.get("/api/grading-criteria", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Grading criteria")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await getGradingCriteria());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/grading-criteria", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Grading criteria")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.json(await saveGradingCriteria(normalizeGradingCriteriaPayload(req.body)));
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

function normalizeGradeTypePayload(input) {
  const id = String(input?.id || "").trim() || randomUUID();
  const name = String(input?.name || "").trim();
  const weightRaw = input?.weight;
  const weight = weightRaw === "" || weightRaw == null ? null : Number(weightRaw);
  if (!name || (weight != null && (!Number.isFinite(weight) || weight < 0 || weight > 100))) {
    const error = new Error("Provide valid grade type values.");
    error.statusCode = 400;
    throw error;
  }
  return { id, name, weight };
}

function normalizeGradingCriteriaPayload(input) {
  const letterScaleRaw = Array.isArray(input?.letterScale) ? input.letterScale : [];
  const letterScale = letterScaleRaw.map((entry) => {
    const label = String(entry?.label || "").trim().toUpperCase();
    const startRaw = entry?.start;
    const endRaw = entry?.end;
    const start = startRaw === "" || startRaw == null ? null : Number(startRaw);
    const end = endRaw === "" || endRaw == null ? null : Number(endRaw);
    if (!label
      || (start != null && (!Number.isInteger(start) || start < 0 || start > 100))
      || (end != null && (!Number.isInteger(end) || end < 0 || end > 100))) {
      const error = new Error("Provide valid grading criteria values.");
      error.statusCode = 400;
      throw error;
    }
    return { label, start, end };
  });
  const gpaScaleOption = String(input?.gpaScaleOption || "").trim() || "4";
  const gpaMax = Number(input?.gpaMax);
  if (!Number.isInteger(gpaMax) || gpaMax <= 0) {
    const error = new Error("GPA Max must be a whole number greater than 0.");
    error.statusCode = 400;
    throw error;
  }
  return { letterScale, gpaScaleOption, gpaMax };
}

module.exports = {
  registerGradingRoutes
};
