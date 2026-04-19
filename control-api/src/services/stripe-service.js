const crypto = require("crypto");

class StripeService {
  constructor(config = {}) {
    this.secretKey = String(config.secretKey || "").trim();
    this.webhookSecret = String(config.webhookSecret || "").trim();
    this.apiBaseUrl = String(config.apiBaseUrl || "https://api.stripe.com/v1").trim() || "https://api.stripe.com/v1";
  }

  ensureConfigured() {
    if (!this.secretKey) {
      const error = new Error("Stripe secret key is not configured.");
      error.statusCode = 503;
      throw error;
    }
  }

  async createCheckoutSession(input) {
    this.ensureConfigured();

    const params = new URLSearchParams();
    params.set("mode", "subscription");
    params.set("success_url", input.successUrl);
    params.set("cancel_url", input.cancelUrl);
    params.set("line_items[0][price]", input.priceId);
    params.set("line_items[0][quantity]", "1");
    params.set("client_reference_id", input.clientReferenceId);
    params.set("customer_email", input.customerEmail);

    Object.entries(input.metadata || {}).forEach(([key, value]) => {
      if (value == null || value === "") return;
      params.set(`metadata[${key}]`, String(value));
      params.set(`subscription_data[metadata][${key}]`, String(value));
    });

    const payload = await this.requestStripe("/checkout/sessions", {
      method: "POST",
      body: params
    }, "Stripe checkout session creation failed");

    return {
      id: payload.id,
      url: payload.url,
      expiresAt: payload.expires_at ? new Date(payload.expires_at * 1000).toISOString() : null
    };
  }

  async getSubscription(subscriptionId) {
    this.ensureConfigured();
    const normalizedId = String(subscriptionId || "").trim();
    if (!normalizedId) {
      const error = new Error("Stripe subscription id is required.");
      error.statusCode = 400;
      throw error;
    }

    const response = await fetch(`${this.apiBaseUrl}/subscriptions/${encodeURIComponent(normalizedId)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.secretKey}`
      }
    });
    const payload = await response.json();
    if (!response.ok) {
      const error = new Error(payload?.error?.message || `Stripe subscription fetch failed (${response.status}).`);
      error.statusCode = 502;
      error.details = payload;
      throw error;
    }
    return payload;
  }

  async updateSubscriptionPlan(input) {
    this.ensureConfigured();
    const subscriptionId = String(input?.subscriptionId || "").trim();
    const priceId = String(input?.priceId || "").trim();
    if (!subscriptionId || !priceId) {
      const error = new Error("Stripe subscription id and target price id are required.");
      error.statusCode = 400;
      throw error;
    }

    const subscription = await this.getSubscription(subscriptionId);
    const primaryItem = subscription?.items?.data?.[0];
    if (!primaryItem?.id) {
      const error = new Error("Stripe subscription item details were not available for this subscription.");
      error.statusCode = 502;
      throw error;
    }

    const params = new URLSearchParams();
    params.set("items[0][id]", primaryItem.id);
    params.set("items[0][price]", priceId);
    params.set("proration_behavior", input.prorationBehavior || "create_prorations");
    params.set("cancel_at_period_end", "false");

    Object.entries(input.metadata || {}).forEach(([key, value]) => {
      if (value == null || value === "") return;
      params.set(`metadata[${key}]`, String(value));
    });

    return this.requestStripe(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: "POST",
      body: params
    }, "Stripe subscription update failed");
  }

  async syncSubscriptionOverageItem(input) {
    this.ensureConfigured();
    const subscriptionId = String(input?.subscriptionId || "").trim();
    if (!subscriptionId) {
      const error = new Error("Stripe subscription id is required for overage sync.");
      error.statusCode = 400;
      throw error;
    }

    const quantity = Math.max(0, Number.parseInt(input?.quantity, 10) || 0);
    const subscription = await this.getSubscription(subscriptionId);
    const existingItem = findOverageSubscriptionItem(subscription, {
      existingItemId: input?.existingItemId,
      priceId: input?.priceId,
      unitAmountCents: input?.unitAmountCents
    });

    if (quantity <= 0) {
      if (!existingItem?.id) {
        return {
          action: "noop",
          quantity: 0,
          overageItemId: null,
          stripeSubscriptionId: subscriptionId
        };
      }

      await this.requestStripe(`/subscription_items/${encodeURIComponent(existingItem.id)}`, {
        method: "DELETE",
        body: buildSubscriptionItemMutationParams({
          prorationBehavior: input?.prorationBehavior
        })
      }, "Stripe overage subscription item deletion failed");

      return {
        action: "deleted",
        quantity: 0,
        overageItemId: null,
        stripeSubscriptionId: subscriptionId
      };
    }

    if (existingItem?.id) {
      const updateParams = buildSubscriptionItemMutationParams({
        quantity,
        priceId: shouldUpdateOveragePrice(existingItem, input) ? input?.priceId : "",
        prorationBehavior: input?.prorationBehavior,
        metadata: {
          billing_role: "overage",
          customer_subscription_id: input?.customerSubscriptionId,
          commercial_plan_id: input?.commercialPlanId
        }
      });

      await this.requestStripe(`/subscription_items/${encodeURIComponent(existingItem.id)}`, {
        method: "POST",
        body: updateParams
      }, "Stripe overage subscription item update failed");

      return {
        action: "updated",
        quantity,
        overageItemId: existingItem.id,
        stripeSubscriptionId: subscriptionId
      };
    }

    const createParams = buildSubscriptionItemMutationParams({
      subscriptionId,
      priceId: input?.priceId,
      quantity,
      prorationBehavior: input?.prorationBehavior,
      metadata: {
        billing_role: "overage",
        customer_subscription_id: input?.customerSubscriptionId,
        commercial_plan_id: input?.commercialPlanId
      }
    });

    if (!String(input?.priceId || "").trim()) {
      const productId = String(input?.productId || resolveStripeSubscriptionProductId(subscription) || "").trim();
      const unitAmountCents = Number.parseInt(input?.unitAmountCents, 10);
      const currency = String(input?.currency || "").trim().toLowerCase();
      const interval = String(input?.interval || "").trim().toLowerCase();
      if (!productId || !Number.isInteger(unitAmountCents) || unitAmountCents <= 0 || !currency || !interval) {
        const error = new Error("Stripe overage pricing is not fully configured for this plan.");
        error.statusCode = 409;
        throw error;
      }
      createParams.set("price_data[product]", productId);
      createParams.set("price_data[currency]", currency);
      createParams.set("price_data[unit_amount]", String(unitAmountCents));
      createParams.set("price_data[recurring][interval]", interval);
    }

    const created = await this.requestStripe("/subscription_items", {
      method: "POST",
      body: createParams
    }, "Stripe overage subscription item creation failed");

    return {
      action: "created",
      quantity,
      overageItemId: created?.id || null,
      stripeSubscriptionId: subscriptionId
    };
  }

  verifyWebhookEvent(payloadBuffer, signatureHeader) {
    if (!this.webhookSecret) {
      const error = new Error("Stripe webhook secret is not configured.");
      error.statusCode = 503;
      throw error;
    }
    const header = String(signatureHeader || "").trim();
    if (!header) {
      const error = new Error("Missing Stripe signature header.");
      error.statusCode = 400;
      throw error;
    }

    const timestampPart = header.split(",").find((part) => part.startsWith("t="));
    const signaturePart = header.split(",").find((part) => part.startsWith("v1="));
    if (!timestampPart || !signaturePart) {
      const error = new Error("Invalid Stripe signature header.");
      error.statusCode = 400;
      throw error;
    }

    const timestamp = timestampPart.slice(2);
    const expected = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(`${timestamp}.${payloadBuffer.toString("utf8")}`)
      .digest("hex");
    const received = signaturePart.slice(3);
    const expectedBuffer = Buffer.from(expected, "utf8");
    const receivedBuffer = Buffer.from(received, "utf8");

    if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
      const error = new Error("Stripe signature verification failed.");
      error.statusCode = 400;
      throw error;
    }

    return JSON.parse(payloadBuffer.toString("utf8"));
  }

  async requestStripe(path, options = {}, fallbackMessage) {
    this.ensureConfigured();
    const headers = {
      Authorization: `Bearer ${this.secretKey}`,
      ...(options.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(options.headers || {})
    };
    const body = options.body instanceof URLSearchParams ? options.body.toString() : options.body;
    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      method: options.method || "GET",
      headers,
      body
    });
    const payload = await response.json();
    if (!response.ok) {
      const error = new Error(payload?.error?.message || `${fallbackMessage || "Stripe request failed"} (${response.status}).`);
      error.statusCode = 502;
      error.details = payload;
      throw error;
    }
    return payload;
  }
}

