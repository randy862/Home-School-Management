const { randomUUID } = require("crypto");

function createCommercialProvisioningService(deps) {
  const {
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
  } = deps;

  return {
    async ensureProvisioningForSubscription(checkoutSession, subscription) {
      if (!checkoutSession?.customerAccountId || !subscription?.id) {
        const error = new Error("Checkout session and subscription are required to create commercial provisioning.");
        error.statusCode = 500;
        throw error;
      }

      const existing = await getProvisioningRequestBySubscriptionId(subscription.id);
      if (existing) {
        let handoff = await getAccessHandoffByProvisioningRequestId(existing.id);
        if (!handoff) {
          handoff = await createAccessHandoff({
            id: `handoff-${randomUUID()}`,
            customerAccountId: checkoutSession.customerAccountId,
            customerSubscriptionId: subscription.id,
            provisioningRequestId: existing.id,
            signupStatusToken: checkoutSession.successToken,
            tenantUrl: existing.resultAccessUrl || null,
            adminSetupMode: existing.resultSetupTokenIssued ? "setup_token" : "pending",
            deliveryChannel: "signup_status_page"
          });
        }
        return { provisioningRequest: existing, accessHandoff: handoff, duplicate: true };
      }

      const account = await getCustomerAccountById(checkoutSession.customerAccountId);
      if (!account) {
        const error = new Error("Customer account was not found for commercial provisioning.");
        error.statusCode = 500;
        throw error;
      }

      const plan = await getCommercialPlanById(subscription.commercialPlanId || checkoutSession.commercialPlanId);
      if (!plan) {
        const error = new Error("Commercial plan was not found for provisioning.");
        error.statusCode = 500;
        throw error;
      }

      const runtimeConfig = buildRuntimeConfiguration(account, checkoutSession, plan, commercialProvisioningConfig, publicConfig);
      const tenant = await createCommercialTenant(account, plan, runtimeConfig, createTenant);
      const appBaseUrl = buildTenantAppBaseUrl(tenant.primaryDomain, publicConfig.appBaseUrl);
      const databaseSchema = `tenant_${String(tenant.slug || runtimeConfig.tenantSlugBase).replace(/-/g, "_")}`;
      const environment = await createTenantEnvironment({
        id: `env-${randomUUID()}`,
        tenantId: tenant.id,
        environmentKey: runtimeConfig.environmentKey,
        displayName: runtimeConfig.environmentDisplayName,
        status: runtimeConfig.environmentStatus,
        appBaseUrl,
        appHost: runtimeConfig.appHost,
        webHost: runtimeConfig.webHost,
        databaseHost: runtimeConfig.databaseHost,
        databaseName: runtimeConfig.databaseName,
        databaseSchema
      });

      const provisioningJob = await queueProvisioningJob({
        id: `job-${randomUUID()}`,
        tenantId: tenant.id,
        tenantEnvironmentId: environment.id,
        jobType: "provision_environment",
        maxAttempts: runtimeConfig.provisioningJobMaxAttempts,
        idempotencyKey: `commercial-provision:${subscription.id}`,
        payload: {
          source: "commercial_signup",
          customerAccountId: account.id,
          customerSubscriptionId: subscription.id,
          commercialPlanId: plan.id,
          appBaseUrl,
          appHost: runtimeConfig.appHost,
          webHost: runtimeConfig.webHost,
          databaseHost: runtimeConfig.databaseHost,
          databaseName: runtimeConfig.databaseName,
          databaseSchema,
          releaseVersion: `commercial-${runtimeConfig.environmentKey}-${Date.now()}`
        }
      });

      const provisioningRequest = await createProvisioningRequest({
        id: `prov-${randomUUID()}`,
        customerAccountId: account.id,
        customerSubscriptionId: subscription.id,
        commercialPlanId: plan.id,
        status: "queued",
        triggerSource: "stripe_checkout_completed",
        requestedSubdomainLabel: checkoutSession.requestedSubdomainLabel || runtimeConfig.requestedSubdomainLabel,
        tenantId: tenant.id,
        tenantEnvironmentId: environment.id,
        provisioningJobId: provisioningJob.id,
        resultAccessUrl: appBaseUrl,
        resultSetupTokenIssued: false
      });

      const accessHandoff = await createAccessHandoff({
        id: `handoff-${randomUUID()}`,
        customerAccountId: account.id,
        customerSubscriptionId: subscription.id,
        provisioningRequestId: provisioningRequest.id,
        signupStatusToken: checkoutSession.successToken,
        tenantUrl: appBaseUrl,
        adminSetupMode: "pending",
        deliveryChannel: "signup_status_page"
      });

      return { provisioningRequest, accessHandoff, duplicate: false };
    },

    async markProvisioningStarted(job) {
      const provisioningRequest = await getProvisioningRequestByJobId(job.id);
      if (!provisioningRequest) return null;
      return updateProvisioningRequest(provisioningRequest.id, {
        status: "provisioning",
        failureReason: null
      });
    },

    async handleProvisioningSucceeded(job, environment) {
      const provisioningRequest = await getProvisioningRequestByJobId(job.id);
      if (!provisioningRequest) return null;

      await updateProvisioningRequest(provisioningRequest.id, {
        status: "provisioning",
        tenantId: environment?.tenantId || provisioningRequest.tenantId,
        tenantEnvironmentId: environment?.id || provisioningRequest.tenantEnvironmentId,
        resultAccessUrl: environment?.appBaseUrl || provisioningRequest.resultAccessUrl,
        failureReason: null
      });

      const accessHandoff = await updateAccessHandoffByProvisioningRequestId(provisioningRequest.id, {
        tenantUrl: environment?.appBaseUrl || provisioningRequest.resultAccessUrl,
        adminSetupMode: "pending"
      });

      const setupTokenJob = await queueProvisioningJob({
        id: `job-${randomUUID()}`,
        tenantId: environment?.tenantId || provisioningRequest.tenantId,
        tenantEnvironmentId: environment?.id || provisioningRequest.tenantEnvironmentId,
        jobType: "issue_setup_token",
        maxAttempts: Number(commercialProvisioningConfig.setupTokenJobMaxAttempts || 3),
        idempotencyKey: `commercial-setup-token:${provisioningRequest.id}`,
        payload: {
          source: "commercial_signup",
          ttlHours: Number(commercialProvisioningConfig.setupTokenTtlHours || 24),
          deliveredVia: "signup_status_page",
          notes: "Issued automatically after commercial provisioning completed."
        }
      });

      return {
        provisioningRequest,
        accessHandoff,
        setupTokenJob
      };
    },

    async handleSetupTokenIssued(job, automationResult = {}) {
      const provisioningRequest = await getProvisioningRequestByJobId(job.id)
        || await getProvisioningRequestByEnvironmentId(job.tenantEnvironmentId);
      if (!provisioningRequest) return null;

      const updatedProvisioningRequest = await updateProvisioningRequest(provisioningRequest.id, {
        status: "awaiting_customer_setup",
        resultSetupTokenIssued: true,
        failureReason: null
      });

      const accessHandoff = await updateAccessHandoffByProvisioningRequestId(provisioningRequest.id, {
        adminSetupMode: automationResult.token ? "setup_token" : "pending",
        setupToken: automationResult.token || null,
        setupTokenExpiresAt: automationResult.expiresAt || null,
        deliveryChannel: "signup_status_page"
      });

      return {
        provisioningRequest: updatedProvisioningRequest,
        accessHandoff
      };
    },

    async handleProvisioningFailed(job, error) {
      const provisioningRequest = await getProvisioningRequestByJobId(job.id)
        || await getProvisioningRequestByEnvironmentId(job.tenantEnvironmentId);
      if (!provisioningRequest) return null;

      const updatedProvisioningRequest = await updateProvisioningRequest(provisioningRequest.id, {
        status: "failed",
        failureReason: error?.message || "Commercial provisioning failed."
      });

      const accessHandoff = await updateAccessHandoffByProvisioningRequestId(provisioningRequest.id, {
        adminSetupMode: "pending"
      });

      return {
        provisioningRequest: updatedProvisioningRequest,
        accessHandoff
      };
    },

    async handleEnvironmentInitialized(environment) {
      const provisioningRequest = await getProvisioningRequestByEnvironmentId(environment?.id);
      if (!provisioningRequest) return null;

      const updatedProvisioningRequest = await updateProvisioningRequest(provisioningRequest.id, {
        status: "ready",
        tenantId: environment.tenantId || provisioningRequest.tenantId,
        tenantEnvironmentId: environment.id || provisioningRequest.tenantEnvironmentId,
        resultAccessUrl: environment.appBaseUrl || provisioningRequest.resultAccessUrl,
        resultSetupTokenIssued: true
      });

      const accessHandoff = await updateAccessHandoffByProvisioningRequestId(provisioningRequest.id, {
        tenantUrl: environment.appBaseUrl || provisioningRequest.resultAccessUrl,
        deliveredAt: new Date().toISOString()
      });

      return {
        provisioningRequest: updatedProvisioningRequest,
        accessHandoff
      };
    }
  };
}

