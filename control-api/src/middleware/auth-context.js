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

function resolveCorsOrigin(requestOrigin, configuredOrigin) {
  const configured = String(configuredOrigin || "").trim();
  if (!requestOrigin) return configured || "*";
  if (!configured || configured === "*") return "*";
  const allowed = configured
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return allowed.includes(requestOrigin) ? requestOrigin : "";
}

function createOperatorAuthContextMiddleware(options) {
  const {
    getOperatorSessionByTokenHash,
    sessionConfig
  } = options;

  return async function operatorAuthContextMiddleware(req, _res, next) {
    try {
      const cookies = parseCookies(req.headers.cookie);
      const token = cookies[sessionConfig.cookieName];
      if (!token) {
        req.auth = { user: null, session: null };
        next();
        return;
      }

      const session = await getOperatorSessionByTokenHash(hashSessionToken(token), {
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

module.exports = {
  applyCors,
  createOperatorAuthContextMiddleware
};
