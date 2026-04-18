const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function toBool(value, fallback) {
  if (value == null || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}

function normalizeServiceScope(value, fallback = "system") {
  const normalized = String(value || fallback).trim().toLowerCase();
  return normalized === "user" ? "user" : "system";
}

function parseAliasMap(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((acc, entry) => {
      const [rawKey, ...rest] = entry.split("=");
      const key = String(rawKey || "").trim().toLowerCase();
      const mapped = rest.join("=").trim();
      if (key && mapped) {
        acc[key] = mapped;
      }
      return acc;
    }, {});
}

module.exports = {
  app: {
    env: process.env.CONTROL_APP_ENV || process.env.APP_ENV || "development",
    port: Number(process.env.CONTROL_APP_PORT || 3100),
    corsOrigin: process.env.CONTROL_APP_CORS_ORIGIN || "*"
  },
  internal: {
    apiKey: process.env.CONTROL_INTERNAL_API_KEY || "",
    serviceAuthSecret: process.env.CONTROL_INTERNAL_AUTH_SECRET || "",
    serviceAuthIssuer: String(process.env.CONTROL_INTERNAL_AUTH_ISSUER || "control-plane").trim() || "control-plane",
    tenantRuntimeAudience: String(process.env.CONTROL_INTERNAL_TENANT_RUNTIME_AUDIENCE || "tenant-runtime-internal").trim() || "tenant-runtime-internal",
    runtimeResolveAudience: String(process.env.CONTROL_INTERNAL_RUNTIME_RESOLVE_AUDIENCE || "control-plane-internal").trim() || "control-plane-internal",
    serviceAuthTtlSeconds: Number(process.env.CONTROL_INTERNAL_AUTH_TTL_SECONDS || 120),
    serviceAuthClockSkewSeconds: Number(process.env.CONTROL_INTERNAL_AUTH_CLOCK_SKEW_SECONDS || 30),
    allowLegacyApiKey: toBool(process.env.CONTROL_INTERNAL_ALLOW_LEGACY_API_KEY, true),
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
    deploymentEnabled: toBool(process.env.CONTROL_DEPLOYMENT_ENABLED, false),
    sshBin: process.env.CONTROL_DEPLOY_SSH_BIN || "ssh",
    scpBin: process.env.CONTROL_DEPLOY_SCP_BIN || "scp",
    sshUser: process.env.CONTROL_DEPLOY_SSH_USER || "debian",
    sshPort: Number(process.env.CONTROL_DEPLOY_SSH_PORT || 22),
    sshConnectTimeoutSeconds: Number(process.env.CONTROL_DEPLOY_SSH_CONNECT_TIMEOUT_SECONDS || 10),
    localHosts: String(process.env.CONTROL_DEPLOY_LOCAL_HOSTS || "127.0.0.1,localhost")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
    hostAliases: parseAliasMap(process.env.CONTROL_HOST_ALIASES || ""),
    appSourceDir: process.env.CONTROL_DEPLOY_APP_SOURCE_DIR || path.resolve(__dirname, "../../server"),
    appDeployDir: process.env.CONTROL_DEPLOY_APP_DIR || "/home/debian/apps/home-school-management/server",
    appRuntimeEnvFilename: process.env.CONTROL_DEPLOY_APP_RUNTIME_ENV_FILENAME || ".env.runtime",
    appServiceName: process.env.CONTROL_DEPLOY_APP_SERVICE || "hsm-api.service",
    appServiceScope: normalizeServiceScope(process.env.CONTROL_DEPLOY_APP_SERVICE_SCOPE || "system"),
    appServiceUseSudo: toBool(process.env.CONTROL_DEPLOY_APP_SERVICE_USE_SUDO, true),
    appHealthCheckUrl: process.env.CONTROL_DEPLOY_APP_HEALTH_URL || "http://127.0.0.1:3000/health",
    webSourceDir: process.env.CONTROL_DEPLOY_WEB_SOURCE_DIR || path.resolve(__dirname, "../../web"),
    webDeployDir: process.env.CONTROL_DEPLOY_WEB_DIR || "/var/www/home-school-management/web",
    webDeployUseSudo: toBool(process.env.CONTROL_DEPLOY_WEB_USE_SUDO, true),
    webHealthCheckUrl: process.env.CONTROL_DEPLOY_WEB_HEALTH_URL || "http://127.0.0.1/health",
    healthCheckRetries: Number(process.env.CONTROL_DEPLOY_HEALTH_RETRIES || 10),
    healthCheckDelayMs: Number(process.env.CONTROL_DEPLOY_HEALTH_DELAY_MS || 2000),
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
  stripe: {
    secretKey: String(process.env.STRIPE_SECRET_KEY || "").trim(),
    publishableKey: String(process.env.STRIPE_PUBLISHABLE_KEY || "").trim(),
    webhookSecret: String(process.env.STRIPE_WEBHOOK_SECRET || "").trim()
  },
  public: {
    appBaseUrl: String(process.env.PUBLIC_APP_BASE_URL || process.env.CONTROL_APP_CORS_ORIGIN || "").trim(),
    signupStatusBaseUrl: String(process.env.PUBLIC_SIGNUP_STATUS_BASE_URL || process.env.PUBLIC_APP_BASE_URL || process.env.CONTROL_APP_CORS_ORIGIN || "").trim(),
    defaultDomainSuffix: String(process.env.PUBLIC_DEFAULT_DOMAIN_SUFFIX || "").trim(),
    checkoutSuccessUrl: String(process.env.PUBLIC_CHECKOUT_SUCCESS_URL || "").trim(),
    checkoutCancelUrl: String(process.env.PUBLIC_CHECKOUT_CANCEL_URL || "").trim()
  },
  commercialProvisioning: {
    environmentKey: String(process.env.CONTROL_COMMERCIAL_ENVIRONMENT_KEY || "production").trim() || "production",
    environmentDisplayName: String(process.env.CONTROL_COMMERCIAL_ENVIRONMENT_DISPLAY_NAME || "Production").trim() || "Production",
    appHost: String(process.env.CONTROL_COMMERCIAL_DEFAULT_APP_HOST || "").trim(),
    webHost: String(process.env.CONTROL_COMMERCIAL_DEFAULT_WEB_HOST || "").trim(),
    databaseHost: String(process.env.CONTROL_COMMERCIAL_DEFAULT_DATABASE_HOST || "").trim(),
    databaseName: String(process.env.CONTROL_COMMERCIAL_DEFAULT_DATABASE_NAME || "").trim(),
    defaultTenantStatus: String(process.env.CONTROL_COMMERCIAL_DEFAULT_TENANT_STATUS || "provisioning").trim().toLowerCase() || "provisioning",
    defaultEnvironmentStatus: String(process.env.CONTROL_COMMERCIAL_DEFAULT_ENVIRONMENT_STATUS || "provisioning").trim().toLowerCase() || "provisioning",
    setupTokenTtlHours: Number(process.env.CONTROL_COMMERCIAL_SETUP_TOKEN_TTL_HOURS || 24),
    provisioningJobMaxAttempts: Number(process.env.CONTROL_COMMERCIAL_PROVISIONING_JOB_MAX_ATTEMPTS || 3),
    setupTokenJobMaxAttempts: Number(process.env.CONTROL_COMMERCIAL_SETUP_TOKEN_JOB_MAX_ATTEMPTS || 3)
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
