const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function toBool(value, fallback) {
  if (value == null || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}

module.exports = {
  app: {
    port: Number(process.env.APP_PORT || 3000)
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
  })()
};
