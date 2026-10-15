const { mongoose, baseOptions } = require("./_shared");

// The platform's module registry. Lives in the MASTER database next to the
// Tenant registry and Plans — never in a client's own database.
//
// WHAT THIS IS NOT: the list of modules that EXIST. That is still MODULES in
// ../permissions.js, because those entries carry the URL rules the middleware
// matches against — they have to live in code. This collection carries the
// COMMERCIAL and OPERATIONAL metadata for each of those modules: what it is
// called on the pricing pages, whether it is still being sold, whether it can
// be switched off at all.
//
// Rows are seeded from the code catalogue the first time the Modules screen
// is opened, and a module added to the catalogue later is back-filled on the
// next read, so the two can never drift apart.
const moduleSchema = new mongoose.Schema(
  {
    // Matches a MODULES key in ../permissions.js, e.g. "manufacturing".
    key: { type: String, required: true, unique: true },
    label: { type: String, default: "" },
    description: { type: String, default: "" },

    // Platform kill switch. "disabled" takes the module away from EVERY
    // client at once regardless of what they bought — for pulling a
    // half-finished module off the market, not for per-client tailoring
    // (that is the plan, the add-ons, and the per-client override).
    status: { type: String, default: "active" }, // "active" | "disabled"

    // A core module is always available and cannot be restricted away by a
    // plan or a per-client override — so a client narrowed down to two menus
    // still has somewhere to land. Defaults to FALSE for every seeded row on
    // purpose: nothing is core until someone says so, which means seeding
    // this collection changes no client's access by itself.
    core: { type: Boolean, default: false },

    // Sold only as an add-on: it is excluded from the plan menu picker, so a
    // plan can never quietly include it. Access comes from AddOn.modules.
    addOnOnly: { type: Boolean, default: false },

    // Display order on the admin screens. Seeded from the catalogue order.
    order: { type: Number, default: 0 },
  },
  baseOptions
);

// Exported as a bare schema — ../tenantModels.js binds it onto the master
// database's connection, same as Tenant and Plan.
module.exports = { schema: moduleSchema };
