function registerCurriculumRoutes(app, deps) {
  const {
    createCourse,
    createEnrollment,
    createSubject,
    deleteCourse,
    deleteEnrollment,
    deleteSubject,
    isPostgresMode,
    listCoursesForUser,
    listEnrollmentsForUser,
    listSubjectsForUser,
    updateCourse,
    updateEnrollment,
    updateSubject
  } = deps;

  app.get("/api/subjects", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Subjects")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await listSubjectsForUser(req.auth.user));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/subjects", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Subjects")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.status(201).json(await createSubject(normalizeSubjectPayload(req.body)));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.patch("/api/subjects/:id", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Subjects")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const updated = await updateSubject(req.params.id, normalizeSubjectPayload({ ...req.body, id: req.params.id }));
      if (!updated) {
        res.status(404).json({ error: "Subject not found." });
        return;
      }
      res.json(updated);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.delete("/api/subjects/:id", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Subjects")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const deleted = await deleteSubject(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Subject not found." });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/courses", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Courses")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await listCoursesForUser(req.auth.user));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/courses", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Courses")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.status(201).json(await createCourse(normalizeCoursePayload(req.body)));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.patch("/api/courses/:id", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Courses")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const updated = await updateCourse(req.params.id, normalizeCoursePayload({ ...req.body, id: req.params.id }));
      if (!updated) {
        res.status(404).json({ error: "Course not found." });
        return;
      }
      res.json(updated);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.delete("/api/courses/:id", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Courses")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const deleted = await deleteCourse(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Course not found." });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/enrollments", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Enrollments")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await listEnrollmentsForUser(req.auth.user));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/enrollments", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Enrollments")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.status(201).json(await createEnrollment(normalizeEnrollmentPayload(req.body)));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.patch("/api/enrollments/:id", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Enrollments")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const updated = await updateEnrollment(req.params.id, normalizeEnrollmentPayload({ ...req.body, id: req.params.id }));
      if (!updated) {
        res.status(404).json({ error: "Enrollment not found." });
        return;
      }
      res.json(updated);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.delete("/api/enrollments/:id", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Enrollments")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const deleted = await deleteEnrollment(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Enrollment not found." });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
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

function normalizeSubjectPayload(input) {
  const id = String(input?.id || "").trim();
  const name = String(input?.name || "").trim();
  if (!name) {
    const error = new Error("Subject name is required.");
    error.statusCode = 400;
    throw error;
  }
  return { ...(id ? { id } : {}), name };
}

function normalizeCoursePayload(input) {
  const id = String(input?.id || "").trim();
  const name = String(input?.name || "").trim();
  const subjectId = String(input?.subjectId || "").trim();
  const hoursPerDay = Number(input?.hoursPerDay);
  const exclusiveResource = !!input?.exclusiveResource;
  if (!name || !subjectId || Number.isNaN(hoursPerDay) || hoursPerDay <= 0) {
    const error = new Error("Provide course name, subject, and hours/day.");
    error.statusCode = 400;
    throw error;
  }
  return { ...(id ? { id } : {}), name, subjectId, hoursPerDay, exclusiveResource };
}

function normalizeEnrollmentPayload(input) {
  const id = String(input?.id || "").trim();
  const studentId = String(input?.studentId || "").trim();
  const courseId = String(input?.courseId || "").trim();
  const scheduleOrder = input?.scheduleOrder === "" || input?.scheduleOrder == null ? null : Number(input.scheduleOrder);
  if (!studentId || !courseId || (scheduleOrder != null && (!Number.isInteger(scheduleOrder) || scheduleOrder <= 0))) {
    const error = new Error("Provide valid enrollment values.");
    error.statusCode = 400;
    throw error;
  }
  return { ...(id ? { id } : {}), studentId, courseId, scheduleOrder };
}

module.exports = {
  registerCurriculumRoutes
};
