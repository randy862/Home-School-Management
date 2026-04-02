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

    const response = await fetch(`${this.apiBaseUrl}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });

    const payload = await response.json();
    if (!response.ok) {
      const error = new Error(payload?.error?.message || `Stripe checkout session creation failed (${response.status}).`);
      error.statusCode = 502;
      error.details = payload;
      throw error;
    }

    return {
      id: payload.id,
      url: payload.url,
      expiresAt: payload.expires_at ? new Date(payload.expires_at * 1000).toISOString() : null
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
}

function createStripeService(config) {
  return new StripeService(config);
}

module.exports = {
  createStripeService
};
