const { randomUUID } = require("crypto");
const {
  getProvisioningJobById,
  listProvisioningJobEvents,
  queueProvisioningJob
} = require("../postgres-operator-store");

async function main() {
  const tenantId = required("TENANT_ID");
  const tenantEnvironmentId = required("TENANT_ENVIRONMENT_ID");
  const releaseVersion = process.env.TENANT_RELEASE_VERSION || `queued-validation-${Date.now()}`;

  const job = await queueProvisioningJob({
    id: `job-${randomUUID()}`,
    tenantId,
    tenantEnvironmentId,
    jobType: "provision_environment",
    idempotencyKey: `queued-validation:${tenantEnvironmentId}:${releaseVersion}`,
    message: "Provision environment queued from validation script",
    payload: {
      releaseVersion
    }
  }, {
    operatorUserId: null
  });

  const result = await waitForCompletion(job.id, Number(process.env.JOB_WAIT_TIMEOUT_MS || 90000));
  console.log(JSON.stringify(result, null, 2));
}

async function waitForCompletion(jobId, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const job = await getProvisioningJobById(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} was not found after queueing.`);
    }
    if (job.status === "succeeded" || job.status === "failed") {
      const events = await listProvisioningJobEvents(jobId);
      return { job, events };
    }
    await sleep(2000);
  }
  throw new Error(`Timed out waiting for job ${jobId} to complete.`);
}

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
