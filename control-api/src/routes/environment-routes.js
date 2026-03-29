const { randomUUID } = require("crypto");
const { ensureAuthenticated, ensurePlatformAdmin } = require("./route-auth");

function registerEnvironmentRoutes(app, deps) {
  const {
    createTenantEnvironment,
    getTenantEnvironmentById,
    listTenantEnvironments,
    syncTenantEnvironmentSetup,
    queueProvisioningJob
  } = deps;

  app.get("/api/control/environments", async (req, res) => {
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await listTenantEnvironments());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/control/environments/:id", async (req, res) => {
    if (!ensureAuthenticated(req, res)) return;

    try {
      const environment = await getTenantEnvironmentById(req.params.id);
      if (!environment) {
        res.status(404).json({ error: "Environment not found." });
        return;
      }
      res.json(environment);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/control/tenants/:id/environments", async (req, res) => {
    if (!ensurePlatformAdmin(req, res)) return;

    try {
      const environment = await createTenantEnvironment(normalizeCreateEnvironmentPayload(req.body, req.params.id), {
        operatorUserId: req.auth.user.id
      });
      res.status(201).json(environment);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.post("/api/control/environments/:id/provision", async (req, res) => {
    if (!ensurePlatformAdmin(req, res)) return;

    try {
      const job = await queueProvisioningJob(normalizeProvisionJobPayload(req.body, req.params.id), {
        operatorUserId: req.auth.user.id
      });
      res.status(201).json(job);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.post("/api/control/environments/:id/setup-token", async (req, res) => {
    if (!ensurePlatformAdmin(req, res)) return;

    try {
      const job = await queueProvisioningJob(normalizeSetupTokenJobPayload(req.body, req.params.id), {
        operatorUserId: req.auth.user.id
      });
      res.status(201).json(job);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.post("/api/control/environments/:id/sync-setup", async (req, res) => {
    if (!ensurePlatformAdmin(req, res)) return;

    try {
      const environment = await getTenantEnvironmentById(req.params.id);
      if (!environment) {
        res.status(404).json({ error: "Environment not found." });
        return;
      }

      const result = await syncTenantEnvironmentSetup(environment);
      res.json(result);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });
}

function normalizeCreateEnvironmentPayload(input, tenantId) {
  const environmentKey = String(input?.environmentKey || "").trim().toLowerCase();
  const displayName = String(input?.displayName || "").trim();
  const status = input?.status === "ready" ? "ready" : "pending";
  const appBaseUrl = String(input?.appBaseUrl || "").trim();
  const appHost = String(input?.appHost || "").trim();
  const webHost = String(input?.webHost || "").trim();
  const databaseHost = String(input?.databaseHost || "").trim();
  const databaseName = String(input?.databaseName || "").trim();
  const databaseSchema = String(input?.databaseSchema || "").trim();

  if (!tenantId) {
    const error = new Error("Tenant id is required.");
    error.statusCode = 400;
    throw error;
  }
  if (!/^[a-z0-9-]{2,32}$/.test(environmentKey)) {
    const error = new Error("Environment key must be 2-32 characters using lowercase letters, numbers, or hyphens.");
    error.statusCode = 400;
    throw error;
  }
  if (!displayName) {
    const error = new Error("Environment display name is required.");
    error.statusCode = 400;
    throw error;
  }

  return {
    id: `env-${randomUUID()}`,
    tenantId,
    environmentKey,
    displayName,
    status,
    appBaseUrl,
    appHost,
    webHost,
    databaseHost,
    databaseName,
    databaseSchema
  };
}

function normalizeProvisionJobPayload(input, tenantEnvironmentId) {
  const tenantId = String(input?.tenantId || "").trim() || null;
  const releaseVersion = String(input?.releaseVersion || "").trim();
  const appBaseUrl = String(input?.appBaseUrl || "").trim();
  const appHost = String(input?.appHost || "").trim();
  const webHost = String(input?.webHost || "").trim();
  const databaseHost = String(input?.databaseHost || "").trim();
  const databaseName = String(input?.databaseName || "").trim();
  const databaseSchema = String(input?.databaseSchema || "").trim();
  const idempotencyKey = String(input?.idempotencyKey || "").trim();

  if (!tenantEnvironmentId) {
    const error = new Error("Environment id is required.");
    error.statusCode = 400;
    throw error;
  }

  return {
    id: `job-${randomUUID()}`,
    tenantId,
    tenantEnvironmentId,
    jobType: "provision_environment",
    idempotencyKey: idempotencyKey || null,
    message: "Provision environment queued",
    payload: {
      releaseVersion,
      appBaseUrl,
      appHost,
      webHost,
      databaseHost,
      databaseName,
      databaseSchema
    }
  };
}

function normalizeSetupTokenJobPayload(input, tenantEnvironmentId) {
  const tenantId = String(input?.tenantId || "").trim() || null;
  const ttlHoursRaw = input?.ttlHours;
  const ttlHours = ttlHoursRaw == null || ttlHoursRaw === "" ? 2 : Number(ttlHoursRaw);
  const deliveredVia = String(input?.deliveredVia || "operator_console").trim() || "operator_console";
  const notes = String(input?.notes || "").trim();
  const idempotencyKey = String(input?.idempotencyKey || "").trim();

  if (!tenantEnvironmentId) {
    const error = new Error("Environment id is required.");
    error.statusCode = 400;
    throw error;
  }
  if (!Number.isFinite(ttlHours) || ttlHours <= 0 || ttlHours > 48) {
    const error = new Error("Setup token TTL must be between 1 and 48 hours.");
    error.statusCode = 400;
    throw error;
  }

  return {
    id: `job-${randomUUID()}`,
    tenantId,
    tenantEnvironmentId,
    jobType: "issue_setup_token",
    idempotencyKey: idempotencyKey || null,
    message: "Issue setup token queued",
    deliveredVia,
    notes,
    expiresAt: new Date(Date.now() + (ttlHours * 60 * 60 * 1000)),
    payload: {
      ttlHours,
      deliveredVia,
      notes
    }
  };
}

module.exports = {
  registerEnvironmentRoutes
};
