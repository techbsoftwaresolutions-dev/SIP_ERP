const { mongoose, baseOptions } = require("./_shared");

// Lives in the MASTER database (see MASTER_DB in ../tenantModels.js) —
// never in a client's own database. One row per client, mapping the
// subdomain their frontend is served from to the MongoDB database their
// data lives in. Not part of models/index.js on purpose: every other model
// there gets bound per-tenant at request time (tenantModels.js), but the
// registry itself has to live somewhere fixed to be looked up in the first
// place.
const tenantSchema = new mongoose.Schema(
  {
    subdomain: { type: String, required: true, unique: true }, // e.g. "crm", "samagra"
    databaseName: { type: String, required: true }, // e.g. "siperp_crm", "samagra_crm"
    companyName: { type: String, default: "" },
    status: { type: String, default: "active" }, // "active" | "suspended" — manual override

    // ---- Subscription ----
    // planName/price/billingCycle are a SNAPSHOT taken when the plan was
    // assigned, so later edits to the Plan itself don't silently rewrite what
    // an existing client was sold.
    // Per-client menu override, holding the same keys a plan uses.
    // Empty = no client-level restriction, so the plan decides on its own
    // (which is how every existing tenant behaves, unchanged).
    // When set, it NARROWS the plan: a client can be given fewer menus than
    // they pay for, never more — see effectiveMenuAllows() in permissions.js.
    modules: { type: [String], default: [] },
    // Paid extras bought on top of the plan, by AddOn.code. These WIDEN
    // access — the one thing that can take a client past their plan — so a
    // Basic client can buy Manufacturing without being moved to Enterprise.
    addOns: { type: [String], default: [] },
    // Which white-label theme this client's app is painted with
    // (models/Theme.js). Empty = whichever theme is marked default, so a
    // client never has to be assigned one to look right.
    themeCode: { type: String, default: "" },
    planCode: { type: String, default: "" },
    planName: { type: String, default: "" },
    // Monthly rate snapshotted from the Plan when it was assigned.
    price: { type: Number, default: 0 },
    // Subscription term the client bought, in months (1/3/6/12/24/36).
    termMonths: { type: Number, default: 12 },
    // Per-client negotiated discount off the term total.
    discountPercent: { type: Number, default: 0 },
    // What they were actually charged: price * termMonths, less the discount.
    // Stored so a later plan price change never rewrites billing history.
    amountPayable: { type: Number, default: 0 },
    billingCycle: { type: String, default: "" },
    subscriptionStart: { type: Date, default: null },
    // No end date = no expiry. Every client that predates this feature keeps
    // working untouched until an end date is actually set.
    subscriptionEnd: { type: Date, default: null },
    graceDays: { type: Number, default: 0 },
  },
  baseOptions
);

// Exported as a bare schema, not a bound model — tenantModels.js binds it
// onto the master database's own connection (via mongoose.connection.useDb),
// not the default one.
module.exports = { schema: tenantSchema };
