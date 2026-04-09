function registerCurriculumRoutes(app, deps) {
  const {
    curriculumService,
    isPostgresMode,
  } = deps;

  app.get("/api/subjects", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Subjects")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await curriculumService.listSubjectsForUser(req.auth.user));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/subjects", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Subjects")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.status(201).json(await curriculumService.createSubject(req.body));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.patch("/api/subjects/:id", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Subjects")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const updated = await curriculumService.updateSubject(req.params.id, req.body);
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
      const deleted = await curriculumService.deleteSubject(req.params.id);
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
      res.json(await curriculumService.listCoursesForUser(req.auth.user));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/courses", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Courses")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.status(201).json(await curriculumService.createCourse(req.body));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.patch("/api/courses/:id", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Courses")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const updated = await curriculumService.updateCourse(req.params.id, req.body);
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
      const deleted = await curriculumService.deleteCourse(req.params.id);
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
      res.json(await curriculumService.listEnrollmentsForUser(req.auth.user));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/student-schedule-blocks", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Student schedule blocks")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await curriculumService.listStudentScheduleBlocksForUser(req.auth.user));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/enrollments", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Enrollments")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.status(201).json(await curriculumService.createEnrollment(req.body));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.post("/api/student-schedule-blocks", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Student schedule blocks")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.status(201).json(await curriculumService.createStudentScheduleBlock(req.body));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.patch("/api/enrollments/:id", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Enrollments")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const updated = await curriculumService.updateEnrollment(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ error: "Enrollment not found." });
        return;
      }
      res.json(updated);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.patch("/api/student-schedule-blocks/:id", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Student schedule blocks")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const updated = await curriculumService.updateStudentScheduleBlock(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ error: "Student schedule block not found." });
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
      const deleted = await curriculumService.deleteEnrollment(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Enrollment not found." });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/student-schedule-blocks/:id", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Student schedule blocks")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const deleted = await curriculumService.deleteStudentScheduleBlock(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Student schedule block not found." });
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

module.exports = {
  registerCurriculumRoutes
};
