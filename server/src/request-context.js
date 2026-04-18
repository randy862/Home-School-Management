const { AsyncLocalStorage } = require("async_hooks");

const storage = new AsyncLocalStorage();

function runWithRequestContext(context, callback) {
  return storage.run(context, callback);
}

function getRequestContext() {
  return storage.getStore() || null;
}

function getRequestPgClient() {
  return getRequestContext()?.pgClient || null;
}

function getTenantRuntimeContext() {
  return getRequestContext()?.tenantRuntime || null;
}

module.exports = {
  getRequestContext,
  getRequestPgClient,
  getTenantRuntimeContext,
  runWithRequestContext
};
