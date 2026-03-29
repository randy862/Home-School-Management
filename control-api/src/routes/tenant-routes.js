const { randomUUID } = require("crypto");
const { ensureAuthenticated, ensurePlatformAdmin } = require("./route-auth");

function registerTenantRoutes(app, deps) {
  const {
    createTenant,
    getTenantById,
    listTenants,
    updateTenant
  } = deps;

  app.get("/api/control/tenants", async (req, res) => {
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await listTenants());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/control/tenants", async (req, res) => {
    if (!ensurePlatformAdmin(req, res)) return;

    try {
      const tenant = await createTenant(normalizeCreateTenantPayload(req.body), {
        operatorUserId: req.auth.user.id
      });
      res.status(201).json(tenant);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.get("/api/control/tenants/:id", async (req, res) => {
    if (!ensureAuthenticated(req, res)) return;

    try {
      const tenant = await getTenantById(req.params.id);
      if (!tenant) {
        res.status(404).json({ error: "Tenant not found." });
        return;
      }
      res.json(tenant);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/control/tenants/:id", async (req, res) => {
    if (!ensurePlatformAdmin(req, res)) return;

    try {
      const tenant = await updateTenant(req.params.id, normalizeUpdateTenantPayload(req.body), {
        operatorUserId: req.auth.user.id
      });
      if (!tenant) {
        res.status(404).json({ error: "Tenant not found." });
        return;
      }
      res.json(tenant);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });
}

function normalizeCreateTenantPayload(input) {
  const slug = String(input?.slug || "").trim().toLowerCase();
  const displayName = String(input?.displayName || "").trim();
  const primaryDomain = String(input?.primaryDomain || "").trim().toLowerCase();
  const primaryDomainType = input?.primaryDomainType === "custom_domain" ? "custom_domain" : "platform_subdomain";
  const planCode = String(input?.planCode || "standard").trim() || "standard";
  const primaryContactName = String(input?.primaryContactName || "").trim();
  const primaryContactEmail = String(input?.primaryContactEmail || "").trim();
  const notes = String(input?.notes || "").trim();
  const status = input?.status === "active" ? "active" : "draft";

  if (!/^[a-z0-9-]{3,40}$/.test(slug)) {
    const error = new Error("Tenant slug must be 3-40 characters using lowercase letters, numbers, or hyphens.");
    error.statusCode = 400;
    throw error;
  }
  if (!displayName) {
    const error = new Error("Tenant display name is required.");
    error.statusCode = 400;
    throw error;
  }
  if (!primaryDomain) {
    const error = new Error("Primary domain is required.");
    error.statusCode = 400;
    throw error;
  }

  return {
    id: `tenant-${randomUUID()}`,
    slug,
    displayName,
    status,
    planCode,
    primaryContactName,
    primaryContactEmail,
    notes,
    primaryDomainId: `tenant-domain-${randomUUID()}`,
    primaryDomain,
    primaryDomainType
  };
}

function normalizeUpdateTenantPayload(input) {
  const displayName = String(input?.displayName || "").trim();
  const status = normalizeTenantStatus(input?.status);
  const planCode = String(input?.planCode || "standard").trim() || "standard";
  const primaryContactName = String(input?.primaryContactName || "").trim();
  const primaryContactEmail = String(input?.primaryContactEmail || "").trim();
  const notes = String(input?.notes || "").trim();

  if (!displayName) {
    const error = new Error("Tenant display name is required.");
    error.statusCode = 400;
    throw error;
  }

  return {
    displayName,
    status,
    planCode,
    primaryContactName,
    primaryContactEmail,
    notes
  };
}

function normalizeTenantStatus(value) {
  const allowed = new Set(["draft", "provisioning", "active", "suspended", "decommissioned"]);
  const normalized = String(value || "draft").trim();
  if (!allowed.has(normalized)) {
    const error = new Error("Provide a valid tenant status.");
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

module.exports = {
  registerTenantRoutes
};
