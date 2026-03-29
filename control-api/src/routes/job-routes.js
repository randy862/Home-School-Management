const { ensureAuthenticated } = require("./route-auth");

function registerJobRoutes(app, deps) {
  const { getProvisioningJobById, listProvisioningJobEvents, listProvisioningJobs } = deps;

  app.get("/api/control/jobs", async (req, res) => {
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await listProvisioningJobs());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/control/jobs/:id", async (req, res) => {
    if (!ensureAuthenticated(req, res)) return;

    try {
      const job = await getProvisioningJobById(req.params.id);
      if (!job) {
        res.status(404).json({ error: "Job not found." });
        return;
      }
      res.json({
        ...job,
        events: await listProvisioningJobEvents(job.id)
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = {
  registerJobRoutes
};
