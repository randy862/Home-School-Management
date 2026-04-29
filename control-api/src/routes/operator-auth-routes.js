const {
  clearSessionCookie,
  createSessionToken,
  normalizeOperatorPermissions,
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
    getOperatorById,
    getOperatorByUsername,
    revokeOperatorSessionByTokenHash,
    sessionConfig,
    updateOperatorUser,
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
      const maxAgeSeconds = sessionCookieMaxAgeSeconds(sessionConfig);
      const expiresAt = new Date(Date.now() + (maxAgeSeconds * 1000));
      await createOperatorSession(createdUser.id, hashSessionToken(token), expiresAt);
      await updateOperatorLastLogin(createdUser.id);

      res.setHeader("Set-Cookie", serializeSessionCookie(sessionConfig.cookieName, token, {
        sameSite: sessionConfig.cookieSameSite,
        secure: sessionConfig.cookieSecure,
        maxAge: maxAgeSeconds
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
      const maxAgeSeconds = sessionCookieMaxAgeSeconds(sessionConfig);
      const expiresAt = new Date(Date.now() + (maxAgeSeconds * 1000));
      await createOperatorSession(user.id, hashSessionToken(token), expiresAt);
      await updateOperatorLastLogin(user.id);

      res.setHeader("Set-Cookie", serializeSessionCookie(sessionConfig.cookieName, token, {
        sameSite: sessionConfig.cookieSameSite,
        secure: sessionConfig.cookieSecure,
        maxAge: maxAgeSeconds
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

  app.post("/api/operator/auth/change-password", async (req, res) => {
    if (!req.auth?.user?.id) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }

    try {
      const currentPassword = String(req.body?.currentPassword || "");
      const newPassword = String(req.body?.newPassword || "");
      const confirmPassword = String(req.body?.confirmPassword || "");
      if (!currentPassword || !newPassword || !confirmPassword) {
        res.status(400).json({ error: "Current password, new password, and confirmation are required." });
        return;
      }
      if (newPassword.length < 10) {
        res.status(400).json({ error: "New password must be at least 10 characters." });
        return;
      }
      if (newPassword !== confirmPassword) {
        res.status(400).json({ error: "New password and confirmation must match." });
        return;
      }

      const operator = await getOperatorById(req.auth.user.id);
      if (!operator) {
        res.status(404).json({ error: "Operator not found." });
        return;
      }
      if (!await verifyPassword(operator, currentPassword)) {
        res.status(401).json({ error: "Current password is incorrect." });
        return;
      }

      const credentials = await hashPassword(newPassword);
      const updated = await updateOperatorUser(req.auth.user.id, {
        username: operator.username,
        firstName: operator.firstName,
        lastName: operator.lastName,
        role: operator.role,
        permissions: operator.permissions,
        isActive: operator.isActive,
        ...credentials
      }, {
        operatorUserId: req.auth.user.id
      });

      res.json({ ok: true, user: mapOperatorSummary(updated) });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });
}

function sessionCookieMaxAgeSeconds(sessionConfig) {
  const hours = Number(sessionConfig.absoluteTtlHours || sessionConfig.ttlHours || 0);
  return Math.max(1, hours) * 60 * 60;
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
      firstName: "",
      lastName: "",
      role: "platform_admin",
      permissions: normalizeOperatorPermissions({}, "platform_admin"),
      ...credentials
    }
  };
}

module.exports = {
  registerOperatorAuthRoutes
};
