const { hashPassword, verifyPassword } = require("../auth-service");

function registerAccountRoutes(app, deps) {
  const {
    commercialPolicyService,
    controlPlaneClient,
    getUserById,
    isPostgresMode,
    updateUser
  } = deps;

  app.get("/api/account", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode)) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      const user = req.auth.user;
      const commercialSummary = commercialPolicyService
        ? await commercialPolicyService.getTenantCommercialSummary()
        : null;
      const upgradeOptions = commercialPolicyService
        ? await commercialPolicyService.listEligibleUpgradePlans()
        : [];
      const recentBillingEvents = commercialPolicyService
        ? await commercialPolicyService.listRecentBillingEvents(6)
        : [];
      const recentExportRequests = commercialPolicyService
        ? await commercialPolicyService.listRecentExportRequests(4)
        : [];
      res.json({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          studentId: user.studentId || "",
          email: null,
          mustChangePassword: !!user.mustChangePassword
        },
        tenant: {
          siteId: commercialSummary?.siteId || commercialSummary?.tenantId || "",
          tenantId: commercialSummary?.tenantId || "",
          tenantEnvironmentId: commercialSummary?.tenantEnvironmentId || "",
          accountName: commercialSummary?.accountName || ""
        },
        permissions: {
          canChangePassword: true,
          canManageSubscription: user.role === "admin",
          canRequestDormant: user.role === "admin",
          canReactivate: user.role === "admin",
          canRequestExport: user.role === "admin"
        },
        subscription: commercialSummary ? mapSubscriptionSummary(commercialSummary) : null,
        upgradeOptions: upgradeOptions.map(mapUpgradePlan),
        activity: {
          billingEvents: recentBillingEvents.map(mapBillingEvent),
          exportRequests: recentExportRequests.map(mapExportRequest)
        }
      });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.post("/api/account/password", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode)) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      const currentPassword = String(req.body?.currentPassword || "");
      const newPassword = String(req.body?.newPassword || "");
      if (!currentPassword || !newPassword) {
        const error = new Error("Current password and new password are required.");
        error.statusCode = 400;
        throw error;
      }
      if (newPassword.length < 8) {
        const error = new Error("New password must be at least 8 characters long.");
        error.statusCode = 400;
        throw error;
      }

      const existingUser = await getUserById(req.auth.user.id);
      if (!existingUser) {
        const error = new Error("User account not found.");
        error.statusCode = 404;
        throw error;
      }
      if (!await verifyPassword(existingUser, currentPassword)) {
        const error = new Error("Current password is incorrect.");
        error.statusCode = 400;
        throw error;
      }
      if (await verifyPassword(existingUser, newPassword)) {
        const error = new Error("Choose a new password that is different from the current password.");
        error.statusCode = 400;
        throw error;
      }

      const credentials = await hashPassword(newPassword);
      await updateUser(existingUser.id, {
        username: existingUser.username,
        role: existingUser.role,
        studentId: existingUser.studentId || "",
        mustChangePassword: false,
        ...credentials
      });

      res.json({ ok: true });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.post("/api/account/subscription/upgrade", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode)) return;
    if (!ensureAuthenticated(req, res)) return;
    if (!ensureAdminUser(req, res, "Only tenant administrators can upgrade the subscription.")) return;

    try {
      const commercialSummary = commercialPolicyService
        ? await commercialPolicyService.getTenantCommercialSummary()
        : null;
      if (!commercialSummary?.subscriptionId) {
        const error = new Error("No active commercial subscription was found for this tenant.");
        error.statusCode = 404;
        throw error;
      }
      const targetPlanCode = String(req.body?.targetPlanCode || "").trim().toLowerCase();
      if (!targetPlanCode) {
        const error = new Error("Target plan code is required.");
        error.statusCode = 400;
        throw error;
      }

      const payload = await controlPlaneClient.request(`/api/internal/commercial/subscriptions/${encodeURIComponent(commercialSummary.subscriptionId)}/upgrade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          targetPlanCode,
          requestedByUserId: req.auth.user.id,
          requestedByUsername: req.auth.user.username
        })
      });

      res.json({
        ok: true,
        message: payload?.message || "Subscription updated.",
        subscription: payload?.subscription ? mapSubscriptionSummary(payload.subscription) : null,
        targetPlan: payload?.targetPlan ? mapUpgradePlan(payload.targetPlan) : null
      });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.post("/api/account/options/dormant", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode)) return;
    if (!ensureAuthenticated(req, res)) return;
    if (!ensureAdminUser(req, res, "Only tenant administrators can change dormant status.")) return;

    try {
      const commercialSummary = commercialPolicyService
        ? await commercialPolicyService.getTenantCommercialSummary()
        : null;
      if (!commercialSummary?.subscriptionId) {
        const error = new Error("No active commercial subscription was found for this tenant.");
        error.statusCode = 404;
        throw error;
      }
      const payload = await controlPlaneClient.request(`/api/internal/commercial/subscriptions/${encodeURIComponent(commercialSummary.subscriptionId)}/dormant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          requestedByUserId: req.auth.user.id,
          requestedByUsername: req.auth.user.username,
          notes: String(req.body?.notes || "").trim()
        })
      });
      res.json({
        ok: true,
        message: payload?.message || "Dormant request recorded.",
        subscription: payload?.subscription ? mapSubscriptionSummary(payload.subscription) : null
      });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.post("/api/account/options/reactivate", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode)) return;
    if (!ensureAuthenticated(req, res)) return;
    if (!ensureAdminUser(req, res, "Only tenant administrators can reactivate dormant status.")) return;

    try {
      const commercialSummary = commercialPolicyService
        ? await commercialPolicyService.getTenantCommercialSummary()
        : null;
      if (!commercialSummary?.subscriptionId) {
        const error = new Error("No active commercial subscription was found for this tenant.");
        error.statusCode = 404;
        throw error;
      }
      const payload = await controlPlaneClient.request(`/api/internal/commercial/subscriptions/${encodeURIComponent(commercialSummary.subscriptionId)}/reactivate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          requestedByUserId: req.auth.user.id,
          requestedByUsername: req.auth.user.username,
          notes: String(req.body?.notes || "").trim()
        })
      });
      res.json({
        ok: true,
        message: payload?.message || "Account reactivated.",
        subscription: payload?.subscription ? mapSubscriptionSummary(payload.subscription) : null
      });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.post("/api/account/options/export-request", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode)) return;
    if (!ensureAuthenticated(req, res)) return;
    if (!ensureAdminUser(req, res, "Only tenant administrators can request an export.")) return;

    try {
      const commercialSummary = commercialPolicyService
        ? await commercialPolicyService.getTenantCommercialSummary()
        : null;
      if (!commercialSummary?.subscriptionId) {
        const error = new Error("No active commercial subscription was found for this tenant.");
        error.statusCode = 404;
        throw error;
      }
      const payload = await controlPlaneClient.request(`/api/internal/commercial/subscriptions/${encodeURIComponent(commercialSummary.subscriptionId)}/cancellation-export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          requestedByUserId: req.auth.user.id,
          requestedByUsername: req.auth.user.username,
          requestedByEmail: req.auth.user.username
        })
      });
      res.status(201).json({
        ok: true,
        message: payload?.message || "Export request recorded.",
        exportRequest: payload?.exportRequest ? mapExportRequest(payload.exportRequest) : null
      });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });
}

