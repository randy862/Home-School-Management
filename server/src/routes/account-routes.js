const { hashPassword, verifyPassword } = require("../auth-service");
const PASSWORD_MIN_LENGTH = 10;

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
      const canManageAccount = user.role === "admin";
      const runtime = req.tenantRuntime || {};
      const commercialSummary = canManageAccount && commercialPolicyService
        ? await commercialPolicyService.getTenantCommercialSummary()
        : null;
      const upgradeOptions = canManageAccount && commercialPolicyService
        ? await commercialPolicyService.listEligibleUpgradePlans()
        : [];
      const recentBillingEvents = canManageAccount && commercialPolicyService
        ? await commercialPolicyService.listRecentBillingEvents(6)
        : [];
      const recentExportRequests = canManageAccount && commercialPolicyService
        ? await commercialPolicyService.listRecentExportRequests(4)
        : [];
      const tenantId = commercialSummary?.tenantId || runtime.tenantId || "";
      const tenantEnvironmentId = commercialSummary?.tenantEnvironmentId || runtime.tenantEnvironmentId || "";
      const siteId = commercialSummary?.siteId || tenantId;
      const accountName = commercialSummary?.accountName || runtime.tenantDisplayName || "";
      res.json({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          studentId: user.studentId || "",
          firstName: user.firstName || (canManageAccount ? commercialSummary?.ownerFirstName : "") || "",
          lastName: user.lastName || (canManageAccount ? commercialSummary?.ownerLastName : "") || "",
          email: user.email || (canManageAccount ? commercialSummary?.ownerEmail : "") || "",
          phone: user.phone || (canManageAccount ? commercialSummary?.ownerPhone : "") || "",
          profilePhotoDataUrl: user.profilePhotoDataUrl || "",
          mustChangePassword: !!user.mustChangePassword
        },
        tenant: {
          siteId: buildFriendlySiteId(siteId),
          internalSiteId: siteId,
          tenantId,
          tenantEnvironmentId,
          accountName
        },
        permissions: {
          canChangePassword: true,
          canManageSubscription: canManageAccount,
          canRequestDormant: canManageAccount,
          canReactivate: canManageAccount,
          canRequestExport: canManageAccount
        },
        subscription: canManageAccount && commercialSummary ? mapSubscriptionSummary(commercialSummary) : null,
        upgradeOptions: upgradeOptions.map(mapUpgradePlan),
        activity: {
          billingEvents: recentBillingEvents.map(mapBillingEvent),
          exportRequests: recentExportRequests.map(mapExportRequest)
        }
      });
    } catch (error) {
      sendAccountRouteError(res, error);
    }
  });

  app.put("/api/account/profile-photo", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode)) return;
    if (!ensureAuthenticated(req, res)) return;

    try {
      const profilePhotoDataUrl = normalizeProfilePhotoDataUrl(req.body?.profilePhotoDataUrl);
      const existingUser = await getUserById(req.auth.user.id);
      if (!existingUser) {
        const error = new Error("User account not found.");
        error.statusCode = 404;
        throw error;
      }
      const updated = await updateUser(existingUser.id, {
        username: existingUser.username,
        role: existingUser.role,
        firstName: existingUser.firstName || "",
        lastName: existingUser.lastName || "",
        email: existingUser.email || "",
        phone: existingUser.phone || "",
        studentId: existingUser.studentId || "",
        mustChangePassword: !!existingUser.mustChangePassword,
        profilePhotoDataUrl
      });
      res.json({
        ok: true,
        user: {
          id: updated.id,
          profilePhotoDataUrl: updated.profilePhotoDataUrl || ""
        }
      });
    } catch (error) {
      sendAccountRouteError(res, error);
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
      if (newPassword.length < PASSWORD_MIN_LENGTH) {
        const error = new Error(`New password must be at least ${PASSWORD_MIN_LENGTH} characters long.`);
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
        firstName: existingUser.firstName || "",
        lastName: existingUser.lastName || "",
        email: existingUser.email || "",
        phone: existingUser.phone || "",
        studentId: existingUser.studentId || "",
        mustChangePassword: false,
        ...credentials
      });

      res.json({ ok: true });
    } catch (error) {
      sendAccountRouteError(res, error);
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
      sendAccountRouteError(res, error);
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
      sendAccountRouteError(res, error);
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
      sendAccountRouteError(res, error);
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
          requestedByEmail: req.auth.user.email || commercialSummary?.ownerEmail || req.auth.user.username,
          successUrl: buildAccountReturnUrl(req, "export=success"),
          cancelUrl: buildAccountReturnUrl(req, "export=cancel")
        })
      });
      res.status(201).json({
        ok: true,
        message: payload?.message || "Export checkout created.",
        checkoutUrl: payload?.checkoutUrl || "",
        checkoutSessionId: payload?.checkoutSessionId || "",
        exportRequest: payload?.exportRequest ? mapExportRequest(payload.exportRequest) : null
      });
    } catch (error) {
      sendAccountRouteError(res, error);
    }
  });

  app.get("/api/account/options/export-requests/:id/download", async (req, res) => {
    if (!ensurePostgresMode(res, isPostgresMode)) return;
    if (!ensureAuthenticated(req, res)) return;
    if (!ensureAdminUser(req, res, "Only tenant administrators can download exports.")) return;

    try {
      const commercialSummary = commercialPolicyService
        ? await commercialPolicyService.getTenantCommercialSummary()
        : null;
      if (!commercialSummary?.subscriptionId) {
        const error = new Error("No active commercial subscription was found for this tenant.");
        error.statusCode = 404;
        throw error;
      }
      const payload = await controlPlaneClient.request(`/api/internal/commercial/subscriptions/${encodeURIComponent(commercialSummary.subscriptionId)}/cancellation-export/${encodeURIComponent(req.params.id)}/download`);
      const fileName = sanitizeDownloadFileName(payload?.fileName || `navigrader-export-${req.params.id}.json`);
      const content = Buffer.from(String(payload?.contentBase64 || ""), "base64");
      res.setHeader("Content-Type", payload?.contentType || "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.send(content);
    } catch (error) {
      sendAccountRouteError(res, error);
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
      ownerFirstName: summary.ownerFirstName || "",
      ownerLastName: summary.ownerLastName || "",
      ownerEmail: summary.ownerEmail || "",
      ownerPhone: summary.ownerPhone || "",
      billingEmail: summary.billingEmail || ""
    }
  };
}

function buildFriendlySiteId(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  const compact = normalized.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (compact.length <= 12) return compact || normalized;
  return compact.slice(-12);
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
  const expiresAtMs = request.artifactExpiresAt ? Date.parse(request.artifactExpiresAt) : Number.NaN;
  const canDownload = request.status === "ready" && (!Number.isFinite(expiresAtMs) || expiresAtMs > Date.now());
  return {
    id: request.id,
    status: request.status || "",
    priceCents: Number(request.priceCents || 0),
    currency: request.currency || "usd",
    requestedByEmail: request.requestedByEmail || "",
    canDownload,
    artifactExpiresAt: request.artifactExpiresAt || null,
    failureReason: request.failureReason || "",
    createdAt: request.createdAt || null,
    updatedAt: request.updatedAt || null
  };
}

function buildAccountReturnUrl(req, query) {
  const host = req.get("host");
  const protocol = req.protocol || "https";
  const normalizedQuery = String(query || "").replace(/^\?+/, "");
  return `${protocol}://${host}/${normalizedQuery ? `?${normalizedQuery}` : ""}`;
}

function sanitizeDownloadFileName(value) {
  const normalized = String(value || "navigrader-export.json").trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
  return normalized || "navigrader-export.json";
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

function sendAccountRouteError(res, error) {
  const statusCode = Number(error.statusCode || error.status || 500);
  const safeStatusCode = statusCode >= 400 && statusCode < 600 ? statusCode : 500;
  const isProduction = String(process.env.APP_ENV || "").toLowerCase() === "production";
  const message = safeStatusCode >= 500 && isProduction
    ? "Unexpected error."
    : (error.message || "Unexpected error.");
  if (safeStatusCode >= 500) {
    console.error(error);
  }
  res.status(safeStatusCode).json({ error: message });
}

function normalizeProfilePhotoDataUrl(value) {
  const dataUrl = String(value || "").trim();
  if (!dataUrl) return "";
  if (dataUrl.length > 240000) {
    const error = new Error("Profile photo is too large. Choose a smaller image.");
    error.statusCode = 400;
    throw error;
  }
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) {
    const error = new Error("Profile photo must be a PNG, JPG, or WebP image.");
    error.statusCode = 400;
    throw error;
  }
  return dataUrl;
}

module.exports = {
  registerAccountRoutes
};
