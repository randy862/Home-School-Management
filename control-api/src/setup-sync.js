const http = require("http");
const https = require("https");

function createSetupSyncService(deps) {
  const {
    controlPlaneKey,
    listSetupSyncCandidates,
    markTenantEnvironmentInitialized,
    timeoutMs
  } = deps;

  return {
    async reconcilePendingSetups() {
      const environments = await listSetupSyncCandidates();
      const updates = [];
      for (const environment of environments) {
        const status = await fetchSetupStatus(environment.appBaseUrl, timeoutMs, controlPlaneKey);
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
      const status = await fetchSetupStatus(environment.appBaseUrl, timeoutMs, controlPlaneKey);
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

function fetchSetupStatus(appBaseUrl, timeoutMs, controlPlaneKey) {
  const base = String(appBaseUrl || "").trim();
  if (!base) return Promise.resolve(null);
  const url = new URL("/api/internal/setup/status", base);
  const transport = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const request = transport.get(url, {
      headers: {
        "x-control-plane-key": String(controlPlaneKey || "")
      }
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

module.exports = {
  createSetupSyncService
};
