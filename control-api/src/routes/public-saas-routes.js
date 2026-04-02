const { randomUUID } = require("crypto");

function registerPublicSaasRoutes(app, deps) {
  const {
    createCheckoutCustomerAccount,
    createCheckoutSessionRecord,
    createCheckoutSubscription,
    getPublicSignupStatusByToken,
    processStripeBillingEvent,
    getPublicCommercialPlanByCode,
    listPublicCommercialPlans,
    publicConfig,
    stripeService
  } = deps;

  app.get("/api/public/plans", async (_req, res) => {
    try {
      const plans = await listPublicCommercialPlans();
      res.json({ plans });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/public/checkout/session", async (req, res) => {
    try {
      const payload = normalizeCheckoutSessionPayload(req.body);
      const plan = await getPublicCommercialPlanByCode(payload.planCode);
      if (!plan) {
        res.status(404).json({ error: "Selected plan was not found." });
        return;
      }
      if (!plan.stripePriceId) {
        res.status(409).json({ error: "Selected plan is not yet configured for Stripe checkout." });
        return;
      }

      const successToken = randomUUID();
      const cancelToken = randomUUID();
      const customerAccount = await createCheckoutCustomerAccount(payload);
      const successUrl = buildCheckoutUrl(
        publicConfig.checkoutSuccessUrl || joinUrl(publicConfig.appBaseUrl, "/signup-status.html?checkout=success"),
        successToken
      );
      const cancelUrl = buildCheckoutUrl(
        publicConfig.checkoutCancelUrl || joinUrl(publicConfig.appBaseUrl, "/signup-status.html?checkout=cancel"),
        cancelToken
      );

      const stripeSession = await stripeService.createCheckoutSession({
        priceId: plan.stripePriceId,
        successUrl,
        cancelUrl,
        clientReferenceId: customerAccount.id,
        customerEmail: payload.ownerEmail,
        metadata: {
          customerAccountId: customerAccount.id,
          commercialPlanId: plan.id,
          commercialPlanCode: plan.code,
          requestedSubdomainLabel: payload.requestedSubdomainLabel || "",
          successToken
        }
      });

      const subscription = await createCheckoutSubscription({
        customerAccountId: customerAccount.id,
        commercialPlanId: plan.id,
        stripeCheckoutSessionId: stripeSession.id
      });
      const checkoutSession = await createCheckoutSessionRecord({
        customerAccountId: customerAccount.id,
        commercialPlanId: plan.id,
        stripeCheckoutSessionId: stripeSession.id,
        stripeCheckoutUrl: stripeSession.url,
        requestedSubdomainLabel: payload.requestedSubdomainLabel,
        successToken,
        cancelToken,
        expiresAt: stripeSession.expiresAt
      });

      res.status(201).json({
        checkoutSessionId: checkoutSession.stripeCheckoutSessionId,
        checkoutUrl: checkoutSession.stripeCheckoutUrl,
        successToken: checkoutSession.successToken,
        customerAccountId: customerAccount.id,
        customerSubscriptionId: subscription.id,
        publishableKeyConfigured: !!publicConfig.publishableKey
      });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.get("/api/public/signup-status/:token", async (req, res) => {
    try {
      const token = String(req.params?.token || "").trim();
      if (!token) {
        res.status(400).json({ error: "Signup status token is required." });
        return;
      }

      const status = await getPublicSignupStatusByToken(token);
      if (!status) {
        res.status(404).json({ error: "Signup status was not found for that token." });
        return;
      }

      res.json(status);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.post("/api/public/billing/webhook", async (req, res) => {
    try {
      const payloadBuffer = req.rawBody;
      if (!payloadBuffer || !Buffer.isBuffer(payloadBuffer)) {
        res.status(400).json({ error: "Raw webhook body is required." });
        return;
      }

      const event = stripeService.verifyWebhookEvent(payloadBuffer, req.headers["stripe-signature"]);
      const result = await processStripeBillingEvent(event);
      res.json({
        ok: true,
        eventId: event.id,
        duplicate: !!result.duplicate,
        processingStatus: result.processingStatus || "processed"
      });
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });
}

function normalizeCheckoutSessionPayload(input) {
  const planCode = String(input?.planCode || "").trim().toLowerCase();
  const accountName = String(input?.accountName || "").trim();
  const requestedSubdomainLabel = normalizeSubdomainLabel(input?.requestedSubdomainLabel);
  const ownerFirstName = String(input?.ownerFirstName || "").trim();
  const ownerLastName = String(input?.ownerLastName || "").trim();
  const ownerEmail = String(input?.ownerEmail || "").trim().toLowerCase();
  const ownerPhone = String(input?.ownerPhone || "").trim();
  const billingEmail = String(input?.billingEmail || "").trim().toLowerCase();

  if (!planCode) {
    const error = new Error("Plan code is required.");
    error.statusCode = 400;
    throw error;
  }
  if (!accountName) {
    const error = new Error("Account name is required.");
    error.statusCode = 400;
    throw error;
  }
  if (!ownerFirstName || !ownerLastName) {
    const error = new Error("Owner first and last name are required.");
    error.statusCode = 400;
    throw error;
  }
  if (!isValidEmail(ownerEmail)) {
    const error = new Error("Provide a valid owner email address.");
    error.statusCode = 400;
    throw error;
  }
  if (billingEmail && !isValidEmail(billingEmail)) {
    const error = new Error("Provide a valid billing email address.");
    error.statusCode = 400;
    throw error;
  }

  return {
    planCode,
    accountName,
    requestedSubdomainLabel,
    ownerFirstName,
    ownerLastName,
    ownerEmail,
    ownerPhone,
    billingEmail
  };
}

function normalizeSubdomainLabel(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  if (!normalized) return "";
  if (!/^[a-z0-9-]{3,40}$/.test(normalized)) {
    const error = new Error("Requested subdomain label must be 3-40 characters using lowercase letters, numbers, or hyphens.");
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function joinUrl(base, path) {
  const normalizedBase = String(base || "").trim().replace(/\/+$/, "");
  const normalizedPath = String(path || "").trim();
  if (!normalizedBase) {
    const error = new Error("Public app base URL is not configured.");
    error.statusCode = 503;
    throw error;
  }
  return `${normalizedBase}${normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`}`;
}

function buildCheckoutUrl(baseUrl, token) {
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
}

module.exports = {
  registerPublicSaasRoutes
};
