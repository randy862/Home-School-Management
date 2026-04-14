const express = require("express");
const {
  app: appConfig,
  automation: automationConfig,
  commercialProvisioning: commercialProvisioningConfig,
  internal: internalConfig,
  session: sessionConfig,
  public: publicConfig,
  stripe: stripeConfig
} = require("./config");
const {
  appendProvisioningJobEvent,
  claimNextProvisioningJob,
  completeDeployReleaseJob,
  completeProvisionEnvironmentJob,
  completeSetupTokenJob,
  completeTenantLifecycleJob,
  countOperators,
  createBootstrapOperator,
  createOperatorUser,
  createOperatorSession,
  createTenant,
  createTenantEnvironment,
  getOperatorById,
  getOperatorByUsername,
  getOperatorSessionByTokenHash,
  getProvisioningJobById,
  getTenantById,
  getTenantEnvironmentById,
  listOperators,
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
  updateOperatorUser,
  updateTenant
} = require("./postgres-operator-store");
const {
  createCheckoutCustomerAccount,
  createBillingEvent,
  createCancellationExportRequest,
  createCheckoutSessionRecord,
  createCheckoutSubscription,
  getBillingEventByStripeEventId,
  getCommercialPlanById,
  getCommercialSubscriptionById,
  getCustomerAccountById,
  getAccessHandoffByProvisioningRequestId,
  getCheckoutSessionByStripeSessionId,
  getPublicCommercialPlanByCode,
  getPublicSignupStatusByToken,
  getProvisioningRequestByEnvironmentId,
  getProvisioningRequestByJobId,
  getProvisioningRequestBySubscriptionId,
  getSubscriptionByStripeCheckoutSessionId,
  listCancellationExportRequestsBySubscriptionId,
  listCommercialOverview,
  listPublicCommercialPlans
  ,
  createAccessHandoff,
  createProvisioningRequest,
  markCheckoutSessionCompleted,
  updateAccessHandoffByProvisioningRequestId,
  updateBillingEventProcessing,
  updateCommercialSubscription,
  updateCustomerAccountStatus,
  updateProvisioningRequest,
  updateSubscriptionByStripeCheckoutSessionId
} = require("./postgres-commercial-store");
const { applyCors, createOperatorAuthContextMiddleware } = require("./middleware/auth-context");
const { errorHandler } = require("./middleware/error-handler");
const { registerAuditRoutes } = require("./routes/audit-routes");
const { registerControlCommercialRoutes } = require("./routes/control-commercial-routes");
const { registerEnvironmentRoutes } = require("./routes/environment-routes");
const { registerInfraRoutes } = require("./routes/infra-routes");
const { registerJobRoutes } = require("./routes/job-routes");
const { registerOperatorAuthRoutes } = require("./routes/operator-auth-routes");
const { registerOperatorUserRoutes } = require("./routes/operator-user-routes");
const { registerPublicSaasRoutes } = require("./routes/public-saas-routes");
const { registerRuntimeRoutes } = require("./routes/runtime-routes");
const { registerTenantRoutes } = require("./routes/tenant-routes");
const { processStripeBillingEvent } = require("./services/commercial-webhook-service");
const { createCommercialProvisioningService } = require("./services/commercial-provisioning-service");
const { createStripeService } = require("./services/stripe-service");
const { startProvisioningWorker } = require("./provisioning-worker");
const { createTenantRuntimeAutomation } = require("./tenant-runtime-automation");
const { createSetupSyncService } = require("./setup-sync");

