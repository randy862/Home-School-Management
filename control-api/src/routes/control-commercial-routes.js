const { randomUUID } = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const { ensurePermission, sendRouteError } = require("./route-auth");
const { parseBearerToken, verifyInternalServiceToken } = require("../internal-service-auth");

function registerControlCommercialRoutes(app, deps) {
  const {
    createCancellationExportRequest,
    createOperatorAuditEntry,
    getCancellationExportRequestById,
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
    updateCancellationExportRequest,
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
      sendRouteError(res, error);
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
      if (!subscription.stripeSubscriptionId) {
        res.status(409).json({ error: "This subscription is not yet linked to an active Stripe subscription." });
        return;
      }
      const currentPlan = await getCommercialPlanById(subscription.commercialPlanId || overview.commercialPlanId);
      if (!currentPlan) {
        res.status(404).json({ error: "Current plan was not found." });
        return;
      }

      const now = Date.now();
      const currentPeriodEnd = subscription.currentPeriodEnd ? Date.parse(subscription.currentPeriodEnd) : Number.NaN;
      const dormantStatus = Number.isFinite(currentPeriodEnd) && currentPeriodEnd > now
        ? "pending_dormant"
        : "dormant";
      const dormantPriceCents = calculateDormantBasePriceCents(currentPlan);
      const stripeSubscription = await stripeService.updateSubscriptionBasePrice({
        subscriptionId: subscription.stripeSubscriptionId,
        productId: currentPlan.stripeProductId || "",
        unitAmountCents: dormantPriceCents,
        currency: currentPlan.currency || "usd",
        interval: currentPlan.billingInterval || "month",
        prorationBehavior: "none",
        cancelAtPeriodEnd: false,
        metadata: buildDormantStripeMetadata({
          currentPlan,
          dormantStatus,
          dormantPriceCents,
          requestedByUserId: req.body?.requestedByUserId || "",
          requestedByUsername: req.body?.requestedByUsername || ""
        })
      });

      const updated = await updateCommercialSubscription(subscription.id, {
        dormantStatus,
        status: normalizeStripeSubscriptionStatus(stripeSubscription.status),
        currentPeriodStart: toIsoFromUnixSeconds(stripeSubscription.current_period_start),
        currentPeriodEnd: toIsoFromUnixSeconds(stripeSubscription.current_period_end),
        basePriceCents: dormantPriceCents,
        includedBillableStudents: Number(currentPlan.limits?.includedBillableStudents || 0),
        perStudentOverageCents: Number(currentPlan.limits?.perStudentOverageCents || 0)
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
          dormantPriceCents,
          activeBasePriceCents: Number(currentPlan.priceCents || 0),
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
          planId: currentPlan.id,
          planCode: currentPlan.code,
          planName: currentPlan.name,
          billingInterval: currentPlan.billingInterval || "month",
          currency: currentPlan.currency || "usd"
        },
        lifecycleJob,
        stripeSync: {
          status: "applied",
          dormantPriceCents,
          activeBasePriceCents: Number(currentPlan.priceCents || 0),
          prorationBehavior: "none"
        }
      });
    } catch (error) {
      sendRouteError(res, error);
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
      const currentPlan = await getCommercialPlanById(subscription.commercialPlanId || overview.commercialPlanId);
      if (!currentPlan) {
        res.status(404).json({ error: "Current plan was not found." });
        return;
      }
      if (previousDormantStatus === "active") {
        res.json({
          message: "The site is already active.",
          subscription: buildControlSubscriptionResponse(subscription, overview, currentPlan),
          lifecycleJob: null
        });
        return;
      }
      if (!subscription.stripeSubscriptionId) {
        res.status(409).json({ error: "This subscription is not yet linked to an active Stripe subscription." });
        return;
      }
      if (!currentPlan.stripePriceId) {
        res.status(409).json({ error: "Current plan is not configured for Stripe billing restore." });
        return;
      }

      const stripeSubscription = await stripeService.updateSubscriptionPlan({
        subscriptionId: subscription.stripeSubscriptionId,
        priceId: currentPlan.stripePriceId,
        prorationBehavior: previousDormantStatus === "pending_dormant" ? "none" : "create_prorations",
        metadata: buildActiveStripeMetadata({
          currentPlan,
          previousDormantStatus,
          requestedByUserId: req.body?.requestedByUserId || "",
          requestedByUsername: req.body?.requestedByUsername || ""
        })
      });

      const updated = await updateCommercialSubscription(subscription.id, {
        dormantStatus: "active",
        status: normalizeStripeSubscriptionStatus(stripeSubscription.status),
        currentPeriodStart: toIsoFromUnixSeconds(stripeSubscription.current_period_start),
        currentPeriodEnd: toIsoFromUnixSeconds(stripeSubscription.current_period_end),
        basePriceCents: Number(currentPlan.priceCents || 0),
        includedBillableStudents: Number(currentPlan.limits?.includedBillableStudents || 0),
        perStudentOverageCents: Number(currentPlan.limits?.perStudentOverageCents || 0)
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
          activeBasePriceCents: Number(currentPlan.priceCents || 0),
          tenantEnvironmentId: overview.tenantEnvironmentId || null,
          lifecycleJobId: lifecycleJob?.id || null
        }
      });
      res.json({
        message: previousDormantStatus === "pending_dormant"
          ? "Dormant status was canceled. The site remains active."
          : "The site is now marked active.",
        subscription: buildControlSubscriptionResponse(updated, overview, currentPlan),
        lifecycleJob,
        stripeSync: {
          status: "applied",
          activeBasePriceCents: Number(currentPlan.priceCents || 0),
          prorationBehavior: previousDormantStatus === "pending_dormant" ? "none" : "create_prorations"
        }
      });
    } catch (error) {
      sendRouteError(res, error);
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
      sendRouteError(res, error);
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

      const requestedByEmail = req.body?.requestedByEmail || req.body?.requestedByUsername || overview.billingEmail || overview.ownerEmail || null;
      const exportRequest = await createCancellationExportRequest({
        customerAccountId: subscription.customerAccountId,
        customerSubscriptionId: subscription.id,
        requestedByEmail,
        priceCents: 1999
      });
      const stripeSession = await stripeService.createPaymentCheckoutSession({
        amountCents: exportRequest.priceCents,
        currency: exportRequest.currency,
        productName: "Navigrader Data Export",
        successUrl: normalizeRequiredCheckoutUrl(req.body?.successUrl),
        cancelUrl: normalizeRequiredCheckoutUrl(req.body?.cancelUrl),
        clientReferenceId: exportRequest.id,
        customerEmail: requestedByEmail,
        metadata: {
          purpose: "data_export",
          exportRequestId: exportRequest.id,
          customerAccountId: subscription.customerAccountId,
          customerSubscriptionId: subscription.id,
          tenantId: overview.tenantId || "",
          tenantEnvironmentId: overview.tenantEnvironmentId || ""
        }
      });
      const updatedExportRequest = await updateCancellationExportRequest(exportRequest.id, {
        paymentReference: stripeSession.id
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
          priceCents: updatedExportRequest.priceCents,
          requestedByEmail: updatedExportRequest.requestedByEmail || null,
          stripeCheckoutSessionId: stripeSession.id
        }
      });
      res.status(201).json({
        message: "Export checkout created. Complete payment to generate the export.",
        checkoutUrl: stripeSession.url,
        checkoutSessionId: stripeSession.id,
        exportRequest: updatedExportRequest
      });
    } catch (error) {
      sendRouteError(res, error);
    }
  });

  app.get("/api/internal/commercial/subscriptions/:id/cancellation-export/:exportRequestId/download", async (req, res) => {
    if (!ensureInternalCommercialRequest(req, res, internalConfig)) return;

    try {
      const subscription = await getCommercialSubscriptionById(req.params.id);
      const exportRequest = await getCancellationExportRequestById(req.params.exportRequestId);
      if (!subscription || !exportRequest || exportRequest.customerSubscriptionId !== subscription.id) {
        res.status(404).json({ error: "Export request not found." });
        return;
      }
      if (exportRequest.status !== "ready" || !exportRequest.artifactPath) {
        res.status(409).json({ error: "Export artifact is not ready for download." });
        return;
      }
      const expiresAtMs = exportRequest.artifactExpiresAt ? Date.parse(exportRequest.artifactExpiresAt) : Number.NaN;
      if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
        await updateCancellationExportRequest(exportRequest.id, {
          status: "expired",
          failureReason: "Export artifact expired."
        });
        res.status(410).json({ error: "Export artifact has expired." });
        return;
      }

      const artifactPath = resolveExportArtifactPath(exportRequest.artifactPath);
      const content = await fs.readFile(artifactPath);
      res.json({
        fileName: path.basename(artifactPath),
        contentType: exportArtifactContentType(artifactPath),
        contentBase64: content.toString("base64"),
        artifactExpiresAt: exportRequest.artifactExpiresAt || null
      });
    } catch (error) {
      sendRouteError(res, error);
    }
  });

  app.get("/api/control/commercial/overview", async (req, res) => {
    if (!ensurePermission(req, res, "manageCustomers", "Manage Customers permission required")) return;

    try {
      res.json(await listCommercialOverview());
    } catch (error) {
      sendRouteError(res, error);
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
      sendRouteError(res, error);
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
      if (!subscription.stripeSubscriptionId) {
        res.status(409).json({ error: "This subscription is not yet linked to an active Stripe subscription." });
        return;
      }
      const currentPlan = await getCommercialPlanById(subscription.commercialPlanId || overview.commercialPlanId);
      if (!currentPlan) {
        res.status(404).json({ error: "Current plan was not found." });
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
      const dormantPriceCents = calculateDormantBasePriceCents(currentPlan);
      const stripeSubscription = await stripeService.updateSubscriptionBasePrice({
        subscriptionId: subscription.stripeSubscriptionId,
        productId: currentPlan.stripeProductId || "",
        unitAmountCents: dormantPriceCents,
        currency: currentPlan.currency || "usd",
        interval: currentPlan.billingInterval || "month",
        prorationBehavior: "none",
        cancelAtPeriodEnd: false,
        metadata: buildDormantStripeMetadata({
          currentPlan,
          dormantStatus,
          dormantPriceCents,
          requestedByUserId: req.auth.user.id,
          requestedByUsername: req.auth.user.username || ""
        })
      });

      const updated = await updateCommercialSubscription(subscription.id, {
        dormantStatus,
        status: normalizeStripeSubscriptionStatus(stripeSubscription.status),
        currentPeriodStart: toIsoFromUnixSeconds(stripeSubscription.current_period_start),
        currentPeriodEnd: toIsoFromUnixSeconds(stripeSubscription.current_period_end),
        basePriceCents: dormantPriceCents,
        includedBillableStudents: Number(currentPlan.limits?.includedBillableStudents || 0),
        perStudentOverageCents: Number(currentPlan.limits?.perStudentOverageCents || 0)
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
          dormantPriceCents,
          activeBasePriceCents: Number(currentPlan.priceCents || 0),
          tenantEnvironmentId: overview.tenantEnvironmentId || null,
          lifecycleJobId: lifecycleJob?.id || null
        }
      });
      res.json({
        subscription: buildControlSubscriptionResponse(updated, overview, currentPlan),
        lifecycleJob,
        stripeSync: {
          status: "applied",
          dormantPriceCents,
          activeBasePriceCents: Number(currentPlan.priceCents || 0),
          prorationBehavior: "none"
        }
      });
    } catch (error) {
      sendRouteError(res, error);
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
      const previousDormantStatus = String(subscription.dormantStatus || overview.dormantStatus || "active").trim().toLowerCase() || "active";
      const currentPlan = await getCommercialPlanById(subscription.commercialPlanId || overview.commercialPlanId);
      if (!currentPlan) {
        res.status(404).json({ error: "Current plan was not found." });
        return;
      }
      if (previousDormantStatus === "active") {
        res.json({
          subscription: buildControlSubscriptionResponse(subscription, overview, currentPlan),
          lifecycleJob: null
        });
        return;
      }
      if (!subscription.stripeSubscriptionId) {
        res.status(409).json({ error: "This subscription is not yet linked to an active Stripe subscription." });
        return;
      }
      if (!currentPlan.stripePriceId) {
        res.status(409).json({ error: "Current plan is not configured for Stripe billing restore." });
        return;
      }

      if (previousDormantStatus === "dormant" && overview.tenantEnvironmentId) {
        if (!ensurePermission(req, res, "manageOperations", "Manage Operations permission required")) return;
      }
      const stripeSubscription = await stripeService.updateSubscriptionPlan({
        subscriptionId: subscription.stripeSubscriptionId,
        priceId: currentPlan.stripePriceId,
        prorationBehavior: previousDormantStatus === "pending_dormant" ? "none" : "create_prorations",
        metadata: buildActiveStripeMetadata({
          currentPlan,
          previousDormantStatus,
          requestedByUserId: req.auth.user.id,
          requestedByUsername: req.auth.user.username || ""
        })
      });

      const updated = await updateCommercialSubscription(subscription.id, {
        dormantStatus: "active",
        status: normalizeStripeSubscriptionStatus(stripeSubscription.status),
        currentPeriodStart: toIsoFromUnixSeconds(stripeSubscription.current_period_start),
        currentPeriodEnd: toIsoFromUnixSeconds(stripeSubscription.current_period_end),
        basePriceCents: Number(currentPlan.priceCents || 0),
        includedBillableStudents: Number(currentPlan.limits?.includedBillableStudents || 0),
        perStudentOverageCents: Number(currentPlan.limits?.perStudentOverageCents || 0)
      });

      let lifecycleJob = null;
      if (previousDormantStatus === "dormant" && overview.tenantEnvironmentId) {
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
          previousDormantStatus,
          dormantStatus: "active",
          activeBasePriceCents: Number(currentPlan.priceCents || 0),
          tenantEnvironmentId: overview.tenantEnvironmentId || null,
          lifecycleJobId: lifecycleJob?.id || null
        }
      });
      res.json({
        subscription: buildControlSubscriptionResponse(updated, overview, currentPlan),
        lifecycleJob,
        stripeSync: {
          status: "applied",
          activeBasePriceCents: Number(currentPlan.priceCents || 0),
          prorationBehavior: previousDormantStatus === "pending_dormant" ? "none" : "create_prorations"
        }
      });
    } catch (error) {
      sendRouteError(res, error);
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
      sendRouteError(res, error);
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

function createLifecycleJobPayload({ tenantId, tenantEnvironmentId, jobType, idempotencyKey, message, notes, payload = {} }) {
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
    idempotencyKey: idempotencyKey || null,
    maxAttempts: 3,
    message,
    payload: {
      notes: notes || "",
      ...payload
    }
  };
}

