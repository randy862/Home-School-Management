const {
  clearSessionCookie,
  createSessionToken,
  hashSessionToken,
  mapUserSummary,
  parseCookies,
  serializeSessionCookie,
  verifyPassword
} = require("../auth-service");

function registerAuthRoutes(app, deps) {
  const {
    createSession,
    getUserByUsername,
    isPostgresMode,
    revokeSessionByTokenHash,
    sessionConfig,
    updateLastLogin
  } = deps;

  app.post("/api/auth/login", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode)) return;

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
      const maxAgeSeconds = sessionCookieMaxAgeSeconds(sessionConfig);
      const expiresAt = new Date(Date.now() + (maxAgeSeconds * 1000));
      await createSession(user.id, hashSessionToken(token), expiresAt);
      await updateLastLogin(user.id);

      res.setHeader("Set-Cookie", serializeSessionCookie(sessionConfig.cookieName, token, {
        sameSite: sessionConfig.cookieSameSite,
        secure: sessionConfig.cookieSecure,
        maxAge: maxAgeSeconds
      }));
      res.json({ user: mapUserSummary(user) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode)) return;

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
    if (!ensurePostgresMode(res, isPostgresMode)) return;
    if (!req.auth?.user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    res.json({ user: mapUserSummary(req.auth.user) });
  });
}

function ensurePostgresMode(res, isPostgresMode) {
  if (isPostgresMode) return true;
  res.status(404).json({ error: "Auth endpoints are available only in postgres mode." });
  return false;
}

function sessionCookieMaxAgeSeconds(sessionConfig) {
  const hours = Number(sessionConfig.absoluteTtlHours || sessionConfig.ttlHours || 0);
  return Math.max(1, hours) * 60 * 60;
}

module.exports = {
  registerAuthRoutes
};