function buildSubscriptionItemMutationParams(input = {}) {
  const params = new URLSearchParams();
  if (input.subscriptionId) params.set("subscription", input.subscriptionId);
  if (input.priceId) params.set("price", input.priceId);
  if (Number.isInteger(input.quantity)) params.set("quantity", String(input.quantity));
  if (input.prorationBehavior) params.set("proration_behavior", input.prorationBehavior);
  Object.entries(input.metadata || {}).forEach(([key, value]) => {
    if (value == null || value === "") return;
    params.set(`metadata[${key}]`, String(value));
  });
  return params;
}

function resolveStripeSubscriptionProductId(subscription) {
  const primaryItem = subscription?.items?.data?.[0];
  const product = primaryItem?.price?.product;
  if (typeof product === "string") return product;
  if (product && typeof product === "object" && product.id) return String(product.id);
  return "";
}

function findOverageSubscriptionItem(subscription, input = {}) {
  const items = Array.isArray(subscription?.items?.data) ? subscription.items.data : [];
  const existingItemId = String(input?.existingItemId || "").trim();
  if (existingItemId) {
    const exact = items.find((item) => String(item?.id || "").trim() === existingItemId);
    if (exact) return exact;
  }

  const metadataMatch = items.find((item) => String(item?.metadata?.billing_role || "").trim().toLowerCase() === "overage");
  if (metadataMatch) return metadataMatch;

  const priceId = String(input?.priceId || "").trim();
  if (priceId) {
    const priceMatch = items.find((item) => String(item?.price?.id || "").trim() === priceId);
    if (priceMatch) return priceMatch;
  }

  const unitAmountCents = Number.parseInt(input?.unitAmountCents, 10);
  if (Number.isInteger(unitAmountCents) && unitAmountCents > 0) {
    const amountMatch = items.find((item) => Number(item?.price?.unit_amount) === unitAmountCents);
    if (amountMatch) return amountMatch;
  }

  return null;
}

function shouldUpdateOveragePrice(existingItem, input = {}) {
  const targetPriceId = String(input?.priceId || "").trim();
  if (!targetPriceId) return false;
  return String(existingItem?.price?.id || "").trim() !== targetPriceId;
}

function createStripeService(config) {
  return new StripeService(config);
}

module.exports = {
  createStripeService
};
