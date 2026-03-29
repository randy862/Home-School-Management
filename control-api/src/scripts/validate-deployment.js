const { automation } = require("../config");
const { createTenantRuntimeAutomation } = require("../tenant-runtime-automation");

async function main() {
  const environment = {
    tenantId: required("TENANT_ID"),
    id: required("TENANT_ENVIRONMENT_ID"),
    environmentKey: required("TENANT_ENVIRONMENT_KEY"),
    appBaseUrl: required("TENANT_APP_BASE_URL"),
    appHost: required("TENANT_APP_HOST"),
    webHost: required("TENANT_WEB_HOST"),
    databaseHost: required("TENANT_DATABASE_HOST"),
    databaseName: required("TENANT_DATABASE_NAME"),
    databaseSchema: required("TENANT_DATABASE_SCHEMA")
  };
  const payload = {
    releaseVersion: process.env.TENANT_RELEASE_VERSION || "manual-validation"
  };

  const runtimeAutomation = createTenantRuntimeAutomation(automation);
  const result = await runtimeAutomation.provisionEnvironment(environment, payload);
  console.log(JSON.stringify(result, null, 2));
}

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
