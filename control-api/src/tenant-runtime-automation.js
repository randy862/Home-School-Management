const fs = require("fs/promises");
const path = require("path");
const { spawn } = require("child_process");
const os = require("os");
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

      let deployment = {
        enabled: Boolean(config.deploymentEnabled),
        app: { attempted: false, skipped: true, reason: "deployment_disabled" },
        web: { attempted: false, skipped: true, reason: "deployment_disabled" }
      };
      if (config.deploymentEnabled) {
        deployment = await deployEnvironmentRelease(config, environment, bundlePath);
      }

      return {
        bundlePath,
        databaseHost: dbConfig.host,
        databaseName: dbConfig.database,
        databaseSchema: schemaName,
        deployment
      };
    },

    async deployRelease(environment, payload = {}) {
      const dbConfig = buildTenantDbConfig(config, environment);
      const bundlePath = path.join(runtimeBundleDir, `${environment.id}.env`);
      const bundleContents = buildRuntimeBundle(environment, dbConfig, payload);
      await fs.mkdir(runtimeBundleDir, { recursive: true });
      await fs.writeFile(bundlePath, bundleContents, { encoding: "utf8", mode: 0o600 });

      let deployment = {
        enabled: Boolean(config.deploymentEnabled),
        app: { attempted: false, skipped: true, reason: "deployment_disabled" },
        web: { attempted: false, skipped: true, reason: "deployment_disabled" }
      };
      if (config.deploymentEnabled) {
        deployment = await deployEnvironmentRelease(config, environment, bundlePath);
      }

      return {
        bundlePath,
        databaseHost: dbConfig.host,
        databaseName: dbConfig.database,
        databaseSchema: dbConfig.schema,
        deployment
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
        token: parsed.token,
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
    host: resolveConfiguredHost(config, environment.databaseHost),
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
    `PGOPTIONS="-c search_path=${dbConfig.schema}"`,
    `TENANT_ID=${environment.tenantId}`,
    `TENANT_ENVIRONMENT_ID=${environment.id}`,
    `TENANT_ENVIRONMENT_KEY=${environment.environmentKey}`,
    `TENANT_APP_BASE_URL=${environment.appBaseUrl || ""}`,
    `TENANT_RELEASE_VERSION=${payload.releaseVersion || ""}`
  ];
  return `${lines.join("\n")}\n`;
}

async function deployEnvironmentRelease(config, environment, bundlePath) {
  const deployment = {
    enabled: true,
    app: { attempted: false, skipped: true, reason: "app_host_not_configured" },
    web: { attempted: false, skipped: true, reason: "web_host_not_configured" }
  };

  if (environment.appHost) {
    deployment.app = await deployAppRelease(config, environment, bundlePath);
  }
  if (environment.webHost) {
    deployment.web = await deployWebRelease(config, environment);
  }

  return deployment;
}

async function deployAppRelease(config, environment, bundlePath) {
  const host = String(environment.appHost || "").trim();
  if (!host) {
    return { attempted: false, skipped: true, reason: "app_host_not_configured" };
  }
  const resolvedHost = resolveConfiguredHost(config, host);

  if (isLocalHost(config, resolvedHost) || isLocalHost(config, host)) {
    await fs.mkdir(config.appDeployDir, { recursive: true });
    const sourceEqualsDeployDir = samePath(config.appSourceDir, config.appDeployDir);
    if (!sourceEqualsDeployDir) {
      await copyDirectoryContents(config.appSourceDir, config.appDeployDir, {
        exclude: new Set(["node_modules", ".git"])
      });
    }
    await fs.copyFile(bundlePath, path.join(config.appDeployDir, config.appRuntimeEnvFilename));
    await restartLocalService(config, config.appServiceName);
    await waitForCommand("curl", ["-fsS", config.appHealthCheckUrl], config);
    return {
      attempted: true,
      method: "local",
      host,
      resolvedHost,
      sourceCopySkipped: sourceEqualsDeployDir,
      deployDir: config.appDeployDir,
      runtimeEnvPath: path.posix.join(config.appDeployDir, config.appRuntimeEnvFilename),
      serviceName: config.appServiceName,
      healthCheckUrl: config.appHealthCheckUrl
    };
  }

  const sshTarget = buildSshTarget(config, resolvedHost);
  await verifySshAccess(config, sshTarget);
  await runCommand(config.sshBin, buildSshArgs(config, sshTarget, `mkdir -p ${quoteShellArg(config.appDeployDir)}`));
  await copyDirectoryViaScp(config, config.appSourceDir, `${sshTarget}:${config.appDeployDir}`);
  await copyFileViaScp(config, bundlePath, `${sshTarget}:${path.posix.join(config.appDeployDir, config.appRuntimeEnvFilename)}`);
  await runCommand(config.sshBin, buildSshArgs(config, sshTarget, buildRemoteRestartCommand(config, config.appServiceName)));
  await waitForCommand(config.sshBin, buildSshArgs(config, sshTarget, `curl -fsS ${quoteShellArg(config.appHealthCheckUrl)}`), config);
  return {
    attempted: true,
    method: "ssh",
    host,
    resolvedHost,
    sshTarget,
    deployDir: config.appDeployDir,
    runtimeEnvPath: path.posix.join(config.appDeployDir, config.appRuntimeEnvFilename),
    serviceName: config.appServiceName,
    healthCheckUrl: config.appHealthCheckUrl
  };
}

