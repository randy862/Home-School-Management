const crypto = require("crypto");

function verifyInternalServiceToken(token, options = {}) {
  const normalizedToken = String(token || "").trim();
  const normalizedSecret = String(options.secret || "").trim();
  if (!normalizedToken || !normalizedSecret) {
    return { ok: false, reason: "missing_token_or_secret" };
  }

  const parts = normalizedToken.split(".");
  if (parts.length !== 3) {
    return { ok: false, reason: "malformed_token" };
  }

  const [encodedHeader, encodedPayload, providedSignature] = parts;
  const expectedSignature = signToken(`${encodedHeader}.${encodedPayload}`, normalizedSecret);
  if (!safeEqual(providedSignature, expectedSignature)) {
    return { ok: false, reason: "invalid_signature" };
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch (_error) {
    return { ok: false, reason: "invalid_payload" };
  }

  const now = Number(options.nowSeconds || Math.floor(Date.now() / 1000));
  const skew = Math.max(Number(options.clockSkewSeconds) || 0, 0);
  if (!payload.exp || Number(payload.exp) <= (now - skew)) {
    return { ok: false, reason: "token_expired" };
  }
  if (payload.iat && Number(payload.iat) > (now + skew)) {
    return { ok: false, reason: "token_from_future" };
  }

  const expectedAudience = String(options.expectedAudience || "").trim();
  if (expectedAudience && String(payload.aud || "").trim() !== expectedAudience) {
    return { ok: false, reason: "invalid_audience" };
  }

  const expectedIssuer = String(options.expectedIssuer || "").trim();
  if (expectedIssuer && String(payload.iss || "").trim() !== expectedIssuer) {
    return { ok: false, reason: "invalid_issuer" };
  }

  return { ok: true, claims: payload };
}

function parseBearerToken(authorizationHeader) {
  const header = String(authorizationHeader || "").trim();
  if (!header) return "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? String(match[1] || "").trim() : "";
}

function signToken(value, secret) {
  return base64UrlFromBuffer(
    crypto.createHmac("sha256", secret).update(String(value || ""), "utf8").digest()
  );
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function base64UrlDecode(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

function base64UrlFromBuffer(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

module.exports = {
  parseBearerToken,
  verifyInternalServiceToken
};
