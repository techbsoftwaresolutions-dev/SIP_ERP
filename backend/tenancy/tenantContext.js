// Request-scoped "which tenant's models is this request using" context,
// built on Node's AsyncLocalStorage. The tenant middleware (server.js, see
// tenantModels.js) sets this once per request; every model access anywhere
// else in the app — every route handler, unchanged — reads it back via the
// proxies in models/tenantProxy.js. Route handlers never need to know or
// care which tenant they're serving.
const { AsyncLocalStorage } = require("async_hooks");

const als = new AsyncLocalStorage();

function runWithModels(models, fn) {
  return als.run({ models }, fn);
}

function currentModels() {
  const store = als.getStore();
  if (!store) {
    throw new Error(
      "No tenant context active — every request must pass through the tenant middleware " +
        "before touching a model. Check that it's registered before your routes in server.js."
    );
  }
  return store.models;
}

module.exports = { runWithModels, currentModels };
