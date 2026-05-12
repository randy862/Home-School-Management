function applySecurityHeaders(app, options = {}) {
  const csp = options.contentSecurityPolicy
    || "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";

  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Content-Security-Policy", csp);
    if (req.secure || String(req.headers["x-forwarded-proto"] || "").toLowerCase() === "https") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });
}

function createRateLimiter(options = {}) {
  const windowMs = Math.max(1000, Number(options.windowMs || 60000));
  const max = Math.max(1, Number(options.max || 60));
  const message = options.message || "Too many requests. Try again later.";
  const buckets = new Map();

  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now();
    const key = `${clientKey(req)}:${req.method}:${req.path}`;
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      res.status(429).json({ error: message });
      return;
    }
    next();
  };
}

function clientKey(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwardedFor || req.ip || req.socket?.remoteAddress || "unknown";
}

module.exports = {
  applySecurityHeaders,
  createRateLimiter
};
