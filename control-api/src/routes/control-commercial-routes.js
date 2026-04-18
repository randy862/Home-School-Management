const { randomUUID } = require("crypto");
const { ensurePermission } = require("./route-auth");
const { parseBearerToken, verifyInternalServiceToken } = require("../internal-service-auth");

function registerControlCommercialRoutes(app, deps) {
  const {
    createCancellationExportRequest,
    createOperatorAuditEntry,
    getCommercialSubscriptionById,
    getCommercialOverviewBySubscriptionId,
    getCommercialPlanById,
    internalConfig,
    listCancellationExportRequestsBySubscriptionId,
    listCommercialOverview,
    listPublicCommercialPlans,
    listOperatorAuditLog,
    queueProvisioningJob,
    stripeService,
    updateCommercialSubscription
  } = deps;

  app.post("/api/internal/commercial/subscriptions/:id/upgrade", async (req, res) => {
    if (!ensureInternalCommercialRequest(req, res, internalConfig)) return;

    try {
      const overview = await getCommercialOverviewBySubscriptionId(req.params.id);
      const subscription = await getCommercialSubscriptionById(req.params.id);
      if (!subscription || !overview) {
        res.status(404).json({ error: "Subscription not found." });
        return;
      }
      if (!subscription.stripeSubscriptionId) {
        res.status(409).json({ error: "This subscription is not yet linked to an active Stripe subscription." });
        return;
      }

      const targetPlanCode = String(req.body?.targetPlanCode || "").trim().toLowerCase();
      if (!targetPlanCode) {
        res.status(400).json({ error: "Target plan code is required." });
        return;
      }

      const currentPlan = await getCommercialPlanById(subscription.commercialPlanId || overview.commercialPlanId);
      const targetPlan = (await listPublicCommercialPlans()).find((plan) => String(plan.code || "").trim().toLowerCase() === targetPlanCode);
      if (!currentPlan || !targetPlan) {
        res.status(404).json({ error: "Requested plan was not found." });
        return;
      }
      if (!targetPlan.stripePriceId) {
        res.status(409).json({ error: "Selected upgrade plan is not yet configured for Stripe." });
        return;
      }
      if (!isHigherPlan(targetPlan, currentPlan)) {
        res.status(409).json({ error: "Only higher-tier upgrade plans are available from this flow." });
        return;
      }

      const stripeSubscription = await stripeService.updateSubscriptionPlan({
        subscriptionId: subscription.stripeSubscriptionId,
        priceId: targetPlan.stripePriceId,
        metadata: {
          commercialPlanId: targetPlan.id,
          commercialPlanCode: targetPlan.code,
          previousCommercialPlanCode: currentPlan.code || "",
          requestedByUserId: req.body?.requestedByUserId || "",
          requestedByUsername: req.body?.requestedByUsername || ""
        }
      });

      const updated = await updateCommercialSubscription(subscription.id, {
        commercialPlanId: targetPlan.id,
        status: normalizeStripeSubscriptionStatus(stripeSubscription.status),
        currentPeriodStart: toIsoFromUnixSeconds(stripeSubscription.current_period_start),
        currentPeriodEnd: toIsoFromUnixSeconds(stripeSubscription.current_period_end),
        basePriceCents: Number(targetPlan.priceCents || 0),
        includedBillableStudents: Number(targetPlan.limits?.includedBillableStudents || 0),
        perStudentOverageCents: Number(targetPlan.limits?.perStudentOverageCents || 0)
      });

      await createOperatorAuditEntry({
        operatorUserId: null,
        actionType: "tenant_upgrade_subscription",
        targetType: "customer_subscription",
        targetId: subscription.id,
        tenantId: overview.tenantId || null,
        details: {
          requestedByUserId: req.body?.requestedByUserId || null,
          requestedByUsername: req.body?.requestedByUsername || null,
          previousPlanCode: currentPlan.code || null,
          targetPlanCode: targetPlan.code || null,
          stripeSubscriptionId: subscription.stripeSubscriptionId
        }
      });

      res.json({
        message: `Subscription upgraded to ${targetPlan.name}.`,
        subscription: {
          ...updated,
          accountName: overview.accountName || "",
          ownerEmail: overview.ownerEmail || "",
          billingEmail: overview.billingEmail || "",
          accountStatus: overview.accountStatus || "",
          planId: targetPlan.id,
          planCode: targetPlan.code,
          planName: targetPlan.name,
          billingInterval: targetPlan.billingInterval,
          currency: targetPlan.currency || "usd"
        },
        targetPlan
      });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.post("/api/internal/commercial/subscriptions/:id/dormant", async (req, res) => {
    if (!ensureInternalCommercialRequest(req, res, internalConfig)) return;

    try {
      const overview = await getCommercialOverviewBySubscriptionId(req.params.id);
      const subscription = await getCommercialSubscriptionById(req.params.id);
      if (!subscription || !overview) {
        res.status(404).json({ error: "Subscription not found." });
        return;
      }

      const now = Date.now();
      const currentPeriodEnd = subscription.currentPeriodEnd ? Date.parse(subscription.currentPeriodEnd) : Number.NaN;
      const dormantStatus = Number.isFinite(currentPeriodEnd) && currentPeriodEnd > now
        ? "pending_dormant"
        : "dormant";

      const updated = await updateCommercialSubscription(subscription.id, {
        dormantStatus
      });
      let lifecycleJob = null;
      if (dormantStatus === "dormant" && overview.tenantEnvironmentId) {
        lifecycleJob = await queueProvisioningJob(createLifecycleJobPayload({
          tenantId: overview.tenantId,
          tenantEnvironmentId: overview.tenantEnvironmentId,
          jobType: "suspend_tenant",
          message: "Suspend tenant queued from tenant-requested dormant transition",
          notes: String(req.body?.notes || "").trim() || "Queued automatically when tenant requested dormant status."
        }), {
          operatorUserId: null
        });
      }
      await createOperatorAuditEntry({
        operatorUserId: null,
        actionType: dormantStatus === "pending_dormant" ? "tenant_mark_subscription_pending_dormant" : "tenant_mark_subscription_dormant",
        targetType: "customer_subscription",
        targetId: subscription.id,
        tenantId: overview.tenantId || null,
        details: {
          requestedByUserId: req.body?.requestedByUserId || null,
          requestedByUsername: req.body?.requestedByUsername || null,
          dormantStatus,
          tenantEnvironmentId: overview.tenantEnvironmentId || null,
          lifecycleJobId: lifecycleJob?.id || null
        }
      });
      res.json({
        message: dormantStatus === "pending_dormant"
          ? "Dormant request recorded. The site will enter dormant status at the end of the current billing period."
          : "The site is now marked dormant.",
        subscription: {
          ...updated,
          accountName: overview.accountName || "",
          ownerEmail: overview.ownerEmail || "",
          billingEmail: overview.billingEmail || "",
          accountStatus: overview.accountStatus || "",
          planId: overview.commercialPlanId || null,
          planCode: overview.planCode || "",
          planName: overview.planName || "",
          billingInterval: "month",
          currency: "usd"
        },
        lifecycleJob
      });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.post("/api/internal/commercial/subscriptions/:id/reactivate", async (req, res) => {
    if (!ensureInternalCommercialRequest(req, res, internalConfig)) return;

    try {
      const overview = await getCommercialOverviewBySubscriptionId(req.params.id);
      const subscription = await getCommercialSubscriptionById(req.params.id);
      if (!subscription || !overview) {
        res.status(404).json({ error: "Subscription not found." });
        return;
      }

      const previousDormantStatus = String(subscription.dormantStatus || overview.dormantStatus || "active").trim().toLowerCase() || "active";
      if (previousDormantStatus === "active") {
        res.json({
          message: "The site is already active.",
          subscription: {
            ...subscription,
            accountName: overview.accountName || "",
            ownerEmail: overview.ownerEmail || "",
            billingEmail: overview.billingEmail || "",
            accountStatus: overview.accountStatus || "",
            planId: overview.commercialPlanId || null,
            planCode: overview.planCode || "",
            planName: overview.planName || "",
            billingInterval: "month",
            currency: "usd"
          },
          lifecycleJob: null
        });
        return;
      }

      const updated = await updateCommercialSubscription(subscription.id, {
        dormantStatus: "active"
      });

      let lifecycleJob = null;
      if (previousDormantStatus === "dormant" && overview.tenantEnvironmentId) {
        lifecycleJob = await queueProvisioningJob(createLifecycleJobPayload({
          tenantId: overview.tenantId,
          tenantEnvironmentId: overview.tenantEnvironmentId,
          jobType: "resume_tenant",
          message: "Resume tenant queued from tenant-requested reactivation",
          notes: String(req.body?.notes || "").trim() || "Queued automatically when tenant requested reactivation."
        }), {
          operatorUserId: null
        });
      }
      await createOperatorAuditEntry({
        operatorUserId: null,
        actionType: "tenant_reactivate_subscription",
        targetType: "customer_subscription",
        targetId: subscription.id,
        tenantId: overview.tenantId || null,
        details: {
          requestedByUserId: req.body?.requestedByUserId || null,
          requestedByUsername: req.body?.requestedByUsername || null,
          previousDormantStatus,
          dormantStatus: "active",
          tenantEnvironmentId: overview.tenantEnvironmentId || null,
          lifecycleJobId: lifecycleJob?.id || null
        }
      });
      res.json({
        message: previousDormantStatus === "pending_dormant"
          ? "Dormant status was canceled. The site remains active."
          : "The site is now marked active.",
        subscription: {
          ...updated,
          accountName: overview.accountName || "",
          ownerEmail: overview.ownerEmail || "",
          billingEmail: overview.billingEmail || "",
          accountStatus: overview.accountStatus || "",
          planId: overview.commercialPlanId || null,
          planCode: overview.planCode || "",
          planName: overview.planName || "",
          billingInterval: "month",
          currency: "usd"
        },
        lifecycleJob
      });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.post("/api/internal/commercial/subscriptions/:id/overage-sync", async (req, res) => {
    if (!ensureInternalCommercialRequest(req, res, internalConfig)) return;

    try {
      const overview = await getCommercialOverviewBySubscriptionId(req.params.id);
      const subscription = await getCommercialSubscriptionById(req.params.id);
      if (!subscription || !overview) {
        res.status(404).json({ error: "Subscription not found." });
        return;
      }

      const currentBillableStudentCount = Math.max(0, Number.parseInt(req.body?.currentBillableStudentCount, 10) || 0);
      const currentOverageStudentCount = Math.max(0, Number.parseInt(req.body?.currentOverageStudentCount, 10) || 0);
      const lastBillableCountCalculatedAt = normalizeOptionalIsoTimestamp(req.body?.lastBillableCountCalculatedAt) || new Date().toISOString();
      const currentPlan = await getCommercialPlanById(subscription.commercialPlanId || overview.commercialPlanId);

      const updated = await updateCommercialSubscription(subscription.id, {
        currentBillableStudentCount,
        currentOverageStudentCount,
        lastBillableCountCalculatedAt
      });

      if (!subscription.stripeSubscriptionId) {
        res.json({
          message: "Overage usage stored locally. Stripe subscription is not linked yet.",
          stripeSync: {
            status: "skipped",
            reason: "stripe_subscription_missing",
            quantity: currentOverageStudentCount
          },
          subscription: buildControlSubscriptionResponse(updated, overview, currentPlan)
        });
        return;
      }

      const stripeSync = await stripeService.syncSubscriptionOverageItem({
        subscriptionId: subscription.stripeSubscriptionId,
        customerSubscriptionId: subscription.id,
        commercialPlanId: currentPlan?.id || subscription.commercialPlanId || overview.commercialPlanId || null,
        priceId: currentPlan?.limits?.stripeOveragePriceId || "",
        productId: currentPlan?.stripeProductId || "",
        unitAmountCents: Number(updated.perStudentOverageCents || currentPlan?.limits?.perStudentOverageCents || 0),
        currency: currentPlan?.currency || overview.currency || "usd",
        interval: currentPlan?.billingInterval || "month",
        quantity: currentOverageStudentCount,
        prorationBehavior: "create_prorations"
      });

      res.json({
        message: currentOverageStudentCount > 0
          ? `Overage billing is synced for ${currentOverageStudentCount} student${currentOverageStudentCount === 1 ? "" : "s"}.`
          : "Overage billing is cleared for this subscription.",
        stripeSync: {
          status: "applied",
          action: stripeSync.action,
          quantity: stripeSync.quantity,
          overageItemId: stripeSync.overageItemId || null
        },
        subscription: buildControlSubscriptionResponse(updated, overview, currentPlan)
      });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.post("/api/internal/commercial/subscriptions/:id/cancellation-export", async (req, res) => {
    if (!ensureInternalCommercialRequest(req, res, internalConfig)) return;

    try {
      const overview = await getCommercialOverviewBySubscriptionId(req.params.id);
      const subscription = await getCommercialSubscriptionById(req.params.id);
      if (!subscription || !overview) {
        res.status(404).json({ error: "Subscription not found." });
        return;
      }

      const exportRequest = await createCancellationExportRequest({
        customerAccountId: subscription.customerAccountId,
        customerSubscriptionId: subscription.id,
        requestedByEmail: req.body?.requestedByEmail || req.body?.requestedByUsername || null,
        priceCents: 1999
      });
      await createOperatorAuditEntry({
        operatorUserId: null,
        actionType: "tenant_request_cancellation_export",
        targetType: "customer_subscription",
        targetId: subscription.id,
        tenantId: overview.tenantId || null,
        details: {
          requestedByUserId: req.body?.requestedByUserId || null,
          requestedByUsername: req.body?.requestedByUsername || null,
          exportRequestId: exportRequest.id,
          priceCents: exportRequest.priceCents,
          requestedByEmail: exportRequest.requestedByEmail || null
        }
      });
      res.status(201).json({
        message: "Export request recorded. A follow-up payment and delivery flow will be attached in a later slice.",
        exportRequest
      });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.get("/api/control/commercial/overview", async (req, res) => {
    if (!ensurePermission(req, res, "manageCustomers", "Manage Customers permission required")) return;

    try {
      res.json(await listCommercialOverview());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/control/commercial/subscriptions/:id", async (req, res) => {
    if (!ensurePermission(req, res, "manageCustomers", "Manage Customers permission required")) return;

    try {
      const overview = await getCommercialOverviewBySubscriptionId(req.params.id);
      if (!overview) {
        res.status(404).json({ error: "Subscription not found." });
        return;
      }

      const subscription = await getCommercialSubscriptionById(req.params.id);
      const exportRequests = await listCancellationExportRequestsBySubscriptionId(req.params.id);
      const auditEntries = await listOperatorAuditLog({
        targetType: "customer_subscription",
        targetId: req.params.id,
        limit: req.query?.auditLimit
      });
      res.json({
        overview,
        subscription,
        exportRequests,
        auditEntries
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/control/commercial/subscriptions/:id/dormant", async (req, res) => {
    if (!ensurePermission(req, res, "manageCustomers", "Manage Customers permission required")) return;

    try {
      const overview = await getCommercialOverviewBySubscriptionId(req.params.id);
      const subscription = await getCommercialSubscriptionById(req.params.id);
      if (!subscription || !overview) {
        res.status(404).json({ error: "Subscription not found." });
        return;
      }

      const now = Date.now();
      const currentPeriodEnd = subscription.currentPeriodEnd ? Date.parse(subscription.currentPeriodEnd) : Number.NaN;
      const dormantStatus = Number.isFinite(currentPeriodEnd) && currentPeriodEnd > now
        ? "pending_dormant"
        : "dormant";

      if (dormantStatus === "dormant" && overview.tenantEnvironmentId) {
        if (!ensurePermission(req, res, "manageOperations", "Manage Operations permission required")) return;
      }

      const updated = await updateCommercialSubscription(subscription.id, {
        dormantStatus
      });
      let lifecycleJob = null;
      if (dormantStatus === "dormant" && overview.tenantEnvironmentId) {
        lifecycleJob = await queueProvisioningJob(createLifecycleJobPayload({
          tenantId: overview.tenantId,
          tenantEnvironmentId: overview.tenantEnvironmentId,
          jobType: "suspend_tenant",
          message: "Suspend tenant queued from commercial dormant transition",
          notes: String(req.body?.notes || "").trim() || "Queued automatically when subscription entered dormant status."
        }), {
          operatorUserId: req.auth.user.id
        });
      }
      await createOperatorAuditEntry({
        operatorUserId: req.auth.user.id,
        actionType: dormantStatus === "pending_dormant" ? "mark_subscription_pending_dormant" : "mark_subscription_dormant",
        targetType: "customer_subscription",
        targetId: subscription.id,
        tenantId: overview.tenantId || null,
        details: {
          dormantStatus,
          tenantEnvironmentId: overview.tenantEnvironmentId || null,
          lifecycleJobId: lifecycleJob?.id || null
        }
      });
      res.json({
        subscription: updated,
        lifecycleJob
      });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.post("/api/control/commercial/subscriptions/:id/reactivate", async (req, res) => {
    if (!ensurePermission(req, res, "manageCustomers", "Manage Customers permission required")) return;

    try {
      const overview = await getCommercialOverviewBySubscriptionId(req.params.id);
      const subscription = await getCommercialSubscriptionById(req.params.id);
      if (!subscription || !overview) {
        res.status(404).json({ error: "Subscription not found." });
        return;
      }

      if (overview.tenantEnvironmentId) {
        if (!ensurePermission(req, res, "manageOperations", "Manage Operations permission required")) return;
      }

      const updated = await updateCommercialSubscription(subscription.id, {
        dormantStatus: "active"
      });

      let lifecycleJob = null;
      if (overview.tenantEnvironmentId) {
        lifecycleJob = await queueProvisioningJob(createLifecycleJobPayload({
          tenantId: overview.tenantId,
          tenantEnvironmentId: overview.tenantEnvironmentId,
          jobType: "resume_tenant",
          message: "Resume tenant queued from commercial reactivation",
          notes: String(req.body?.notes || "").trim() || "Queued automatically when subscription was reactivated."
        }), {
          operatorUserId: req.auth.user.id
        });
      }
      await createOperatorAuditEntry({
        operatorUserId: req.auth.user.id,
        actionType: "reactivate_subscription",
        targetType: "customer_subscription",
        targetId: subscription.id,
        tenantId: overview.tenantId || null,
        details: {
          dormantStatus: "active",
          tenantEnvironmentId: overview.tenantEnvironmentId || null,
          lifecycleJobId: lifecycleJob?.id || null
        }
      });
      res.json({
        subscription: updated,
        lifecycleJob
      });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.post("/api/control/commercial/subscriptions/:id/cancellation-export", async (req, res) => {
    if (!ensurePermission(req, res, "manageCustomers", "Manage Customers permission required")) return;

    try {
      const overview = await getCommercialOverviewBySubscriptionId(req.params.id);
      const subscription = await getCommercialSubscriptionById(req.params.id);
      if (!subscription || !overview) {
        res.status(404).json({ error: "Subscription not found." });
        return;
      }

      const exportRequest = await createCancellationExportRequest({
        customerAccountId: subscription.customerAccountId,
        customerSubscriptionId: subscription.id,
        requestedByEmail: req.body?.requestedByEmail || req.auth?.user?.username || null,
        priceCents: 1999
      });
      await createOperatorAuditEntry({
        operatorUserId: req.auth.user.id,
        actionType: "request_cancellation_export",
        targetType: "customer_subscription",
        targetId: subscription.id,
        tenantId: overview.tenantId || null,
        details: {
          exportRequestId: exportRequest.id,
          priceCents: exportRequest.priceCents,
          requestedByEmail: exportRequest.requestedByEmail || null
        }
      });
      res.status(201).json(exportRequest);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });
}

function ensureInternalCommercialRequest(req, res, internalConfig) {
  const bearerToken = parseBearerToken(req.headers.authorization);
  const serviceAuthSecret = String(internalConfig?.serviceAuthSecret || "").trim();
  if (serviceAuthSecret && bearerToken) {
    const verification = verifyInternalServiceToken(bearerToken, {
      secret: serviceAuthSecret,
      expectedAudience: internalConfig?.tenantRuntimeAudience,
      expectedIssuer: internalConfig?.serviceAuthIssuer,
      clockSkewSeconds: internalConfig?.serviceAuthClockSkewSeconds
    });
    if (verification.ok) {
      req.internalServiceAuth = verification.claims;
      return true;
    }
    res.status(401).json({ error: "Internal control-plane authentication required." });
    return false;
  }

  const configured = String(internalConfig?.apiKey || "").trim();
  if (configured && internalConfig?.allowLegacyApiKey) {
    const provided = String(req.headers["x-control-plane-key"] || "").trim();
    if (provided && provided === configured) {
      return true;
    }
  }

  res.status(401).json({ error: "Internal control-plane authentication required." });
  return false;
}

function createLifecycleJobPayload({ tenantId, tenantEnvironmentId, jobType, message, notes }) {
  if (!tenantEnvironmentId) {
    const error = new Error("Environment id is required.");
    error.statusCode = 400;
    throw error;
  }
  return {
    id: `job-${randomUUID()}`,
    tenantId: tenantId || null,
    tenantEnvironmentId,
    jobType,
    idempotencyKey: null,
    maxAttempts: 3,
    message,
    payload: {
      notes: notes || ""
    }
  };
}

function isHigherPlan(targetPlan, currentPlan) {
  const currentIncluded = Number(currentPlan?.limits?.includedBillableStudents || 0);
  const targetIncluded = Number(targetPlan?.limits?.includedBillableStudents || 0);
  return Number(targetPlan?.sortOrder || 0) > Number(currentPlan?.sortOrder || 0)
    || Number(targetPlan?.priceCents || 0) > Number(currentPlan?.priceCents || 0)
    || targetIncluded > currentIncluded;
}

function toIsoFromUnixSeconds(value) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) return null;
  return new Date(normalized * 1000).toISOString();
}

function normalizeStripeSubscriptionStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "active";
  if (["trialing", "active", "past_due", "unpaid", "canceled", "incomplete", "incomplete_expired"].includes(normalized)) {
    return normalized === "incomplete_expired" ? "canceled" : normalized;
  }
  return "active";
}

function buildControlSubscriptionResponse(subscription, overview, plan) {
  return {
    ...subscription,
    accountName: overview?.accountName || "",
    ownerEmail: overview?.ownerEmail || "",
    billingEmail: overview?.billingEmail || "",
    accountStatus: overview?.accountStatus || "",
    planId: plan?.id || overview?.commercialPlanId || null,
    planCode: plan?.code || overview?.planCode || "",
    planName: plan?.name || overview?.planName || "",
    billingInterval: plan?.billingInterval || "month",
    currency: plan?.currency || "usd"
  };
}

function normalizeOptionalIsoTimestamp(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

module.exports = {
  registerControlCommercialRoutes
};
