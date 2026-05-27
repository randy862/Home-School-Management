const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function toBool(value, fallback) {
  if (value == null || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}

function isProductionEnv(value) {
  return String(value || "").trim().toLowerCase() === "production";
}

function parseList(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const appEnv = process.env.APP_ENV || "development";

module.exports = {
  app: {
    env: appEnv,
    port: Number(process.env.APP_PORT || 3000),
    corsOrigin: process.env.APP_CORS_ORIGIN || "*",
    dbClient: String(process.env.DB_CLIENT || "mssql").toLowerCase(),
    allowLegacyStateSync: toBool(process.env.LEGACY_STATE_SYNC_ENABLED, !isProductionEnv(appEnv))
  },
  internal: {
    controlPlaneBaseUrl: String(process.env.CONTROL_PLANE_BASE_URL || "http://127.0.0.1:3100").trim() || "http://127.0.0.1:3100",
    controlPlaneKey: String(process.env.CONTROL_PLANE_INTERNAL_KEY || "").trim(),
    serviceAuthSecret: String(process.env.CONTROL_PLANE_INTERNAL_AUTH_SECRET || "").trim(),
    controlPlaneIssuer: String(process.env.CONTROL_PLANE_INTERNAL_AUTH_ISSUER || "control-plane").trim() || "control-plane",
    expectedAudience: String(process.env.CONTROL_PLANE_INTERNAL_AUTH_AUDIENCE || "tenant-runtime-internal").trim() || "tenant-runtime-internal",
    serviceAuthClockSkewSeconds: Number(process.env.CONTROL_PLANE_INTERNAL_AUTH_CLOCK_SKEW_SECONDS || 30),
    allowLegacyControlPlaneKey: toBool(process.env.CONTROL_PLANE_ALLOW_LEGACY_INTERNAL_KEY, true)
  },
  session: {
    cookieName: process.env.SESSION_COOKIE_NAME || "hsm_session",
    cookieSecure: toBool(process.env.SESSION_COOKIE_SECURE, isProductionEnv(appEnv)),
    cookieSameSite: process.env.SESSION_COOKIE_SAMESITE || "Lax",
    ttlHours: Number(process.env.SESSION_TTL_HOURS || 168),
    idleTimeoutHours: Number(process.env.SESSION_IDLE_TIMEOUT_HOURS || 4),
    absoluteTtlHours: Number(process.env.SESSION_ABSOLUTE_TTL_HOURS || 336)
  },
  public: {
    appBaseUrl: String(process.env.PUBLIC_APP_BASE_URL || process.env.APP_PUBLIC_BASE_URL || process.env.APP_CORS_ORIGIN || "").trim()
  },
  mail: {
    provider: String(process.env.MAIL_PROVIDER || process.env.CONTROL_MAIL_PROVIDER || "postmark").trim().toLowerCase(),
    mode: String(
      process.env.MAIL_MODE
      || process.env.CONTROL_MAIL_MODE
      || (isProductionEnv(appEnv) ? "allowlist_only" : "log_only")
    ).trim().toLowerCase(),
    allowlist: parseList(process.env.MAIL_ALLOWLIST || process.env.CONTROL_MAIL_ALLOWLIST || "").map((email) => email.toLowerCase()),
    fromName: String(process.env.MAIL_FROM_NAME || process.env.CONTROL_MAIL_FROM_NAME || "Navigrader Support").trim() || "Navigrader Support",
    fromEmail: String(process.env.MAIL_FROM_EMAIL || process.env.CONTROL_MAIL_FROM_EMAIL || "support@navigrader.com").trim().toLowerCase(),
    replyToEmail: String(process.env.MAIL_REPLY_TO_EMAIL || process.env.CONTROL_MAIL_REPLY_TO_EMAIL || process.env.MAIL_FROM_EMAIL || process.env.CONTROL_MAIL_FROM_EMAIL || "support@navigrader.com").trim().toLowerCase(),
    supportEmail: String(process.env.MAIL_SUPPORT_EMAIL || process.env.CONTROL_MAIL_SUPPORT_EMAIL || process.env.MAIL_REPLY_TO_EMAIL || process.env.CONTROL_MAIL_REPLY_TO_EMAIL || process.env.MAIL_FROM_EMAIL || process.env.CONTROL_MAIL_FROM_EMAIL || "support@navigrader.com").trim().toLowerCase(),
    environmentLabel: String(process.env.MAIL_ENVIRONMENT_LABEL || process.env.CONTROL_MAIL_ENVIRONMENT_LABEL || process.env.APP_ENV || "Hosted").trim(),
    postmarkServerName: String(process.env.MAIL_POSTMARK_SERVER_NAME || process.env.CONTROL_MAIL_POSTMARK_SERVER_NAME || "").trim(),
    postmarkServerToken: String(process.env.MAIL_POSTMARK_SERVER_TOKEN || process.env.CONTROL_MAIL_POSTMARK_SERVER_TOKEN || "").trim(),
    postmarkMessageStream: String(process.env.MAIL_POSTMARK_MESSAGE_STREAM || process.env.CONTROL_MAIL_POSTMARK_MESSAGE_STREAM || "").trim(),
    requestTimeoutMs: Number(process.env.MAIL_REQUEST_TIMEOUT_MS || process.env.CONTROL_MAIL_REQUEST_TIMEOUT_MS || 10000)
  },
  db: (() => {
    const rawServer = process.env.MSSQL_SERVER || "localhost\\SQLEXPRESS";
    const split = rawServer.split("\\");
    const server = split[0] || "localhost";
    const instanceName = split.length > 1 ? split.slice(1).join("\\") : "";
    const portValue = process.env.MSSQL_PORT || "";

    const config = {
      server,
      database: process.env.MSSQL_DATABASE || "HomeSchoolManagement",
      user: process.env.MSSQL_USER || "sa",
      password: process.env.MSSQL_PASSWORD || "",
      options: {
        encrypt: toBool(process.env.MSSQL_ENCRYPT, false),
        trustServerCertificate: toBool(process.env.MSSQL_TRUST_SERVER_CERTIFICATE, true)
      }
    };

    if (instanceName) {
      config.options.instanceName = instanceName;
      if (portValue) config.port = Number(portValue);
    } else {
      config.port = Number(portValue || 1433);
    }
    return config;
  })(),
  postgres: {
    host: process.env.PGHOST || "127.0.0.1",
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || "appdb",
    user: process.env.PGUSER || "appuser",
    password: process.env.PGPASSWORD || "",
    ssl: (() => {
      const mode = String(process.env.PGSSLMODE || "disable").toLowerCase();
      if (mode === "disable") return false;
      return { rejectUnauthorized: mode === "verify-full" };
    })()
  },
  commercial: {
    tenantId: String(process.env.TENANT_ID || "").trim(),
    tenantEnvironmentId: String(process.env.TENANT_ENVIRONMENT_ID || "").trim(),
    controlSchema: String(process.env.CONTROL_COMMERCIAL_SCHEMA || "hsm_control_staging").trim() || "hsm_control_staging"
  }
};
