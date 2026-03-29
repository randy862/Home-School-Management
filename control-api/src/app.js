const express = require("express");
const { app: appConfig, automation: automationConfig, internal: internalConfig, session: sessionConfig } = require("./config");
const {
  appendProvisioningJobEvent,
  claimNextProvisioningJob,
  completeDeployReleaseJob,
  completeProvisionEnvironmentJob,
  completeSetupTokenJob,
  completeTenantLifecycleJob,
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
  listOperatorAuditLog,
  listSetupSyncCandidates,
  listProvisioningJobEvents,
  listProvisioningJobs,
  listTenantEnvironments,
  listTenants,
  markProvisioningJobFailed,
  retryProvisioningJob,
  scheduleProvisioningJobRetry,
  markTenantEnvironmentInitialized,
  queueProvisioningJob,
  resolveTenantRuntimeByHost,
  revokeOperatorSessionByTokenHash,
  updateOperatorLastLogin,
  updateTenant
} = require("./postgres-operator-store");
const { applyCors, createOperatorAuthContextMiddleware } = require("./middleware/auth-context");
const { errorHandler } = require("./middleware/error-handler");
const { registerAuditRoutes } = require("./routes/audit-routes");
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
  internalConfig,
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
registerAuditRoutes(app, {
  listOperatorAuditLog
});
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
  listProvisioningJobs,
  retryProvisioningJob
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
    if (job.jobType === "deploy_release") {
      const environment = await getTenantEnvironmentById(job.tenantEnvironmentId);
      if (!environment) {
        throw Object.assign(new Error("Environment not found for deploy-release job."), { code: "environment_not_found" });
      }
      const automationResult = await runtimeAutomation.deployRelease(environment, job.payload || {});
      await completeDeployReleaseJob(job, automationResult);
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
    if (job.jobType === "suspend_tenant" || job.jobType === "resume_tenant" || job.jobType === "decommission_tenant") {
      const environment = await getTenantEnvironmentById(job.tenantEnvironmentId);
      if (!environment) {
        throw Object.assign(new Error("Environment not found for tenant lifecycle job."), { code: "environment_not_found" });
      }
      await completeTenantLifecycleJob(job, environment);
      return;
    }

    await appendProvisioningJobEvent(job.id, "skipped", "No execution handler implemented for job type.", {
      jobType: job.jobType
    });
    await markProvisioningJobFailed(job.id, "job_type_not_implemented", `No execution handler is implemented for ${job.jobType}.`, {
      jobType: job.jobType
    });
  } catch (error) {
    const retryDecision = getRetryDecision(job, error);
    if (retryDecision.shouldRetry) {
      await appendProvisioningJobEvent(job.id, "retry_pending", retryDecision.reason, {
        jobType: job.jobType,
        errorCode: error.code || "execution_failed",
        attemptCount: job.attemptCount || 0,
        maxAttempts: job.maxAttempts || 1,
        retryDelaySeconds: retryDecision.delaySeconds
      });
      await scheduleProvisioningJobRetry(job.id, {
        errorCode: error.code || "execution_failed",
        reason: retryDecision.reason,
        delaySeconds: retryDecision.delaySeconds,
        result: {
          jobType: job.jobType,
          errorCode: error.code || "execution_failed",
          errorMessage: error.message
        }
      });
      return;
    }

    await markProvisioningJobFailed(job.id, error.code || "execution_failed", error.message, {
      jobType: job.jobType,
      attemptCount: job.attemptCount || 0,
      maxAttempts: job.maxAttempts || 1
    });
  }
}

function getRetryDecision(job, error) {
  const attemptCount = Number(job?.attemptCount || 0);
  const maxAttempts = Number(job?.maxAttempts || 1);
  if (attemptCount >= maxAttempts) {
    return { shouldRetry: false };
  }

  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  const transientCodes = new Set(["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EAI_AGAIN", "ENOTFOUND"]);
  const transientMessage = message.includes("timeout")
    || message.includes("temporarily unavailable")
    || message.includes("connection reset")
    || message.includes("no route to host");
  if (!transientCodes.has(code) && !transientMessage) {
    return { shouldRetry: false };
  }

  const delaySeconds = Math.min(30 * Math.max(attemptCount, 1), 300);
  return {
    shouldRetry: true,
    delaySeconds,
    reason: `Transient failure detected (${code || "execution_failed"}); retry ${attemptCount + 1} of ${maxAttempts} scheduled in ${delaySeconds} seconds.`
  };
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
