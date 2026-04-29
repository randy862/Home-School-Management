const { createSessionToken, hashPassword, hashSessionToken, mapUserSummary, serializeSessionCookie } = require("../auth-service");
const { parseBearerToken, verifyInternalServiceToken } = require("../internal-service-auth");

function registerSetupRoutes(app, deps) {
  const {
    internalConfig,
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
      const maxAgeSeconds = sessionCookieMaxAgeSeconds(sessionConfig);
      const expiresAt = new Date(Date.now() + (maxAgeSeconds * 1000));
      const user = await initializeSetup(
        payload.user,
        payload.setupTokenHash,
        hashSessionToken(token),
        expiresAt
      );

      res.setHeader("Set-Cookie", serializeSessionCookie(sessionConfig.cookieName, token, {
        sameSite: sessionConfig.cookieSameSite,
        secure: sessionConfig.cookieSecure,
        maxAge: maxAgeSeconds
      }));
      res.status(201).json({ user: mapUserSummary(user) });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.get("/api/internal/setup/status", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode)) return;
    if (!ensureInternalControlPlaneRequest(req, res, internalConfig)) return;

    try {
      const status = await getSetupStatus();
      res.json({
        initialized: !!status.initialized,
        setupCompletedAt: status.setupCompletedAt || null
      });
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

function ensureInternalControlPlaneRequest(req, res, internalConfig) {
  const serviceAuthSecret = String(internalConfig?.serviceAuthSecret || "").trim();
  const bearerToken = parseBearerToken(req.headers.authorization);
  if (serviceAuthSecret && bearerToken) {
    const verification = verifyInternalServiceToken(bearerToken, {
      secret: serviceAuthSecret,
      expectedAudience: internalConfig?.expectedAudience,
      expectedIssuer: internalConfig?.controlPlaneIssuer,
      clockSkewSeconds: internalConfig?.serviceAuthClockSkewSeconds
    });
    if (verification.ok) {
      req.internalServiceAuth = verification.claims;
      return true;
    }
    res.status(401).json({ error: "Internal control-plane authentication required." });
    return false;
  }

  const expected = String(internalConfig?.controlPlaneKey || "").trim();
  if (expected && internalConfig?.allowLegacyControlPlaneKey) {
    const provided = String(req.headers["x-control-plane-key"] || "").trim();
    if (provided && provided === expected) {
      return true;
    }
  }

  if (serviceAuthSecret || expected) {
    res.status(401).json({ error: "Internal control-plane authentication required." });
    return false;
  }

  res.status(503).json({ error: "Internal control-plane access is not configured." });
  return false;
}

function sessionCookieMaxAgeSeconds(sessionConfig) {
  const hours = Number(sessionConfig.absoluteTtlHours || sessionConfig.ttlHours || 0);
  return Math.max(1, hours) * 60 * 60;
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
