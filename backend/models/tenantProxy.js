// Drop-in replacement for require("./models") — used by server.js and
// nothing else. Each export here is a Proxy that transparently forwards
// every property/method access to that model name's binding on the CURRENT
// REQUEST's tenant database (resolved once, per request, by the tenant
// middleware in server.js — see tenantContext.js/tenantModels.js).
//
// Why a Proxy: every route handler in server.js already just writes
// `Customer.find(...)`, `Item.create(...)`, etc. Rebinding those names to a
// Proxy here means none of the ~100+ call sites throughout server.js need
// to change — only which database each one actually hits, per request.
//
// Standalone scripts (reset-db.js, scripts/set-logo.js) should keep using
// require("./models") directly, not this file — they run outside any
// request/tenant context, so a Proxy here would throw for them.
const { currentModels } = require("../tenancy/tenantContext");
const defaultModels = require("./index");

function modelProxy(name) {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        const model = currentModels()[name];
        const value = model[prop];
        return typeof value === "function" ? value.bind(model) : value;
      },
    }
  );
}

const proxies = {};
for (const name of Object.keys(defaultModels)) {
  proxies[name] = modelProxy(name);
}

module.exports = proxies;
