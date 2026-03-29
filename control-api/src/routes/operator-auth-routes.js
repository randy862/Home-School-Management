const {
  clearSessionCookie,
  createSessionToken,
  hashPassword,
  hashSessionToken,
  mapOperatorSummary,
  parseCookies,
  serializeSessionCookie,
  verifyPassword
} = require("../auth-service");

function registerOperatorAuthRoutes(app, deps) {
  const {
    countOperators,
    createBootstrapOperator,
    createOperatorSession,
    getOperatorByUsername,
    revokeOperatorSessionByTokenHash,
    sessionConfig,
    updateOperatorLastLogin
  } = deps;

  app.get("/api/operator/setup/status", async (_req, res) => {
    try {
      const totalOperators = await countOperators();
      res.json({ initialized: totalOperators > 0 });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/operator/setup/bootstrap", async (req, res) => {
    try {
      const payload = await normalizeBootstrapPayload(req.body);
      const createdUser = await createBootstrapOperator(payload.user);
      const token = createSessionToken();
      const expiresAt = new Date(Date.now() + (sessionConfig.ttlHours * 60 * 60 * 1000));
      await createOperatorSession(createdUser.id, hashSessionToken(token), expiresAt);
      await updateOperatorLastLogin(createdUser.id);

      res.setHeader("Set-Cookie", serializeSessionCookie(sessionConfig.cookieName, token, {
        sameSite: sessionConfig.cookieSameSite,
        secure: sessionConfig.cookieSecure,
        maxAge: sessionConfig.ttlHours * 60 * 60
      }));
      res.status(201).json({ user: mapOperatorSummary(createdUser) });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.post("/api/operator/auth/login", async (req, res) => {
    try {
      const username = String(req.body?.username || "").trim();
      const password = String(req.body?.password || "");
      if (!username || !password) {
        res.status(400).json({ error: "Username and password are required." });
        return;
      }

      const user = await getOperatorByUsername(username);
      if (!await verifyPassword(user, password)) {
        res.status(401).json({ error: "Invalid username or password." });
        return;
      }

      const token = createSessionToken();
      const expiresAt = new Date(Date.now() + (sessionConfig.ttlHours * 60 * 60 * 1000));
      await createOperatorSession(user.id, hashSessionToken(token), expiresAt);
      await updateOperatorLastLogin(user.id);

      res.setHeader("Set-Cookie", serializeSessionCookie(sessionConfig.cookieName, token, {
        sameSite: sessionConfig.cookieSameSite,
        secure: sessionConfig.cookieSecure,
        maxAge: sessionConfig.ttlHours * 60 * 60
      }));
      res.json({ user: mapOperatorSummary(user) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/operator/auth/logout", async (req, res) => {
    try {
      const cookies = parseCookies(req.headers.cookie);
      const token = cookies[sessionConfig.cookieName];
      if (token) {
        await revokeOperatorSessionByTokenHash(hashSessionToken(token));
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

  app.get("/api/operator/me", (req, res) => {
    if (!req.auth?.user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    res.json({ user: mapOperatorSummary(req.auth.user) });
  });
}

async function normalizeBootstrapPayload(input) {
  const username = String(input?.username || "").trim();
  const password = String(input?.password || "");
  if (!username || !password) {
    const error = new Error("Username and password are required.");
    error.statusCode = 400;
    throw error;
  }

  const credentials = await hashPassword(password);
  return {
    user: {
      id: `operator-${createSessionToken()}`,
      username,
      role: "platform_admin",
      ...credentials
    }
  };
}

module.exports = {
  registerOperatorAuthRoutes
};
