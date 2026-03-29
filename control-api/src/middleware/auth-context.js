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

      const session = await getOperatorSessionByTokenHash(hashSessionToken(token));
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
