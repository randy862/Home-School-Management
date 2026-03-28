const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function toBool(value, fallback) {
  if (value == null || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}

module.exports = {
  app: {
    env: process.env.APP_ENV || "development",
    port: Number(process.env.APP_PORT || 3000),
    corsOrigin: process.env.APP_CORS_ORIGIN || "*",
    dbClient: String(process.env.DB_CLIENT || "mssql").toLowerCase()
  },
  session: {
    cookieName: process.env.SESSION_COOKIE_NAME || "hsm_session",
    cookieSecure: toBool(process.env.SESSION_COOKIE_SECURE, false),
    cookieSameSite: process.env.SESSION_COOKIE_SAMESITE || "Lax",
    ttlHours: Number(process.env.SESSION_TTL_HOURS || 168)
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
  }
};