async function deployWebRelease(config, environment) {
  const host = String(environment.webHost || "").trim();
  if (!host) {
    return { attempted: false, skipped: true, reason: "web_host_not_configured" };
  }
  const resolvedHost = resolveConfiguredHost(config, host);

  const sshTarget = buildSshTarget(config, resolvedHost);
  await verifySshAccess(config, sshTarget);
  await runCommand(config.sshBin, buildSshArgs(config, sshTarget, `mkdir -p ${quoteShellArg(config.webDeployDir)}`));
  await copyDirectoryViaScp(config, config.webSourceDir, `${sshTarget}:${config.webDeployDir}`);
  await waitForCommand(config.sshBin, buildSshArgs(config, sshTarget, `curl -fsS ${quoteShellArg(config.webHealthCheckUrl)}`), config);
  return {
    attempted: true,
    method: "ssh",
    host,
    resolvedHost,
    sshTarget,
    deployDir: config.webDeployDir,
    healthCheckUrl: config.webHealthCheckUrl
  };
}

function isLocalHost(config, host) {
  const normalized = String(host || "").trim().toLowerCase();
  if (!normalized) return false;

  const hostnames = new Set([
    ...normalizeHostList(config.localHosts || []),
    normalizeHostname(os.hostname())
  ]);
  return hostnames.has(normalized);
}

function buildSshTarget(config, host) {
  if (String(host).includes("@")) return host;
  return `${config.sshUser}@${host}`;
}

async function verifySshAccess(config, sshTarget) {
  await runCommand(config.sshBin, buildSshArgs(config, sshTarget, "true"));
}

function buildSshArgs(config, sshTarget, remoteCommand) {
  return [
    "-o",
    "BatchMode=yes",
    "-o",
    `ConnectTimeout=${config.sshConnectTimeoutSeconds}`,
    "-p",
    String(config.sshPort),
    sshTarget,
    remoteCommand
  ];
}

async function copyFileViaScp(config, sourcePath, destination) {
  await runCommand(config.scpBin, [
    "-B",
    "-P",
    String(config.sshPort),
    sourcePath,
    destination
  ]);
}

async function copyDirectoryViaScp(config, sourceDir, destination) {
  const entries = await fs.readdir(sourceDir);
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".git") continue;
    await runCommand(config.scpBin, [
      "-B",
      "-P",
      String(config.sshPort),
      "-r",
      path.join(sourceDir, entry),
      destination
    ]);
  }
}

async function copyDirectoryContents(sourceDir, targetDir, options = {}) {
  const exclude = options.exclude || new Set();
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (exclude.has(entry.name)) continue;
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await fs.mkdir(targetPath, { recursive: true });
      await copyDirectoryContents(sourcePath, targetPath, options);
      continue;
    }
    if (entry.isFile()) {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
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

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      env: {
        ...process.env,
        ...(options.env || {})
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
      reject(new Error((stderr || stdout || `${command} exited with code ${code}`).trim()));
    });
  });
}

async function waitForCommand(command, args, config) {
  const retries = Number(config.healthCheckRetries || 1);
  const delayMs = Number(config.healthCheckDelayMs || 0);
  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await runCommand(command, args);
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
      await sleep(delayMs);
    }
  }
  throw lastError || new Error("Command retry failed.");
}

async function restartLocalService(config, serviceName) {
  const useSudo = Boolean(config.appServiceUseSudo);
  const scope = String(config.appServiceScope || "system").toLowerCase();
  const command = useSudo ? "sudo" : "systemctl";
  const args = useSudo ? ["systemctl"] : [];
  if (scope === "user") {
    args.push("--user");
  }
  args.push("restart", serviceName);
  await runCommand(command, args);
}

function buildRemoteRestartCommand(config, serviceName) {
  const useSudo = Boolean(config.appServiceUseSudo);
  const scope = String(config.appServiceScope || "system").toLowerCase();
  const prefix = useSudo ? "sudo systemctl" : "systemctl";
  const scopeArg = scope === "user" ? " --user" : "";
  return `${prefix}${scopeArg} restart ${quoteShellArg(serviceName)}`;
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

function quoteShellArg(value) {
  return `'${String(value || "").replace(/'/g, `'\"'\"'`)}'`;
}

function normalizeHostname(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeHostList(values) {
  return values.map((value) => normalizeHostname(value)).filter(Boolean);
}

function samePath(left, right) {
  return path.resolve(String(left || "")) === path.resolve(String(right || ""));
}

function resolveConfiguredHost(config, host) {
  const normalized = normalizeHostname(host);
  return config.hostAliases?.[normalized] || host;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

module.exports = {
  createTenantRuntimeAutomation
};
