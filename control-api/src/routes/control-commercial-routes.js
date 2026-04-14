const { randomUUID } = require("crypto");
const { ensurePermission } = require("./route-auth");

function registerControlCommercialRoutes(app, deps) {
  const {
    createCancellationExportRequest,
    createOperatorAuditEntry,
    getCommercialSubscriptionById,
    getCommercialOverviewBySubscriptionId,
    listCancellationExportRequestsBySubscriptionId,
    listCommercialOverview,
    listOperatorAuditLog,
    queueProvisioningJob,
    updateCommercialSubscription
  } = deps;

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

module.exports = {
  registerControlCommercialRoutes
};
