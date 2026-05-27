const {
  clearSessionCookie,
  createSessionToken,
  hashPassword,
  hashSessionToken,
  mapUserSummary,
  parseCookies,
  serializeSessionCookie,
  verifyPassword
} = require("../auth-service");
const { renderPasswordResetEmail } = require("../services/mail-templates");

const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_RESET_GENERIC_MESSAGE = "If an account matches that information and has an email address, a password reset link will be sent.";

function registerAuthRoutes(app, deps) {
  const {
    consumePasswordResetToken,
    createSession,
    createPasswordResetToken,
    getUserByLoginIdentifier,
    getUserByUsername,
    isPostgresMode,
    mailService,
    passwordResetConfig = {},
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
      sendRouteError(res, error);
    }
  });

  app.post("/api/auth/password-reset/request", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode)) return;

    try {
      const identifier = String(req.body?.identifier || "").trim();
      if (!identifier) {
        res.status(400).json({ error: "Username or email is required." });
        return;
      }

      const user = await getUserByLoginIdentifier(identifier);
      if (user?.id && user.email) {
        const token = createSessionToken();
        const tokenHash = hashSessionToken(token);
        const ttlMinutes = passwordResetTtlMinutes(passwordResetConfig);
        const expiresAt = new Date(Date.now() + (ttlMinutes * 60 * 1000));
        await createPasswordResetToken(user.id, tokenHash, expiresAt, {
          requestedIp: req.ip,
          requestedUserAgent: req.headers["user-agent"] || ""
        });

        const resetUrl = buildPasswordResetUrl(req, token, passwordResetConfig);
        const template = renderPasswordResetEmail({
          appName: "Navigrader",
          resetUrl,
          recipientName: [user.firstName, user.lastName].filter(Boolean).join(" "),
          expirationMinutes: ttlMinutes,
          supportEmail: passwordResetConfig.supportEmail
        });
        const delivery = mailService
          ? await mailService.sendTemplateEmail({
            toEmail: user.email,
            toName: [user.firstName, user.lastName].filter(Boolean).join(" "),
            subject: template.subject,
            htmlBody: template.html,
            textBody: template.text,
            tag: "password-reset",
            metadata: {
              userId: user.id,
              tenantId: req.tenantRuntime?.tenantId || "",
              environment: passwordResetConfig.environmentLabel || ""
            }
          })
          : { status: "failed", errorMessage: "Mail service is not configured." };

        if (delivery.status !== "sent") {
          console.warn("Password reset email was not sent.", {
            status: delivery.status,
            toEmail: user.email,
            errorCode: delivery.errorCode || null,
            errorMessage: delivery.errorMessage || delivery.skippedReason || null
          });
          if (!isProduction()) {
            console.info(`Password reset link for ${user.username}: ${resetUrl}`);
          }
        }
      }

      res.json({ ok: true, message: PASSWORD_RESET_GENERIC_MESSAGE });
    } catch (error) {
      sendRouteError(res, error);
    }
  });

  app.post("/api/auth/password-reset/complete", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode)) return;

    try {
      const token = String(req.body?.token || "").trim();
      const newPassword = String(req.body?.newPassword || "");
      if (!token || !newPassword) {
        res.status(400).json({ error: "Reset token and new password are required." });
        return;
      }
      if (newPassword.length < PASSWORD_MIN_LENGTH) {
        res.status(400).json({ error: `New password must be at least ${PASSWORD_MIN_LENGTH} characters long.` });
        return;
      }

      await consumePasswordResetToken(hashSessionToken(token), await hashPassword(newPassword));
      res.setHeader("Set-Cookie", clearSessionCookie(sessionConfig.cookieName, {
        sameSite: sessionConfig.cookieSameSite,
        secure: sessionConfig.cookieSecure
      }));
      res.json({ ok: true });
    } catch (error) {
      sendRouteError(res, error);
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
      sendRouteError(res, error);
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

function passwordResetTtlMinutes(config = {}) {
  return Math.max(5, Math.min(120, Number(config.tokenTtlMinutes || 60)));
}

function buildPasswordResetUrl(req, token, config = {}) {
  const configuredBaseUrl = String(config.publicBaseUrl || "").trim();
  const tenantRuntimeBaseUrl = String(req.tenantRuntime?.appBaseUrl || "").trim();
  const requestBaseUrl = `${req.protocol}://${req.get("host")}`;
  const baseUrl = (configuredBaseUrl || tenantRuntimeBaseUrl || requestBaseUrl).replace(/\/+$/, "");
  return `${baseUrl}/#resetToken=${encodeURIComponent(token)}`;
}

function isProduction() {
  return String(process.env.APP_ENV || "").toLowerCase() === "production";
}

function sendRouteError(res, error) {
  const statusCode = Number(error.statusCode || error.status || 500);
  const safeStatusCode = statusCode >= 400 && statusCode < 600 ? statusCode : 500;
  const isProduction = String(process.env.APP_ENV || "").toLowerCase() === "production";
  const message = safeStatusCode >= 500 && isProduction
    ? "Unexpected error."
    : (error.message || "Unexpected error.");
  if (safeStatusCode >= 500) console.error(error);
  res.status(safeStatusCode).json({ error: message });
}

module.exports = {
  registerAuthRoutes
};
