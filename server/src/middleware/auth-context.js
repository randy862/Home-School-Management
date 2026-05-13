const { hashSessionToken, parseCookies } = require("../auth-service");

function applyCors(app, appConfig) {
  app.use((req, res, next) => {
    const requestOrigin = String(req.headers.origin || "").trim();
    const corsOrigin = resolveCorsOrigin(requestOrigin, appConfig.corsOrigin);
    if (!corsOrigin && requestOrigin) {
      res.status(403).end();
      return;
    }
    if (!corsOrigin) {
      next();
      return;
    }
    res.setHeader("Access-Control-Allow-Origin", corsOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
    if (corsOrigin !== "*") {
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    res.setHeader("Vary", "Origin");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });
}

function createAuthContextMiddleware(options) {
  const {
    getSessionByTokenHash,
    isPostgresMode,
    sessionConfig
  } = options;

  return async function authContextMiddleware(req, _res, next) {
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

      const session = await getSessionByTokenHash(hashSessionToken(token), {
        idleTimeoutHours: sessionConfig.idleTimeoutHours
      });
      req.auth = {
        user: session?.user || null,
        session: session || null
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

function resolveCorsOrigin(requestOrigin, configuredOrigin) {
  const configured = String(configuredOrigin || "").trim();
  if (!requestOrigin) return configured || "*";
  if (!configured || configured === "*") return "*";
  const allowed = configured
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return allowed.some((origin) => matchesAllowedOrigin(requestOrigin, origin)) ? requestOrigin : "";
}

function matchesAllowedOrigin(requestOrigin, allowedOrigin) {
  if (allowedOrigin === requestOrigin) return true;

  const wildcardMatch = allowedOrigin.match(/^([a-z][a-z0-9+.-]*):\/\/\*\.(.+)$/i);
  if (!wildcardMatch) return false;

  let requestUrl;
  try {
    requestUrl = new URL(requestOrigin);
  } catch (_error) {
    return false;
  }

  const expectedProtocol = `${wildcardMatch[1].toLowerCase()}:`;
  const suffixParts = wildcardMatch[2].toLowerCase().split(":");
  const suffixHost = suffixParts[0];
  const suffixPort = suffixParts[1] || "";
  const requestHost = requestUrl.hostname.toLowerCase();

  if (requestUrl.protocol.toLowerCase() !== expectedProtocol) return false;
  if (requestUrl.port !== suffixPort) return false;
  return requestHost.endsWith(`.${suffixHost}`);
}

module.exports = {
  applyCors,
  createAuthContextMiddleware,
  resolveCorsOrigin
};
