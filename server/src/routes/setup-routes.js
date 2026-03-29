const { createSessionToken, hashPassword, hashSessionToken, mapUserSummary, serializeSessionCookie } = require("../auth-service");

function registerSetupRoutes(app, deps) {
  const {
    getSetupStatus,
    initializeSetup,
    isPostgresMode,
    sessionConfig
  } = deps;

  app.get("/api/setup/status", async (_req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode)) return;

    try {
      const status = await getSetupStatus();
      res.json({ initialized: !!status.initialized });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.post("/api/setup/initialize", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode)) return;

    try {
      const payload = await normalizeSetupPayload(req.body);
      const token = createSessionToken();
      const expiresAt = new Date(Date.now() + (sessionConfig.ttlHours * 60 * 60 * 1000));
      const user = await initializeSetup(
        payload.user,
        payload.setupTokenHash,
        hashSessionToken(token),
        expiresAt
      );

      res.setHeader("Set-Cookie", serializeSessionCookie(sessionConfig.cookieName, token, {
        sameSite: sessionConfig.cookieSameSite,
        secure: sessionConfig.cookieSecure,
        maxAge: sessionConfig.ttlHours * 60 * 60
      }));
      res.status(201).json({ user: mapUserSummary(user) });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });
}

function ensurePostgresMode(res, isPostgresMode) {
  if (isPostgresMode) return true;
  res.status(404).json({ error: "Setup endpoints are available only in postgres mode." });
  return false;
}

async function normalizeSetupPayload(input) {
  const setupToken = String(input?.setupToken || "").trim();
  const username = String(input?.username || "").trim();
  const password = String(input?.password || "");
  if (!setupToken || !username || !password) {
    const error = new Error("Setup token, username, and password are required.");
    error.statusCode = 400;
    throw error;
  }

  const credentials = await hashPassword(password);
  return {
    setupTokenHash: hashSessionToken(setupToken),
    user: {
      id: `setup-admin-${createSessionToken()}`,
      username,
      ...credentials
    }
  };
}

module.exports = {
  registerSetupRoutes
};
