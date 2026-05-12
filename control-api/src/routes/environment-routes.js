const { randomUUID } = require("crypto");
const { ensureAuthenticated, ensurePermission, sendRouteError } = require("./route-auth");

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
      sendRouteError(res, error);
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
      sendRouteError(res, error);
    }
  });

  app.post("/api/control/tenants/:id/environments", async (req, res) => {
    if (!ensurePermission(req, res, "manageEnvironments", "Manage Environments permission required")) return;

    try {
      const environment = await createTenantEnvironment(normalizeCreateEnvironmentPayload(req.body, req.params.id), {
        operatorUserId: req.auth.user.id
      });
      res.status(201).json(environment);
    } catch (error) {
      sendRouteError(res, error);
    }
  });

  app.post("/api/control/environments/:id/provision", async (req, res) => {
    if (!ensurePermission(req, res, "manageOperations", "Manage Operations permission required")) return;

    try {
      const environment = await requireEnvironment(getTenantEnvironmentById, req.params.id, res);
      if (!environment) return;
      const job = await queueProvisioningJob(normalizeProvisionJobPayload(req.body, environment), {
        operatorUserId: req.auth.user.id
      });
      res.status(201).json(job);
    } catch (error) {
      sendRouteError(res, error);
    }
  });

  app.post("/api/control/environments/:id/deploy-release", async (req, res) => {
    if (!ensurePermission(req, res, "manageOperations", "Manage Operations permission required")) return;

    try {
      const environment = await requireEnvironment(getTenantEnvironmentById, req.params.id, res);
      if (!environment) return;
      const job = await queueProvisioningJob(normalizeDeployReleaseJobPayload(req.body, environment), {
        operatorUserId: req.auth.user.id
      });
      res.status(201).json(job);
    } catch (error) {
      sendRouteError(res, error);
    }
  });

  app.post("/api/control/environments/:id/setup-token", async (req, res) => {
    if (!ensurePermission(req, res, "manageOperations", "Manage Operations permission required")) return;

    try {
      const environment = await requireEnvironment(getTenantEnvironmentById, req.params.id, res);
      if (!environment) return;
      const job = await queueProvisioningJob(normalizeSetupTokenJobPayload(req.body, environment), {
        operatorUserId: req.auth.user.id
      });
      res.status(201).json(job);
    } catch (error) {
      sendRouteError(res, error);
    }
  });

  app.post("/api/control/environments/:id/suspend", async (req, res) => {
    if (!ensurePermission(req, res, "manageOperations", "Manage Operations permission required")) return;

    try {
      const environment = await requireEnvironment(getTenantEnvironmentById, req.params.id, res);
      if (!environment) return;
      const job = await queueProvisioningJob(normalizeLifecycleJobPayload(req.body, environment, "suspend_tenant", "Suspend tenant queued"), {
        operatorUserId: req.auth.user.id
      });
      res.status(201).json(job);
    } catch (error) {
      sendRouteError(res, error);
    }
  });

  app.post("/api/control/environments/:id/resume", async (req, res) => {
    if (!ensurePermission(req, res, "manageOperations", "Manage Operations permission required")) return;

    try {
      const environment = await requireEnvironment(getTenantEnvironmentById, req.params.id, res);
      if (!environment) return;
      const job = await queueProvisioningJob(normalizeLifecycleJobPayload(req.body, environment, "resume_tenant", "Resume tenant queued"), {
        operatorUserId: req.auth.user.id
      });
      res.status(201).json(job);
    } catch (error) {
      sendRouteError(res, error);
    }
  });

  app.post("/api/control/environments/:id/decommission", async (req, res) => {
    if (!ensurePermission(req, res, "manageOperations", "Manage Operations permission required")) return;

    try {
      const environment = await requireEnvironment(getTenantEnvironmentById, req.params.id, res);
      if (!environment) return;
      const job = await queueProvisioningJob(normalizeLifecycleJobPayload(req.body, environment, "decommission_tenant", "Decommission tenant queued"), {
        operatorUserId: req.auth.user.id
      });
      res.status(201).json(job);
    } catch (error) {
      sendRouteError(res, error);
    }
  });

  app.post("/api/control/environments/:id/archive-data", async (req, res) => {
    if (!ensurePermission(req, res, "manageOperations", "Manage Operations permission required")) return;

    try {
      const environment = await requireEnvironment(getTenantEnvironmentById, req.params.id, res);
      if (!environment) return;
      const job = await queueProvisioningJob(normalizeArchiveJobPayload(req.body, environment), {
        operatorUserId: req.auth.user.id
      });
      res.status(201).json(job);
    } catch (error) {
      sendRouteError(res, error);
    }
  });

  app.post("/api/control/environments/:id/sync-setup", async (req, res) => {
    if (!ensurePermission(req, res, "manageOperations", "Manage Operations permission required")) return;

    try {
      const environment = await getTenantEnvironmentById(req.params.id);
      if (!environment) {
        res.status(404).json({ error: "Environment not found." });
        return;
      }

      const result = await syncTenantEnvironmentSetup(environment);
      res.json(result);
    } catch (error) {
      sendRouteError(res, error);
    }
  });
}

