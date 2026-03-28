const express = require("express");
const { app: appConfig, session: sessionConfig } = require("./config");
const { getPool } = require("./db");
const { getPostgresPool } = require("./postgres-db");
const { readState, writeState } = require("./state-store");
const {
  clearSessionCookie,
  createSessionToken,
  hashSessionToken,
  mapUserSummary,
  parseCookies,
  serializeSessionCookie,
  verifyPassword
} = require("./auth-service");
const {
  createSession,
  getSessionByTokenHash,
  getUserByUsername,
  listUsers,
  revokeSessionByTokenHash,
  updateLastLogin
} = require("./postgres-auth-store");
const { getStudentById, listStudents } = require("./postgres-student-store");
const {
  listAttendanceForUser,
  listCoursesForUser,
  listEnrollmentsForUser,
  listQuarters,
  listSchoolYears,
  listSubjectsForUser,
  listTestsForUser
} = require("./postgres-academics-store");

const app = express();
const isPostgresMode = appConfig.dbClient === "postgres";

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", appConfig.corsOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  if (appConfig.corsOrigin !== "*") {
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});
app.use(express.json({ limit: "5mb" }));

app.use(async (req, _res, next) => {
  if (!isPostgresMode) {
    req.auth = { user: null, session: null };
    next();
    return;
  }

  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[sessionConfig.cookieName];
    if (!token) {
      req.auth = { user: null, session: null };
      next();
      return;
    }

    const session = await getSessionByTokenHash(hashSessionToken(token));
    req.auth = {
      user: session?.user || null,
      session: session || null
    };
    next();
  } catch (error) {
    next(error);
  }
});

app.get("/health", async (_req, res) => {
  try {
    if (isPostgresMode) {
      const pool = getPostgresPool();
      await pool.query("SELECT 1 AS ok");
    } else {
      const pool = await getPool();
      await pool.request().query("SELECT 1 AS ok");
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  if (!isPostgresMode) {
    res.status(404).json({ error: "Auth endpoints are available only in postgres mode." });
    return;
  }

  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required." });
      return;
    }

    const user = await getUserByUsername(username);
    if (!await verifyPassword(user, password)) {
      res.status(401).json({ error: "Invalid username or password." });
      return;
    }

    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + (sessionConfig.ttlHours * 60 * 60 * 1000));
    await createSession(user.id, hashSessionToken(token), expiresAt);
    await updateLastLogin(user.id);

    res.setHeader("Set-Cookie", serializeSessionCookie(sessionConfig.cookieName, token, {
      sameSite: sessionConfig.cookieSameSite,
      secure: sessionConfig.cookieSecure,
      maxAge: sessionConfig.ttlHours * 60 * 60
    }));
    res.json({ user: mapUserSummary(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  if (!isPostgresMode) {
    res.status(404).json({ error: "Auth endpoints are available only in postgres mode." });
    return;
  }

  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[sessionConfig.cookieName];
    if (token) {
      await revokeSessionByTokenHash(hashSessionToken(token));
    }
    res.setHeader("Set-Cookie", clearSessionCookie(sessionConfig.cookieName, {
      sameSite: sessionConfig.cookieSameSite,
      secure: sessionConfig.cookieSecure
    }));
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/me", (req, res) => {
  if (!isPostgresMode) {
    res.status(404).json({ error: "Auth endpoints are available only in postgres mode." });
    return;
  }
  if (!req.auth?.user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  res.json({ user: mapUserSummary(req.auth.user) });
});

app.get("/api/users", async (req, res) => {
  if (!isPostgresMode) {
    res.status(404).json({ error: "Users endpoint is available only in postgres mode." });
    return;
  }
  if (!req.auth?.user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  if (req.auth.user.role !== "admin") {
    res.status(403).json({ error: "Admin access required." });
    return;
  }

  try {
    res.json(await listUsers());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/students", async (req, res) => {
  try {
    if (isPostgresMode) {
      if (!req.auth?.user) {
        res.status(401).json({ error: "Authentication required." });
        return;
      }
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

app.get("/api/subjects", async (req, res) => {
  if (!isPostgresMode) {
    res.status(404).json({ error: "Subjects endpoint is available only in postgres mode." });
    return;
  }
  if (!req.auth?.user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    res.json(await listSubjectsForUser(req.auth.user));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/courses", async (req, res) => {
  if (!isPostgresMode) {
    res.status(404).json({ error: "Courses endpoint is available only in postgres mode." });
    return;
  }
  if (!req.auth?.user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    res.json(await listCoursesForUser(req.auth.user));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/enrollments", async (req, res) => {
  if (!isPostgresMode) {
    res.status(404).json({ error: "Enrollments endpoint is available only in postgres mode." });
    return;
  }
  if (!req.auth?.user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    res.json(await listEnrollmentsForUser(req.auth.user));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/school-years", async (req, res) => {
  if (!isPostgresMode) {
    res.status(404).json({ error: "School years endpoint is available only in postgres mode." });
    return;
  }
  if (!req.auth?.user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    res.json(await listSchoolYears());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/quarters", async (req, res) => {
  if (!isPostgresMode) {
    res.status(404).json({ error: "Quarters endpoint is available only in postgres mode." });
    return;
  }
  if (!req.auth?.user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    res.json(await listQuarters());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/attendance", async (req, res) => {
  if (!isPostgresMode) {
    res.status(404).json({ error: "Attendance endpoint is available only in postgres mode." });
    return;
  }
  if (!req.auth?.user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    res.json(await listAttendanceForUser(req.auth.user));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/tests", async (req, res) => {
  if (!isPostgresMode) {
    res.status(404).json({ error: "Tests endpoint is available only in postgres mode." });
    return;
  }
  if (!req.auth?.user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    res.json(await listTestsForUser(req.auth.user));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
    if (!Array.isArray(payload.students)
      || !Array.isArray(payload.subjects)
      || !Array.isArray(payload.courses)
      || !Array.isArray(payload.enrollments)
      || !Array.isArray(payload.plans)
      || !Array.isArray(payload.attendance)
      || !Array.isArray(payload.tests)
      || !Array.isArray(payload.users)
      || !payload.settings) {
      return res.status(400).json({ error: "Invalid state payload." });
    }

    await writeState(payload);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.use((error, _req, res, _next) => {
  res.status(500).json({ error: error.message });
});

app.listen(appConfig.port, () => {
  // Minimal bootstrap log for local operations.
  console.log(`API listening on port ${appConfig.port} using ${appConfig.dbClient}`);
});
