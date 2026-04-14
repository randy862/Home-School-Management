const { ensureAuthenticated } = require("./route-auth");

function registerControlCommercialRoutes(app, deps) {
  const {
    createCancellationExportRequest,
    getCommercialSubscriptionById,
    listCancellationExportRequestsBySubscriptionId,
    listCommercialOverview,
    updateCommercialSubscription
  } = deps;

  app.get("/api/control/commercial/overview", async (req, res) => {
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await listCommercialOverview());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/control/commercial/subscriptions/:id", async (req, res) => {
    if (!ensureAuthenticated(req, res)) return;

    try {
      const subscription = await getCommercialSubscriptionById(req.params.id);
      if (!subscription) {
        res.status(404).json({ error: "Subscription not found." });
        return;
      }

      const exportRequests = await listCancellationExportRequestsBySubscriptionId(subscription.id);
      res.json({
        subscription,
        exportRequests
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/control/commercial/subscriptions/:id/dormant", async (req, res) => {
    if (!ensureAuthenticated(req, res)) return;

    try {
      const subscription = await getCommercialSubscriptionById(req.params.id);
      if (!subscription) {
        res.status(404).json({ error: "Subscription not found." });
        return;
      }

      const now = Date.now();
      const currentPeriodEnd = subscription.currentPeriodEnd ? Date.parse(subscription.currentPeriodEnd) : Number.NaN;
      const dormantStatus = Number.isFinite(currentPeriodEnd) && currentPeriodEnd > now
        ? "pending_dormant"
        : "dormant";

      const updated = await updateCommercialSubscription(subscription.id, {
        dormantStatus
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/control/commercial/subscriptions/:id/reactivate", async (req, res) => {
    if (!ensureAuthenticated(req, res)) return;

    try {
      const subscription = await getCommercialSubscriptionById(req.params.id);
      if (!subscription) {
        res.status(404).json({ error: "Subscription not found." });
        return;
      }

      const updated = await updateCommercialSubscription(subscription.id, {
        dormantStatus: "active"
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/control/commercial/subscriptions/:id/cancellation-export", async (req, res) => {
    if (!ensureAuthenticated(req, res)) return;

    try {
      const subscription = await getCommercialSubscriptionById(req.params.id);
      if (!subscription) {
        res.status(404).json({ error: "Subscription not found." });
        return;
      }

      const exportRequest = await createCancellationExportRequest({
        customerAccountId: subscription.customerAccountId,
        customerSubscriptionId: subscription.id,
        requestedByEmail: req.body?.requestedByEmail || req.auth?.user?.username || null,
        priceCents: 1999
      });
      res.status(201).json(exportRequest);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });
}

module.exports = {
  registerControlCommercialRoutes
};
