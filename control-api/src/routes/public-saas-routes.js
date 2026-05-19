const { randomUUID } = require("crypto");

const TERMS_VERSION = "1.0";
const PRIVACY_VERSION = "1.0";

function registerPublicSaasRoutes(app, deps) {
  const {
    createLegalAcceptance,
    createCheckoutCustomerAccount,
    createCheckoutSessionRecord,
    createCheckoutSubscription,
    findCheckoutNameConflicts,
    getPublicSignupStatusByToken,
    processStripeBillingEvent,
    getPublicCommercialPlanByCode,
    listPublicCommercialPlans,
    publicConfig,
    stripeService,
    updateLegalAcceptance
  } = deps;

  app.get("/api/public/plans", async (_req, res) => {
    try {
      const plans = await listPublicCommercialPlans();
      res.json({ plans });
    } catch (error) {
      sendRouteError(res, error);
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

      const conflicts = findCheckoutNameConflicts
        ? await findCheckoutNameConflicts(payload, { domainSuffix: publicConfig.defaultDomainSuffix })
        : [];
      if (conflicts.length) {
        res.status(409).json({
          error: buildCheckoutConflictMessage(conflicts),
          conflicts
        });
        return;
      }

      const successToken = randomUUID();
      const cancelToken = randomUUID();
      const customerAccount = await createCheckoutCustomerAccount(payload);
      const legalAcceptance = await createLegalAcceptance({
        customerAccountId: customerAccount.id,
        email: payload.ownerEmail,
        organizationName: payload.accountName,
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        acceptedAt: new Date().toISOString(),
        ipAddress: resolveRequestIp(req),
        userAgent: String(req.get("user-agent") || "").trim()
      });
      const successUrl = buildCheckoutUrl(
        publicConfig.checkoutSuccessUrl || joinUrl(publicConfig.appBaseUrl, "/signup-status.html?checkout=success"),
        successToken
      );
      const cancelUrl = buildCheckoutUrl(
        publicConfig.checkoutCancelUrl || joinUrl(publicConfig.appBaseUrl, "/signup-status.html?checkout=cancel"),
        cancelToken
      );
      const termsUrl = joinUrl(publicConfig.appBaseUrl, "/terms");
      const privacyUrl = joinUrl(publicConfig.appBaseUrl, "/privacy");

      const stripeSession = await stripeService.createCheckoutSession({
        priceId: plan.stripePriceId,
        successUrl,
        cancelUrl,
        termsUrl,
        privacyUrl,
        clientReferenceId: customerAccount.id,
        customerEmail: payload.ownerEmail,
        metadata: {
          customerAccountId: customerAccount.id,
          commercialPlanId: plan.id,
          commercialPlanCode: plan.code,
          legalAcceptanceId: legalAcceptance.id,
          termsVersion: TERMS_VERSION,
          privacyVersion: PRIVACY_VERSION,
          requestedSubdomainLabel: payload.requestedSubdomainLabel || "",
          successToken
        },
        requireTermsConsent: true
      });

      const subscription = await createCheckoutSubscription({
        customerAccountId: customerAccount.id,
        commercialPlanId: plan.id,
        stripeCheckoutSessionId: stripeSession.id
      });
      await updateLegalAcceptance(legalAcceptance.id, {
        customerSubscriptionId: subscription.id,
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
      sendRouteError(res, error);
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
      sendRouteError(res, error);
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
      sendRouteError(res, error);
    }
  });
}

function buildCheckoutConflictMessage(conflicts) {
  const fields = new Set((conflicts || []).map((conflict) => conflict.field));
  if (fields.has("accountName") && fields.has("requestedSubdomainLabel")) {
    return "That organization name and tenant name are already in use. Choose different names before continuing to checkout.";
  }
  if (fields.has("accountName")) {
    return "That organization name is already in use. Choose a different organization name before continuing to checkout.";
  }
  if (fields.has("requestedSubdomainLabel")) {
    return "That tenant name is already in use. Choose a different tenant name before continuing to checkout.";
  }
  return "One or more checkout names are already in use. Choose different names before continuing to checkout.";
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
  const legalAcceptance = normalizeLegalAcceptance(input?.legalAcceptance || {});

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
  if (!isValidPhone(ownerPhone)) {
    const error = new Error("Provide a valid owner phone number.");
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
    billingEmail,
    legalAcceptance
  };
}

function normalizeLegalAcceptance(input = {}) {
  const termsAccepted = input.termsAccepted === true || input.termsAccepted === "true";
  const privacyAccepted = input.privacyAccepted === true || input.privacyAccepted === "true";
  const termsVersion = String(input.termsVersion || "").trim();
  const privacyVersion = String(input.privacyVersion || "").trim();

  if (!termsAccepted || !privacyAccepted) {
    const error = new Error("Terms of Service and Privacy Policy acceptance is required before checkout.");
    error.statusCode = 400;
    throw error;
  }
  if (termsVersion !== TERMS_VERSION || privacyVersion !== PRIVACY_VERSION) {
    const error = new Error("The legal policy version changed. Refresh the page and accept the current Terms and Privacy Policy.");
    error.statusCode = 409;
    throw error;
  }

  return {
    termsAccepted,
    privacyAccepted,
    termsVersion,
    privacyVersion
  };
}

function legalAcceptanceRequiresUpdate(record, current = { termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION }) {
  if (!record) return true;
  return String(record.termsVersion || "") !== current.termsVersion
    || String(record.privacyVersion || "") !== current.privacyVersion
    || record.termsAccepted !== true
    || record.privacyAccepted !== true;
}

function resolveRequestIp(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return forwardedFor[0] || String(req.ip || req.socket?.remoteAddress || "").trim();
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

function isValidPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
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

function sendRouteError(res, error) {
  const statusCode = Number(error.statusCode || error.status || 500);
  const safeStatusCode = statusCode >= 400 && statusCode < 600 ? statusCode : 500;
  const isProduction = String(process.env.CONTROL_APP_ENV || process.env.APP_ENV || "").toLowerCase() === "production";
  const message = safeStatusCode >= 500 && isProduction
    ? "Unexpected error."
    : (error.message || "Unexpected error.");
  if (safeStatusCode >= 500) console.error(error);
  res.status(safeStatusCode).json({ error: message });
}

module.exports = {
  registerPublicSaasRoutes
};