const app = express();
const stripeService = createStripeService(stripeConfig);
const runtimeAutomation = createTenantRuntimeAutomation(automationConfig);
const commercialProvisioningService = createCommercialProvisioningService({
  commercialProvisioningConfig,
  publicConfig,
  createAccessHandoff,
  createProvisioningRequest,
  createTenant,
  createTenantEnvironment,
  getAccessHandoffByProvisioningRequestId,
  getCommercialPlanById,
  getCustomerAccountById,
  getProvisioningRequestByEnvironmentId,
  getProvisioningRequestByJobId,
  getProvisioningRequestBySubscriptionId,
  queueProvisioningJob,
  updateAccessHandoffByProvisioningRequestId,
  updateProvisioningRequest
});
const setupSyncService = createSetupSyncService({
  internalConfig,
  listSetupSyncCandidates,
  markTenantEnvironmentInitialized,
  onEnvironmentInitialized: (environment) => commercialProvisioningService.handleEnvironmentInitialized(environment),
  timeoutMs: automationConfig.setupSyncRequestTimeoutMs
});

applyCors(app, appConfig);
app.use("/api/public/billing/webhook", express.raw({
  type: "application/json",
  limit: "1mb",
  verify: (req, _res, buf) => {
    req.rawBody = Buffer.from(buf);
  }
}));
app.use(express.json({
  limit: "1mb",
  verify: (req, _res, buf) => {
    if (req.originalUrl === "/api/public/billing/webhook") return;
    req.rawBody = Buffer.from(buf);
  }
}));
app.use(createOperatorAuthContextMiddleware({
  getOperatorSessionByTokenHash,
  sessionConfig
}));

registerInfraRoutes(app);
registerPublicSaasRoutes(app, {
  createBillingEvent,
  createCheckoutCustomerAccount,
  createCheckoutSessionRecord,
  createCheckoutSubscription,
  getBillingEventByStripeEventId,
  getCheckoutSessionByStripeSessionId,
  getPublicCommercialPlanByCode,
  getPublicSignupStatusByToken,
  getSubscriptionByStripeCheckoutSessionId,
  listPublicCommercialPlans,
  markCheckoutSessionCompleted,
  processStripeBillingEvent: (event) => processStripeBillingEvent(event, {
    ensureCommercialProvisioningForSubscription: (checkoutSession, subscription) => commercialProvisioningService.ensureProvisioningForSubscription(checkoutSession, subscription),
    createBillingEvent,
    getBillingEventByStripeEventId,
    getCheckoutSessionByStripeSessionId,
    getSubscriptionByStripeCheckoutSessionId,
    markCheckoutSessionCompleted,
    updateBillingEventProcessing,
    updateCustomerAccountStatus,
    updateSubscriptionByStripeCheckoutSessionId
  }),
  publicConfig: {
    ...publicConfig,
    publishableKey: stripeConfig.publishableKey
  },
  stripeService
});
registerAuditRoutes(app, {
  listOperatorAuditLog
});
registerControlCommercialRoutes(app, {
  createCancellationExportRequest,
  getCommercialSubscriptionById,
  listCancellationExportRequestsBySubscriptionId,
  listCommercialOverview
  ,
  updateCommercialSubscription
});
registerOperatorAuthRoutes(app, {
  countOperators,
  createBootstrapOperator,
  createOperatorSession,
  getOperatorById,
  getOperatorByUsername,
  revokeOperatorSessionByTokenHash,
  sessionConfig,
  updateOperatorUser,
  updateOperatorLastLogin
});
registerOperatorUserRoutes(app, {
  createOperatorUser,
  getOperatorById,
  listOperators,
  updateOperatorUser
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
      await commercialProvisioningService.markProvisioningStarted(job);
      const environment = await getTenantEnvironmentById(job.tenantEnvironmentId);
      if (!environment) {
        throw Object.assign(new Error("Environment not found for provisioning job."), { code: "environment_not_found" });
      }
      const automationResult = await runtimeAutomation.provisionEnvironment(environment, job.payload || {});
      const completed = await completeProvisionEnvironmentJob(job, automationResult);
      await commercialProvisioningService.handleProvisioningSucceeded(job, completed?.environment || environment);
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
      await commercialProvisioningService.handleSetupTokenIssued(job, automationResult);
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
    await commercialProvisioningService.handleProvisioningFailed(job, error);
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
