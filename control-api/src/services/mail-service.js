function createMailService(config = {}, deps = {}) {
  const fetchImpl = deps.fetchImpl || globalThis.fetch;

  return {
    getReadiness() {
      return getReadiness(config);
    },

    async sendTemplateEmail(input = {}) {
      const toEmail = String(input.toEmail || "").trim().toLowerCase();
      if (!toEmail) {
        return buildResult({
          config,
          status: "failed",
          errorCode: "recipient_required",
          errorMessage: "Recipient email is required."
        });
      }

      const mode = normalizeMode(config.mode);
      if (mode === "log_only") {
        return buildResult({
          config,
          status: "logged",
          toEmail,
          subject: input.subject,
          metadata: input.metadata,
          recipientName: input.toName,
          skippedReason: "Mail delivery is in log-only mode."
        });
      }

      if (mode === "allowlist_only" && !isAllowlisted(toEmail, config.allowlist)) {
        return buildResult({
          config,
          status: "skipped",
          toEmail,
          subject: input.subject,
          metadata: input.metadata,
          recipientName: input.toName,
          skippedReason: "Recipient is outside the configured mail allowlist."
        });
      }

      const readiness = getReadiness(config);
      if (!readiness.ready || typeof fetchImpl !== "function") {
        const missing = readiness.ready
          ? ["Global fetch is required for outbound mail delivery."]
          : readiness.missing;
        return buildResult({
          config,
          status: "failed",
          toEmail,
          subject: input.subject,
          metadata: input.metadata,
          recipientName: input.toName,
          errorCode: "config_incomplete",
          errorMessage: missing.join("; ")
        });
      }

      if (String(config.provider || "").trim().toLowerCase() !== "postmark") {
        return buildResult({
          config,
          status: "failed",
          toEmail,
          subject: input.subject,
          metadata: input.metadata,
          recipientName: input.toName,
          errorCode: "provider_not_supported",
          errorMessage: `Unsupported mail provider: ${config.provider || "unknown"}.`
        });
      }

      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timeout = controller
        ? setTimeout(() => controller.abort(), Number(config.requestTimeoutMs || 10000))
        : null;

      try {
        const response = await fetchImpl("https://api.postmarkapp.com/email", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Postmark-Server-Token": config.postmarkServerToken
          },
          body: JSON.stringify({
            From: formatFromHeader(config.fromName, config.fromEmail),
            To: formatRecipientHeader(input.toName, toEmail),
            ReplyTo: config.replyToEmail || undefined,
            Subject: String(input.subject || "").trim(),
            HtmlBody: String(input.htmlBody || "").trim(),
            TextBody: String(input.textBody || "").trim() || undefined,
            Tag: String(input.tag || "").trim() || undefined,
            MessageStream: String(config.postmarkMessageStream || "").trim() || undefined,
            Metadata: sanitizeMetadata(input.metadata)
          }),
          signal: controller?.signal
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || Number(payload.ErrorCode || 0) !== 0) {
          return buildResult({
            config,
            status: "failed",
            toEmail,
            subject: input.subject,
            metadata: input.metadata,
            recipientName: input.toName,
            errorCode: `postmark_${payload.ErrorCode || response.status || "request_failed"}`,
            errorMessage: payload.Message || `Postmark request failed (${response.status}).`
          });
        }
        return buildResult({
          config,
          status: "sent",
          toEmail,
          subject: input.subject,
          metadata: input.metadata,
          recipientName: input.toName,
          providerMessageId: payload.MessageID || null,
          deliveredAt: new Date().toISOString()
        });
      } catch (error) {
        return buildResult({
          config,
          status: "failed",
          toEmail,
          subject: input.subject,
          metadata: input.metadata,
          recipientName: input.toName,
          errorCode: error?.name === "AbortError" ? "request_timeout" : "request_failed",
          errorMessage: error?.message || "Outbound mail request failed."
        });
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    }
  };
}

function getReadiness(config = {}) {
  const missing = [];
  const provider = String(config.provider || "").trim().toLowerCase();
  const mode = normalizeMode(config.mode);
  if (!["log_only", "allowlist_only", "real_send"].includes(mode)) {
    missing.push("CONTROL_MAIL_MODE must be one of log_only, allowlist_only, or real_send.");
  }
  if (!config.fromEmail) {
    missing.push("CONTROL_MAIL_FROM_EMAIL is required.");
  }
  if (provider !== "postmark") {
    missing.push("CONTROL_MAIL_PROVIDER must be postmark.");
  }
  if (mode !== "log_only" && !config.postmarkServerToken) {
    missing.push("CONTROL_MAIL_POSTMARK_SERVER_TOKEN is required for Postmark delivery.");
  }
  return {
    ready: missing.length === 0,
    provider,
    mode,
    missing
  };
}

function buildResult({
  config,
  status,
  toEmail = "",
  subject = "",
  metadata = null,
  recipientName = "",
  providerMessageId = null,
  deliveredAt = null,
  skippedReason = null,
  errorCode = null,
  errorMessage = null
}) {
  return {
    provider: String(config.provider || "").trim().toLowerCase() || "postmark",
    providerServerName: String(config.postmarkServerName || "").trim() || null,
    mode: normalizeMode(config.mode),
    status,
    toEmail,
    recipientName: recipientName || null,
    subject: String(subject || "").trim(),
    providerMessageId,
    deliveredAt,
    skippedReason,
    errorCode,
    errorMessage,
    metadata: sanitizeMetadata(metadata)
  };
}

function formatFromHeader(fromName, fromEmail) {
  const email = String(fromEmail || "").trim();
  const name = String(fromName || "").trim();
  return name ? `${name} <${email}>` : email;
}

function formatRecipientHeader(name, email) {
  const normalizedName = String(name || "").trim();
  return normalizedName ? `${normalizedName} <${email}>` : email;
}

function normalizeMode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "real_send") return "real_send";
  if (normalized === "allowlist_only") return "allowlist_only";
  return "log_only";
}

function isAllowlisted(email, allowlist = []) {
  if (!Array.isArray(allowlist) || !allowlist.length) return false;
  return allowlist.some((allowed) => String(allowed || "").trim().toLowerCase() === String(email || "").trim().toLowerCase());
}

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return Object.entries(metadata).reduce((acc, [key, value]) => {
    if (!key) return acc;
    if (value == null) return acc;
    acc[String(key)] = String(value);
    return acc;
  }, {});
}

module.exports = {
  createMailService
};