function mapSubscriptionSummary(summary) {
  const included = Number(summary.includedBillableStudents || 0);
  const current = Number(summary.currentBillableStudentCount || 0);
  const overage = Number(summary.currentOverageStudentCount || 0);
  return {
    id: summary.subscriptionId || summary.id,
    status: summary.subscriptionStatus || summary.status,
    dormantStatus: summary.dormantStatus,
    accountStatus: summary.accountStatus,
    plan: {
      id: summary.planId || summary.commercialPlanId,
      code: summary.planCode,
      name: summary.planName,
      billingInterval: summary.billingInterval,
      basePriceCents: Number(summary.basePriceCents || 0),
      currency: summary.currency
    },
    billingPeriod: {
      start: summary.currentPeriodStart,
      end: summary.currentPeriodEnd
    },
    billableStudents: {
      included,
      current,
      overage,
      perStudentOverageCents: Number(summary.perStudentOverageCents || 0),
      usageStatus: current > included ? "over_limit" : current >= included ? "at_limit" : "within_limit",
      lastCalculatedAt: summary.lastBillableCountCalculatedAt
    },
    account: {
      name: summary.accountName,
      ownerEmail: summary.ownerEmail || "",
      billingEmail: summary.billingEmail || ""
    }
  };
}

function mapUpgradePlan(plan) {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description || "",
    billingInterval: plan.billingInterval || "month",
    priceCents: Number(plan.priceCents || 0),
    currency: plan.currency || "usd",
    featureSummary: Array.isArray(plan.featureSummary) ? plan.featureSummary : [],
    limits: {
      includedBillableStudents: Number(plan.limits?.includedBillableStudents || 0),
      perStudentOverageCents: Number(plan.limits?.perStudentOverageCents || 0),
      allowsOverage: !!plan.limits?.allowsOverage
    }
  };
}

function mapBillingEvent(event) {
  return {
    id: event.id,
    eventType: event.eventType || "",
    eventSource: event.eventSource || "",
    occurredAt: event.occurredAt || event.createdAt || null,
    processingStatus: event.processingStatus || "",
    processingError: event.processingError || ""
  };
}

function mapExportRequest(request) {
  return {
    id: request.id,
    status: request.status || "",
    priceCents: Number(request.priceCents || 0),
    currency: request.currency || "usd",
    requestedByEmail: request.requestedByEmail || "",
    artifactExpiresAt: request.artifactExpiresAt || null,
    failureReason: request.failureReason || "",
    createdAt: request.createdAt || null,
    updatedAt: request.updatedAt || null
  };
}

function ensurePostgresMode(res, isPostgresMode) {
  if (isPostgresMode) return true;
  res.status(404).json({ error: "Account endpoints are available only in postgres mode." });
  return false;
}

function ensureAuthenticated(req, res) {
  if (req.auth?.user) return true;
  res.status(401).json({ error: "Authentication required." });
  return false;
}

function ensureAdminUser(req, res, message) {
  if (req.auth?.user?.role === "admin") return true;
  res.status(403).json({ error: message || "Administrator access required." });
  return false;
}

module.exports = {
  registerAccountRoutes
};
