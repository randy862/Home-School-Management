const fs = require("fs/promises");
const path = require("path");
const { spawn } = require("child_process");
const { Client } = require("pg");

function createTenantRuntimeAutomation(config) {
  const repoRoot = config.repoRoot;
  const serverDir = path.join(repoRoot, "server");
  const runtimeBundleDir = config.runtimeBundleDir;

  return {
    async provisionEnvironment(environment, payload = {}) {
      const dbConfig = buildTenantDbConfig(config, environment);
      const schemaName = dbConfig.schema;
      await ensureSchemaExists(dbConfig);
      await runServerScript(serverDir, "src/scripts/migrate-postgres.js", buildServerScriptEnv(dbConfig, environment));

      const bundlePath = path.join(runtimeBundleDir, `${environment.id}.env`);
      const bundleContents = buildRuntimeBundle(environment, dbConfig, payload);
      await fs.mkdir(runtimeBundleDir, { recursive: true });
      await fs.writeFile(bundlePath, bundleContents, { encoding: "utf8", mode: 0o600 });

      return {
        bundlePath,
        databaseHost: dbConfig.host,
        databaseName: dbConfig.database,
        databaseSchema: schemaName
      };
    },

    async issueSetupToken(environment) {
      const dbConfig = buildTenantDbConfig(config, environment);
      const { stdout } = await runServerScript(serverDir, "src/scripts/create-setup-token.js", buildServerScriptEnv(dbConfig, environment));
      const parsed = parseSetupTokenOutput(stdout);
      const tokenPath = path.join(runtimeBundleDir, `${environment.id}.setup-token.txt`);
      await fs.mkdir(runtimeBundleDir, { recursive: true });
      await fs.writeFile(tokenPath, `${parsed.token}\n`, { encoding: "utf8", mode: 0o600 });
      return {
        tokenPath,
        expiresAt: parsed.expiresAt
      };
    }
  };
}

function buildTenantDbConfig(config, environment) {
  if (!environment.databaseHost || !environment.databaseName || !environment.databaseSchema) {
    throw new Error("Environment database host, name, and schema are required for tenant runtime automation.");
  }
  return {
    host: environment.databaseHost,
    port: config.tenantDbPort,
    database: environment.databaseName,
    user: config.tenantDbUser,
    password: config.tenantDbPassword,
    ssl: config.tenantDbSslMode === "disable" ? false : { rejectUnauthorized: config.tenantDbSslMode === "verify-full" },
    schema: environment.databaseSchema
  };
}

async function ensureSchemaExists(dbConfig) {
  const client = new Client({
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password,
    ssl: dbConfig.ssl
  });
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${escapeIdentifier(dbConfig.schema)}`);
  } finally {
    await client.end();
  }
}

function buildServerScriptEnv(dbConfig, environment) {
  return {
    DB_CLIENT: "postgres",
    APP_CORS_ORIGIN: environment.appBaseUrl || "",
    PGHOST: dbConfig.host,
    PGPORT: String(dbConfig.port),
    PGDATABASE: dbConfig.database,
    PGUSER: dbConfig.user,
    PGPASSWORD: dbConfig.password,
    PGSSLMODE: dbConfig.ssl ? "require" : "disable",
    PGOPTIONS: `-c search_path=${dbConfig.schema}`
  };
}

function buildRuntimeBundle(environment, dbConfig, payload) {
  const lines = [
    `APP_ENV=production`,
    `DB_CLIENT=postgres`,
    `APP_CORS_ORIGIN=${environment.appBaseUrl || ""}`,
    `PGHOST=${dbConfig.host}`,
    `PGPORT=${dbConfig.port}`,
    `PGDATABASE=${dbConfig.database}`,
    `PGUSER=${dbConfig.user}`,
    `PGPASSWORD=${dbConfig.password}`,
    `PGOPTIONS=-c search_path=${dbConfig.schema}`,
    `TENANT_ID=${environment.tenantId}`,
    `TENANT_ENVIRONMENT_ID=${environment.id}`,
    `TENANT_ENVIRONMENT_KEY=${environment.environmentKey}`,
    `TENANT_APP_BASE_URL=${environment.appBaseUrl || ""}`,
    `TENANT_RELEASE_VERSION=${payload.releaseVersion || ""}`
  ];
  return `${lines.join("\n")}\n`;
}

function runServerScript(serverDir, relativeScriptPath, extraEnv) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [relativeScriptPath], {
      cwd: serverDir,
      env: {
        ...process.env,
        ...extraEnv
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error((stderr || stdout || `Script exited with code ${code}`).trim()));
    });
  });
}

function parseSetupTokenOutput(stdout) {
  const token = stdout.match(/^Token:\s*(.+)$/m)?.[1]?.trim();
  const expiresAt = stdout.match(/^Expires:\s*(.+)$/m)?.[1]?.trim();
  if (!token || !expiresAt) {
    throw new Error("Setup token output could not be parsed.");
  }
  return { token, expiresAt };
}

function escapeIdentifier(value) {
  return `"${String(value || "").replace(/"/g, "\"\"")}"`;
}

module.exports = {
  createTenantRuntimeAutomation
};
