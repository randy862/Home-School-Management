const http = require("http");
const https = require("https");
const { createInternalServiceToken } = require("./internal-service-auth");

function createSetupSyncService(deps) {
  const {
    internalConfig,
    listSetupSyncCandidates,
    markTenantEnvironmentInitialized,
    timeoutMs
  } = deps;

  return {
    async reconcilePendingSetups() {
      const environments = await listSetupSyncCandidates();
      const updates = [];
      for (const environment of environments) {
        const status = await fetchSetupStatus(environment.appBaseUrl, timeoutMs, internalConfig);
        if (status?.initialized) {
          updates.push(await markTenantEnvironmentInitialized(environment.id, {
            source: "runtime_setup_status",
            appBaseUrl: environment.appBaseUrl,
            setupCompletedAt: status.setupCompletedAt || null
          }));
        }
      }
      return updates.filter(Boolean);
    },

    async syncEnvironment(environment) {
      const status = await fetchSetupStatus(environment.appBaseUrl, timeoutMs, internalConfig);
      if (!status?.initialized) {
        return {
          synchronized: false,
          initialized: false,
          environment
        };
      }
      const updatedEnvironment = await markTenantEnvironmentInitialized(environment.id, {
        source: "runtime_setup_status",
        appBaseUrl: environment.appBaseUrl,
        setupCompletedAt: status.setupCompletedAt || null
      });
      return {
        synchronized: true,
        initialized: true,
        environment: updatedEnvironment
      };
    }
  };
}

function fetchSetupStatus(appBaseUrl, timeoutMs, internalConfig) {
  const base = String(appBaseUrl || "").trim();
  if (!base) return Promise.resolve(null);
  const url = new URL("/api/internal/setup/status", base);
  const transport = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const request = transport.get(url, {
      headers: buildInternalAuthHeaders(internalConfig)
    }, (response) => {
      let body = "";
      response.on("data", (chunk) => {
        body += chunk.toString();
      });
      response.on("end", () => {
        if (response.statusCode && response.statusCode >= 400) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });

    request.setTimeout(timeoutMs, () => {
      request.destroy();
      resolve(null);
    });
    request.on("error", () => resolve(null));
  });
}

function buildInternalAuthHeaders(internalConfig) {
  const headers = {};
  const secret = String(internalConfig?.serviceAuthSecret || "").trim();
  if (secret) {
    headers.authorization = `Bearer ${createInternalServiceToken({
      secret,
      issuer: internalConfig?.serviceAuthIssuer,
      audience: internalConfig?.tenantRuntimeAudience,
      subject: "control-plane:setup-sync",
      ttlSeconds: internalConfig?.serviceAuthTtlSeconds
    })}`;
    return headers;
  }

  if (internalConfig?.allowLegacyApiKey && internalConfig?.apiKey) {
    headers["x-control-plane-key"] = String(internalConfig.apiKey || "");
  }
  return headers;
}

module.exports = {
  createSetupSyncService
};
