const { mongoose, baseOptions } = require("./_shared");

// Subscription plans TechB sells to its clients. Lives in the MASTER
// database alongside the Tenant registry (see ../tenantModels.js) — never in
// a client's own database, and deliberately NOT part of models/index.js,
// which is the per-tenant model set bound at request time.
//
// `maxUsers` and `features` are descriptive only: they document what a client
// bought so it shows on the Manage Plans / Manage Clients screens. Nothing in
// the app enforces them.
const planSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true }, // slug, e.g. "professional"
    name: { type: String, required: true }, // e.g. "Professional"
    price: { type: Number, default: 0 },
    currency: { type: String, default: "INR" },
    billingCycle: { type: String, default: "Monthly" }, // Monthly | Quarterly | Yearly
    description: { type: String, default: "" },
    features: { type: [String], default: [] }, // informational
    // Menu keys this plan unlocks (see MODULES in ../permissions.js).
    // EMPTY MEANS EVERY MENU — so an existing plan with nothing set keeps
    // behaving exactly as before, and gating only starts when it's configured.
    modules: { type: [String], default: [] },
    // Which invoice themes this plan unlocks: "basic" | "advanced" |
    // "premium" (see ../invoiceThemes.js). Higher tiers include the lower
    // ones, and "advanced" and up also unlock the accent colour picker.
    // Defaults to basic so an existing plan never silently gains themes.
    invoiceThemeTier: { type: String, default: "basic" },
    maxUsers: { type: Number, default: 0 }, // informational; 0 = unlimited/unspecified
    status: { type: String, default: "active" }, // "active" | "archived"
  },
  baseOptions
);

// Exported as a bare schema, not a bound model — tenantModels.js binds it onto
// the master database's connection, same as Tenant.
module.exports = { schema: planSchema };
