const express = require("express");
const { app: appConfig, automation: automationConfig, internal: internalConfig, session: sessionConfig } = require("./config");
const {
  appendProvisioningJobEvent,
  claimNextProvisioningJob,
  completeProvisionEnvironmentJob,
  completeSetupTokenJob,
  countOperators,
  createBootstrapOperator,
  createOperatorSession,
  createTenant,
  createTenantEnvironment,
  getOperatorByUsername,
  getOperatorSessionByTokenHash,
  getProvisioningJobById,
  getTenantById,
  getTenantEnvironmentById,
  listSetupSyncCandidates,
  listProvisioningJobEvents,
  listProvisioningJobs,
  listTenantEnvironments,
  listTenants,
  markProvisioningJobFailed,
  markTenantEnvironmentInitialized,
  queueProvisioningJob,
  resolveTenantRuntimeByHost,
  revokeOperatorSessionByTokenHash,
  updateOperatorLastLogin,
  updateTenant
} = require("./postgres-operator-store");
const { applyCors, createOperatorAuthContextMiddleware } = require("./middleware/auth-context");
const { errorHandler } = require("./middleware/error-handler");
const { registerEnvironmentRoutes } = require("./routes/environment-routes");
const { registerInfraRoutes } = require("./routes/infra-routes");
const { registerJobRoutes } = require("./routes/job-routes");
const { registerOperatorAuthRoutes } = require("./routes/operator-auth-routes");
const { registerRuntimeRoutes } = require("./routes/runtime-routes");
const { registerTenantRoutes } = require("./routes/tenant-routes");
const { startProvisioningWorker } = require("./provisioning-worker");
const { createTenantRuntimeAutomation } = require("./tenant-runtime-automation");
const { createSetupSyncService } = require("./setup-sync");

const app = express();
const runtimeAutomation = createTenantRuntimeAutomation(automationConfig);
const setupSyncService = createSetupSyncService({
  listSetupSyncCandidates,
  markTenantEnvironmentInitialized,
  timeoutMs: automationConfig.setupSyncRequestTimeoutMs
});

applyCors(app, appConfig);
app.use(express.json({ limit: "1mb" }));
app.use(createOperatorAuthContextMiddleware({
  getOperatorSessionByTokenHash,
  sessionConfig
}));

registerInfraRoutes(app);
registerOperatorAuthRoutes(app, {
  countOperators,
  createBootstrapOperator,
  createOperatorSession,
  getOperatorByUsername,
  revokeOperatorSessionByTokenHash,
  sessionConfig,
  updateOperatorLastLogin
});
registerRuntimeRoutes(app, {
  internalConfig,
  resolveTenantRuntimeByHost
});
registerTenantRoutes(app, {
  createTenant,
  getTenantById,
  listTenants,
  updateTenant
});
registerEnvironmentRoutes(app, {
  createTenantEnvironment,
  getTenantEnvironmentById,
  listTenantEnvironments,
  syncTenantEnvironmentSetup: (environment) => setupSyncService.syncEnvironment(environment),
  queueProvisioningJob
});
registerJobRoutes(app, {
  getProvisioningJobById,
  listProvisioningJobEvents,
  listProvisioningJobs
});

app.use(errorHandler);

async function executeProvisioningJob(job) {
  try {
    if (job.jobType === "provision_environment") {
      const environment = await getTenantEnvironmentById(job.tenantEnvironmentId);
      if (!environment) {
        throw Object.assign(new Error("Environment not found for provisioning job."), { code: "environment_not_found" });
      }
      const automationResult = await runtimeAutomation.provisionEnvironment(environment, job.payload || {});
      await completeProvisionEnvironmentJob(job, automationResult);
      return;
    }
    if (job.jobType === "issue_setup_token") {
      const environment = await getTenantEnvironmentById(job.tenantEnvironmentId);
      if (!environment) {
        throw Object.assign(new Error("Environment not found for setup-token job."), { code: "environment_not_found" });
      }
      const automationResult = await runtimeAutomation.issueSetupToken(environment);
      await completeSetupTokenJob(job, automationResult);
      return;
    }

    await appendProvisioningJobEvent(job.id, "skipped", "No execution handler implemented for job type.", {
      jobType: job.jobType
    });
    await markProvisioningJobFailed(job.id, "job_type_not_implemented", `No execution handler is implemented for ${job.jobType}.`, {
      jobType: job.jobType
    });
  } catch (error) {
    await appendProvisioningJobEvent(job.id, "failed", error.message, {
      jobType: job.jobType
    });
    await markProvisioningJobFailed(job.id, error.code || "execution_failed", error.message, {
      jobType: job.jobType
    });
  }
}

app.listen(appConfig.port, () => {
  console.log(`Control API listening on port ${appConfig.port}`);
  startProvisioningWorker({
    enabled: internalConfig.workerEnabled,
    pollIntervalMs: internalConfig.workerPollMs,
    claimNextProvisioningJob,
    reconcilePendingSetups: automationConfig.setupSyncEnabled ? () => setupSyncService.reconcilePendingSetups() : null,
    executeProvisioningJob
  });
});