function normalizeRequiredCheckoutUrl(value) {
  const normalized = String(value || "").trim();
  if (!/^https?:\/\/[^ ]+$/i.test(normalized)) {
    const error = new Error("Checkout return URL is required.");
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

function resolveExportArtifactPath(artifactPath) {
  const exportDir = getExportArtifactDir();
  const resolved = path.resolve(String(artifactPath || ""));
  const relative = path.relative(exportDir, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    const error = new Error("Export artifact path is outside the configured export directory.");
    error.statusCode = 403;
    throw error;
  }
  return resolved;
}

function getExportArtifactDir() {
  return path.resolve(process.env.CONTROL_DATA_EXPORT_DIR || path.resolve(__dirname, "../../../runtime-bundles/data-exports"));
}

function exportArtifactContentType(artifactPath) {
  const extension = path.extname(String(artifactPath || "")).toLowerCase();
  if (extension === ".zip") return "application/zip";
  if (extension === ".csv") return "text/csv";
  return "application/json";
}

function calculateDormantBasePriceCents(plan) {
  const basePriceCents = Number(plan?.priceCents || 0);
  const percentage = Number(plan?.limits?.dormantBasePricePercentage ?? 25);
  if (!Number.isFinite(basePriceCents) || basePriceCents < 0) return 0;
  if (!Number.isFinite(percentage) || percentage < 0) return basePriceCents;
  return Math.max(0, Math.round(basePriceCents * (percentage / 100)));
}

function buildDormantStripeMetadata({ currentPlan, dormantStatus, dormantPriceCents, requestedByUserId, requestedByUsername }) {
  return {
    commercialPlanId: currentPlan.id,
    commercialPlanCode: currentPlan.code,
    dormantStatus,
    dormantBilling: "true",
    dormantBasePriceCents: dormantPriceCents,
    activeBasePriceCents: Number(currentPlan.priceCents || 0),
    requestedByUserId: requestedByUserId || "",
    requestedByUsername: requestedByUsername || ""
  };
}

function buildActiveStripeMetadata({ currentPlan, previousDormantStatus, requestedByUserId, requestedByUsername }) {
  return {
    commercialPlanId: currentPlan.id,
    commercialPlanCode: currentPlan.code,
    dormantStatus: "active",
    dormantBilling: "false",
    activeBasePriceCents: Number(currentPlan.priceCents || 0),
    previousDormantStatus: previousDormantStatus || "",
    requestedByUserId: requestedByUserId || "",
    requestedByUsername: requestedByUsername || ""
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
