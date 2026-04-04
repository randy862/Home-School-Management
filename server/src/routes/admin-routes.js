const { createSessionToken, clearSessionCookie, hashPassword, hashSessionToken, parseCookies } = require("../auth-service");

function registerAdminRoutes(app, deps) {
  const {
    countAdmins,
    createUser,
    createInstructor,
    deleteUser,
    deleteStudent,
    deleteInstructor,
    getPool,
    getInstructorById,
    getStudentById,
    getUserById,
    isPostgresMode,
    listInstructors,
    listStudents,
    listUsers,
    revokeSessionByTokenHash,
    sessionConfig,
    updateInstructor,
    updateStudent,
    updateUser,
    createStudent
  } = deps;

  app.get("/api/users", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Users")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.json(await listUsers());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/users", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Users")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const payload = normalizeUserPayload(req.body, { requirePassword: true });
      const credentials = await hashPassword(payload.password);
      res.status(201).json(await createUser({
        id: payload.id,
        username: payload.username,
        role: payload.role,
        studentId: payload.studentId,
        mustChangePassword: payload.mustChangePassword,
        ...credentials
      }));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Users")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const existing = await requireExistingUser(getUserById, req.params.id);
      const payload = normalizeUserPayload({ ...req.body, id: req.params.id }, { requirePassword: false });
      if (existing.role === "admin" && payload.role !== "admin") {
        const adminCount = await countAdmins();
        if (adminCount <= 1) {
          const error = new Error("At least one administrator account is required.");
          error.statusCode = 400;
          throw error;
        }
      }
      const credentials = payload.password ? await hashPassword(payload.password) : null;
      res.json(await updateUser(req.params.id, {
        username: payload.username,
        role: payload.role,
        studentId: payload.studentId,
        mustChangePassword: payload.password ? false : payload.mustChangePassword,
        ...(credentials || {})
      }));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Users")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const existing = await requireExistingUser(getUserById, req.params.id);
      if (existing.role === "admin") {
        const adminCount = await countAdmins();
        if (adminCount <= 1) {
          const error = new Error("At least one administrator account is required.");
          error.statusCode = 400;
          throw error;
        }
      }
      const deleted = await deleteUser(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "User not found." });
        return;
      }
      if (req.auth.user.id === req.params.id) {
        const cookies = parseCookies(req.headers.cookie);
        const token = cookies[sessionConfig.cookieName];
        if (token) {
          await revokeSessionByTokenHash(hashSessionToken(token));
        }
        res.setHeader("Set-Cookie", clearSessionCookie(sessionConfig.cookieName, {
          sameSite: sessionConfig.cookieSameSite,
          secure: sessionConfig.cookieSecure
        }));
      }
      res.json({ ok: true });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.get("/api/students", async (req, res) => {
    try {
      if (isPostgresMode) {
        if (!ensureAuthenticated(req, res)) return;
        if (req.auth.user.role === "student") {
          const student = await getStudentById(req.auth.user.studentId);
          res.json(student ? [student] : []);
          return;
        }
        res.json(await listStudents());
        return;
      }

      const pool = await getPool();
      const result = await pool.request().query(`
        SELECT
          id,
          first_name AS firstName,
          last_name AS lastName,
          birthdate,
          grade,
          age_recorded AS ageRecorded,
          created_at AS createdAt
        FROM dbo.students
        ORDER BY last_name, first_name
      `);
      res.json(result.recordset);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/students", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Students")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.status(201).json(await createStudent(normalizeStudentPayload(req.body)));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.patch("/api/students/:id", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Students")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const updated = await updateStudent(req.params.id, normalizeStudentPayload({ ...req.body, id: req.params.id }));
      if (!updated) {
        res.status(404).json({ error: "Student not found." });
        return;
      }
      res.json(updated);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.delete("/api/students/:id", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Students")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const deleted = await deleteStudent(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Student not found." });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/instructors", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Instructors")) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await listInstructors());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/instructors", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Instructors")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      res.status(201).json(await createInstructor(normalizeInstructorPayload(req.body)));
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.patch("/api/instructors/:id", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Instructors")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const updated = await updateInstructor(req.params.id, normalizeInstructorPayload({ ...req.body, id: req.params.id }));
      if (!updated) {
        res.status(404).json({ error: "Instructor not found." });
        return;
      }
      res.json(updated);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.delete("/api/instructors/:id", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode, "Instructors")) return;
    if (!ensureAdmin(req, res)) return;

    try {
      const existing = await getInstructorById(req.params.id);
      if (!existing) {
        res.status(404).json({ error: "Instructor not found." });
        return;
      }
      const deleted = await deleteInstructor(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Instructor not found." });
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

function normalizeStudentPayload(input) {
  const id = String(input?.id || "").trim() || createSessionToken();
  const firstName = String(input?.firstName || "").trim();
  const lastName = String(input?.lastName || "").trim();
  const birthdate = String(input?.birthdate || "").trim();
  const grade = String(input?.grade || "").trim();
  const ageRecorded = input?.ageRecorded === "" || input?.ageRecorded == null ? null : Number(input.ageRecorded);
  const createdAt = String(input?.createdAt || "").trim() || birthdate;
  if (!firstName
    || !lastName
    || !birthdate
    || !grade
    || (ageRecorded != null && (!Number.isInteger(ageRecorded) || ageRecorded < 0))) {
    const error = new Error("Provide valid student values.");
    error.statusCode = 400;
    throw error;
  }
  return { ...(id ? { id } : {}), firstName, lastName, birthdate, grade, ageRecorded, createdAt };
}

function normalizeInstructorPayload(input) {
  const id = String(input?.id || "").trim() || createSessionToken();
  const firstName = String(input?.firstName || "").trim();
  const lastName = String(input?.lastName || "").trim();
  const birthdate = String(input?.birthdate || "").trim();
  const rawCategory = String(input?.category || "").trim().toLowerCase();
  const category = ["parent", "volunteer", "compensated", "other"].includes(rawCategory) ? rawCategory : "";
  const rawEducationLevel = String(
    input?.educationLevel
    ?? input?.education_level
    ?? input?.educationlevel
    ?? ""
  ).trim().toLowerCase();
  const educationLevel = [
    "",
    "high_school_diploma_or_ged",
    "some_college",
    "associate_degree",
    "bachelors_degree",
    "masters_degree",
    "doctoral_degree",
    "other"
  ].includes(rawEducationLevel) ? rawEducationLevel : "";
  const ageRecorded = input?.ageRecorded === "" || input?.ageRecorded == null ? null : Number(input.ageRecorded);
  const createdAt = String(input?.createdAt || "").trim() || birthdate;
  if (!firstName
    || !lastName
    || !birthdate
    || !category
    || (ageRecorded != null && (!Number.isInteger(ageRecorded) || ageRecorded < 0))) {
    const error = new Error("Provide valid instructor values.");
    error.statusCode = 400;
    throw error;
  }
  return { ...(id ? { id } : {}), firstName, lastName, birthdate, category, educationLevel, ageRecorded, createdAt };
}

function normalizeUserPayload(input, options = {}) {
  const id = String(input?.id || "").trim() || createSessionToken();
  const username = String(input?.username || "").trim();
  const role = input?.role === "student" ? "student" : "admin";
  const studentId = role === "student" ? String(input?.studentId || "").trim() : "";
  const password = String(input?.password || "");
  const mustChangePassword = Boolean(input?.mustChangePassword);
  if (!username) {
    const error = new Error("Username is required.");
    error.statusCode = 400;
    throw error;
  }
  if (role === "student" && !studentId) {
    const error = new Error("Student users must be linked to a student record.");
    error.statusCode = 400;
    throw error;
  }
  if (options.requirePassword && !password) {
    const error = new Error("Password is required for new users.");
    error.statusCode = 400;
    throw error;
  }
  return { id, username, role, studentId, password, mustChangePassword };
}

async function requireExistingUser(getUserById, id) {
  const existing = await getUserById(id);
  if (!existing) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }
  return existing;
}

module.exports = {
  registerAdminRoutes
};
