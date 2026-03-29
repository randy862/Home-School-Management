function startProvisioningWorker(options) {
  const {
    enabled,
    pollIntervalMs,
    claimNextProvisioningJob,
    reconcilePendingSetups,
    executeProvisioningJob,
    logger = console
  } = options;

  if (!enabled) {
    logger.log("Control API provisioning worker disabled.");
    return { stop() {} };
  }

  let stopped = false;
  let timer = null;

  async function tick() {
    if (stopped) return;
    try {
      const job = await claimNextProvisioningJob();
      if (job) {
        await executeProvisioningJob(job);
      } else if (reconcilePendingSetups) {
        await reconcilePendingSetups();
      }
    } catch (error) {
      logger.error("Provisioning worker tick failed:", error.message);
    } finally {
      if (!stopped) {
        timer = setTimeout(tick, pollIntervalMs);
      }
    }
  }

  timer = setTimeout(tick, pollIntervalMs);
  logger.log(`Control API provisioning worker started with ${pollIntervalMs}ms polling.`);

  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    }
  };
}

module.exports = {
  startProvisioningWorker
};
