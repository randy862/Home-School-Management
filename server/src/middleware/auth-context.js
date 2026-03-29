const { hashSessionToken, parseCookies } = require("../auth-service");

function applyCors(app, appConfig) {
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

      const session = await getSessionByTokenHash(hashSessionToken(token));
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
  createAuthContextMiddleware
};