async function createCommercialTenant(account, plan, runtimeConfig, createTenant) {
  let attempt = 0;
  while (attempt < 20) {
    const suffix = attempt === 0 ? "" : `-${attempt + 1}`;
    try {
      return await createTenant({
        id: `tenant-${randomUUID()}`,
        slug: `${runtimeConfig.tenantSlugBase}${suffix}`,
        displayName: account.accountName,
        status: runtimeConfig.tenantStatus,
        planCode: runtimeConfig.tenantPlanCode,
        primaryContactName: [account.ownerFirstName, account.ownerLastName].filter(Boolean).join(" ").trim() || account.accountName,
        primaryContactEmail: account.ownerEmail,
        notes: `Commercial signup via ${plan.name}`,
        primaryDomainId: `domain-${randomUUID()}`,
        primaryDomain: `${runtimeConfig.requestedSubdomainLabel}${suffix}${runtimeConfig.domainSuffixWithDot}`,
        primaryDomainType: "platform_subdomain"
      });
    } catch (error) {
      if (error?.code !== "23505") throw error;
      attempt += 1;
    }
  }

  const error = new Error("Unable to allocate a unique tenant slug and domain for this commercial signup.");
  error.statusCode = 409;
  throw error;
}

function buildRuntimeConfiguration(account, checkoutSession, plan, commercialProvisioningConfig, publicConfig) {
  const domainSuffix = String(publicConfig.defaultDomainSuffix || "").trim().replace(/^\.+/, "");
  if (!domainSuffix) {
    const error = new Error("PUBLIC_DEFAULT_DOMAIN_SUFFIX is required for commercial provisioning.");
    error.statusCode = 503;
    throw error;
  }

  const databaseHost = String(commercialProvisioningConfig.databaseHost || "").trim();
  const databaseName = String(commercialProvisioningConfig.databaseName || "").trim();
  if (!databaseHost || !databaseName) {
    const error = new Error("Commercial provisioning defaults must include database host and database name.");
    error.statusCode = 503;
    throw error;
  }

  const requestedSubdomainLabel = normalizeSlug(checkoutSession.requestedSubdomainLabel || account.accountSlug || account.accountName || "tenant");
  const tenantSlugBase = normalizeSlug(requestedSubdomainLabel || account.accountSlug || account.accountName || "tenant");
  const protocol = derivePublicProtocol(publicConfig.appBaseUrl);
  const appBaseUrl = `${protocol}//${requestedSubdomainLabel}.${domainSuffix}`;

  return {
    requestedSubdomainLabel,
    tenantSlugBase,
    domainSuffixWithDot: `.${domainSuffix}`,
    environmentKey: String(commercialProvisioningConfig.environmentKey || "production").trim() || "production",
    environmentDisplayName: String(commercialProvisioningConfig.environmentDisplayName || "Production").trim() || "Production",
    appBaseUrl,
    appHost: String(commercialProvisioningConfig.appHost || "").trim() || null,
    webHost: String(commercialProvisioningConfig.webHost || "").trim() || null,
    databaseHost,
    databaseName,
    tenantPlanCode: deriveTenantPlanCode(plan.code),
    tenantStatus: String(commercialProvisioningConfig.defaultTenantStatus || "provisioning").trim().toLowerCase() || "provisioning",
    environmentStatus: String(commercialProvisioningConfig.defaultEnvironmentStatus || "provisioning").trim().toLowerCase() || "provisioning",
    provisioningJobMaxAttempts: Number(commercialProvisioningConfig.provisioningJobMaxAttempts || 3)
  };
}

function buildTenantAppBaseUrl(primaryDomain, publicAppBaseUrl) {
  const protocol = derivePublicProtocol(publicAppBaseUrl);
  return `${protocol}//${String(primaryDomain || "").trim()}`;
}

function deriveTenantPlanCode(planCode) {
  const normalized = String(planCode || "").trim().toLowerCase();
  if (!normalized) return "standard";
  return normalized.replace(/_(monthly|yearly|annual)$/, "");
}

function derivePublicProtocol(publicAppBaseUrl) {
  const raw = String(publicAppBaseUrl || "").trim();
  if (!raw) return "http:";
  try {
    return new URL(raw).protocol || "http:";
  } catch (_error) {
    return "http:";
  }
}

function normalizeSlug(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return normalized || `tenant-${randomUUID().slice(0, 8)}`;
}

module.exports = {
  createCommercialProvisioningService
};