async function requireEnvironment(getTenantEnvironmentById, id, res) {
  const environment = await getTenantEnvironmentById(id);
  if (environment) return environment;
  res.status(404).json({ error: "Environment not found." });
  return null;
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

function normalizeProvisionJobPayload(input, environment) {
  const tenantEnvironmentId = environment?.id;
  const tenantId = resolveEnvironmentTenantId(input, environment);
  const releaseVersion = String(input?.releaseVersion || "").trim();
  const appBaseUrl = String(input?.appBaseUrl || "").trim();
  const appHost = String(input?.appHost || "").trim();
  const webHost = String(input?.webHost || "").trim();
  const databaseHost = String(input?.databaseHost || "").trim();
  const databaseName = String(input?.databaseName || "").trim();
  const databaseSchema = String(input?.databaseSchema || "").trim();
  const idempotencyKey = String(input?.idempotencyKey || "").trim();
  const maxAttempts = normalizeMaxAttempts(input?.maxAttempts);

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
    maxAttempts,
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

function normalizeSetupTokenJobPayload(input, environment) {
  const tenantEnvironmentId = environment?.id;
  const tenantId = resolveEnvironmentTenantId(input, environment);
  const ttlHoursRaw = input?.ttlHours;
  const ttlHours = ttlHoursRaw == null || ttlHoursRaw === "" ? 2 : Number(ttlHoursRaw);
  const deliveredVia = String(input?.deliveredVia || "operator_console").trim() || "operator_console";
  const notes = String(input?.notes || "").trim();
  const idempotencyKey = String(input?.idempotencyKey || "").trim();
  const maxAttempts = normalizeMaxAttempts(input?.maxAttempts);

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
    maxAttempts,
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

function normalizeDeployReleaseJobPayload(input, environment) {
  const tenantEnvironmentId = environment?.id;
  const tenantId = resolveEnvironmentTenantId(input, environment);
  const releaseVersion = String(input?.releaseVersion || "").trim();
  const appBaseUrl = String(input?.appBaseUrl || "").trim();
  const appHost = String(input?.appHost || "").trim();
  const webHost = String(input?.webHost || "").trim();
  const idempotencyKey = String(input?.idempotencyKey || "").trim();
  const maxAttempts = normalizeMaxAttempts(input?.maxAttempts);

  if (!tenantEnvironmentId) {
    const error = new Error("Environment id is required.");
    error.statusCode = 400;
    throw error;
  }
  if (!releaseVersion) {
    const error = new Error("Release version is required.");
    error.statusCode = 400;
    throw error;
  }

  return {
    id: `job-${randomUUID()}`,
    tenantId,
    tenantEnvironmentId,
    jobType: "deploy_release",
    idempotencyKey: idempotencyKey || null,
    maxAttempts,
    message: "Deploy release queued",
    payload: {
      releaseVersion,
      appBaseUrl,
      appHost,
      webHost
    }
  };
}

function normalizeLifecycleJobPayload(input, environment, jobType, message) {
  const tenantEnvironmentId = environment?.id;
  const tenantId = resolveEnvironmentTenantId(input, environment);
  const idempotencyKey = String(input?.idempotencyKey || "").trim();
  const maxAttempts = normalizeMaxAttempts(input?.maxAttempts);
  const notes = String(input?.notes || "").trim();

  if (!tenantEnvironmentId) {
    const error = new Error("Environment id is required.");
    error.statusCode = 400;
    throw error;
  }

  return {
    id: `job-${randomUUID()}`,
    tenantId,
    tenantEnvironmentId,
    jobType,
    idempotencyKey: idempotencyKey || null,
    maxAttempts,
    message,
    payload: {
      notes
    }
  };
}

function normalizeArchiveJobPayload(input, environment) {
  const tenantEnvironmentId = environment?.id;
  const tenantId = resolveEnvironmentTenantId(input, environment);
  const idempotencyKey = String(input?.idempotencyKey || "").trim();
  const maxAttempts = normalizeMaxAttempts(input?.maxAttempts);
  const notes = String(input?.notes || "").trim();

  if (!tenantEnvironmentId) {
    const error = new Error("Environment id is required.");
    error.statusCode = 400;
    throw error;
  }

  return {
    id: `job-${randomUUID()}`,
    tenantId,
    tenantEnvironmentId,
    jobType: "archive_tenant_data",
    idempotencyKey: idempotencyKey || null,
    maxAttempts,
    message: "Internal tenant archive queued",
    payload: {
      notes
    }
  };
}

function normalizeMaxAttempts(value) {
  const parsed = Number(value || 3);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 10) return 3;
  return Math.floor(parsed);
}

function resolveEnvironmentTenantId(input, environment) {
  const tenantId = String(environment?.tenantId || "").trim();
  const requestedTenantId = String(input?.tenantId || "").trim();
  if (!tenantId) {
    const error = new Error("Environment tenant id is required.");
    error.statusCode = 400;
    throw error;
  }
  if (requestedTenantId && requestedTenantId !== tenantId) {
    const error = new Error("Tenant id does not match environment.");
    error.statusCode = 400;
    throw error;
  }
  return tenantId;
}

module.exports = {
  registerEnvironmentRoutes
};
