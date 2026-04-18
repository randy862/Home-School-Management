const { createInternalServiceToken } = require("../internal-service-auth");

function createControlPlaneClient({ internalConfig }) {
  const baseUrl = String(internalConfig?.controlPlaneBaseUrl || "http://127.0.0.1:3100").trim().replace(/\/+$/, "");
  const legacyKey = String(internalConfig?.controlPlaneKey || "").trim();
  const serviceAuthSecret = String(internalConfig?.serviceAuthSecret || "").trim();
  const issuer = String(internalConfig?.controlPlaneIssuer || "control-plane").trim() || "control-plane";
  const audience = String(internalConfig?.expectedAudience || "tenant-runtime-internal").trim() || "tenant-runtime-internal";

  return {
    async request(path, options = {}) {
      const url = `${baseUrl}${String(path || "").startsWith("/") ? path : `/${path}`}`;
      const headers = {
        Accept: "application/json",
        ...(options.headers || {})
      };

      if (serviceAuthSecret) {
        headers.Authorization = `Bearer ${createInternalServiceToken({
          secret: serviceAuthSecret,
          issuer,
          audience,
          subject: "tenant-runtime"
        })}`;
      } else if (legacyKey) {
        headers["x-control-plane-key"] = legacyKey;
      }

      const response = await fetch(url, {
        method: options.method || "GET",
        headers,
        body: options.body
      });
      const payload = await parseControlPlanePayload(response);
      if (!response.ok) {
        const error = new Error(payload?.error || payload?.message || `Control-plane request failed (${response.status}).`);
        error.statusCode = response.status;
        error.details = payload;
        throw error;
      }
      return payload;
    }
  };
}

async function parseControlPlanePayload(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

module.exports = {
  createControlPlaneClient
};
