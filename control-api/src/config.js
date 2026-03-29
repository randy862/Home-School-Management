const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function toBool(value, fallback) {
  if (value == null || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}

module.exports = {
  app: {
    env: process.env.CONTROL_APP_ENV || process.env.APP_ENV || "development",
    port: Number(process.env.CONTROL_APP_PORT || 3100),
    corsOrigin: process.env.CONTROL_APP_CORS_ORIGIN || "*"
  },
  internal: {
    apiKey: process.env.CONTROL_INTERNAL_API_KEY || "",
    workerEnabled: toBool(process.env.CONTROL_WORKER_ENABLED, true),
    workerPollMs: Number(process.env.CONTROL_WORKER_POLL_MS || 5000)
  },
  automation: {
    repoRoot: process.env.CONTROL_REPO_ROOT || path.resolve(__dirname, "../.."),
    runtimeBundleDir: process.env.CONTROL_RUNTIME_BUNDLE_DIR || path.resolve(__dirname, "../../runtime-bundles"),
    tenantDbUser: process.env.CONTROL_TENANT_PGUSER || process.env.CONTROL_PGUSER || process.env.PGUSER || "appuser",
    tenantDbPassword: process.env.CONTROL_TENANT_PGPASSWORD || process.env.CONTROL_PGPASSWORD || process.env.PGPASSWORD || "",
    tenantDbPort: Number(process.env.CONTROL_TENANT_PGPORT || process.env.CONTROL_PGPORT || process.env.PGPORT || 5432),
    tenantDbSslMode: String(process.env.CONTROL_TENANT_PGSSLMODE || process.env.CONTROL_PGSSLMODE || process.env.PGSSLMODE || "disable").toLowerCase(),
    setupSyncEnabled: toBool(process.env.CONTROL_SETUP_SYNC_ENABLED, true),
    setupSyncPollMs: Number(process.env.CONTROL_SETUP_SYNC_POLL_MS || 15000),
    setupSyncRequestTimeoutMs: Number(process.env.CONTROL_SETUP_SYNC_TIMEOUT_MS || 5000)
  },
  session: {
    cookieName: process.env.CONTROL_SESSION_COOKIE_NAME || "hsm_operator_session",
    cookieSecure: toBool(process.env.CONTROL_SESSION_COOKIE_SECURE, false),
    cookieSameSite: process.env.CONTROL_SESSION_COOKIE_SAMESITE || "Lax",
    ttlHours: Number(process.env.CONTROL_SESSION_TTL_HOURS || 12)
  },
  postgres: {
    host: process.env.CONTROL_PGHOST || process.env.PGHOST || "127.0.0.1",
    port: Number(process.env.CONTROL_PGPORT || process.env.PGPORT || 5432),
    database: process.env.CONTROL_PGDATABASE || "controlplane",
    user: process.env.CONTROL_PGUSER || process.env.PGUSER || "appuser",
    password: process.env.CONTROL_PGPASSWORD || process.env.PGPASSWORD || "",
    ssl: (() => {
      const mode = String(process.env.CONTROL_PGSSLMODE || process.env.PGSSLMODE || "disable").toLowerCase();
      if (mode === "disable") return false;
      return { rejectUnauthorized: mode === "verify-full" };
    })()
  }
};
