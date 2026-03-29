function registerRuntimeRoutes(app, deps) {
  const {
    internalConfig,
    resolveTenantRuntimeByHost
  } = deps;

  app.get("/api/runtime/resolve", async (req, res) => {
    try {
      const host = normalizeRequestedHost(req);
      if (!host) {
        res.status(400).json({ error: "A host or Host header is required." });
        return;
      }

      const runtime = await resolveTenantRuntimeByHost(host, {
        environmentKey: normalizeEnvironmentKey(req.query?.environmentKey)
      });
      if (!runtime) {
        res.status(404).json({ error: "Tenant runtime not found." });
        return;
      }

      res.json({
        tenantId: runtime.tenantId,
        tenantSlug: runtime.tenantSlug,
        tenantDisplayName: runtime.tenantDisplayName,
        environmentId: runtime.environmentId,
        environmentKey: runtime.environmentKey,
        environmentDisplayName: runtime.environmentDisplayName,
        status: runtime.status,
        setupState: runtime.setupState,
        appBaseUrl: runtime.appBaseUrl,
        resolvedHost: runtime.domain,
        resolvedBy: runtime.domainType
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/internal/runtime/resolve", async (req, res) => {
    if (!ensureInternalRequest(req, res, internalConfig)) return;

    try {
      const host = normalizeRequestedHost(req);
      if (!host) {
        res.status(400).json({ error: "A host or Host header is required." });
        return;
      }

      const runtime = await resolveTenantRuntimeByHost(host, {
        environmentKey: normalizeEnvironmentKey(req.query?.environmentKey)
      });
      if (!runtime) {
        res.status(404).json({ error: "Tenant runtime not found." });
        return;
      }

      res.json(runtime);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

function ensureInternalRequest(req, res, internalConfig) {
  const configured = String(internalConfig?.apiKey || "").trim();
  if (!configured) {
    if (req.auth?.user?.role === "platform_admin") {
      return true;
    }
    res.status(503).json({ error: "Internal runtime routing is not configured." });
    return false;
  }

  const provided = String(req.headers["x-control-plane-key"] || "").trim();
  if (!provided || provided !== configured) {
    res.status(401).json({ error: "Internal control-plane authentication required." });
    return false;
  }
  return true;
}

function normalizeRequestedHost(req) {
  const explicit = String(req.query?.host || "").trim();
  const forwarded = String(req.headers["x-forwarded-host"] || "").trim();
  const hostHeader = String(req.headers.host || "").trim();
  const raw = explicit || forwarded || hostHeader;
  if (!raw) return "";
  return raw.replace(/^https?:\/\//i, "").split("/")[0].split(":")[0].trim().toLowerCase();
}

function normalizeEnvironmentKey(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || null;
}

module.exports = {
  registerRuntimeRoutes
};
