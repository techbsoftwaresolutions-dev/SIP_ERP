const { mongoose, baseOptions } = require("./_shared");

// Paid extras sold on TOP of a subscription plan. Master database, same as
// Plan and Tenant.
//
// The whole point of an add-on is that it WIDENS access: a client on the
// Basic plan who buys the Manufacturing add-on gets the manufacturing menus
// without being moved to a bigger plan. That is the one direction a plan can
// be exceeded — the per-client override in Tenant.modules only ever narrows.
//
// So the effective menu list for a client is:
//   (core modules ∪ plan modules ∪ add-on modules) ∩ client override
// with any platform-disabled module removed. See permissions.js.
const addOnSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true }, // slug, e.g. "manufacturing-pack"
    name: { type: String, required: true },
    description: { type: String, default: "" },

    price: { type: Number, default: 0 },
    currency: { type: String, default: "INR" },
    billingCycle: { type: String, default: "Monthly" }, // Monthly | Quarterly | Yearly

    // Menu keys this add-on unlocks (see MODULES in ../permissions.js).
    // Unlike Plan.modules, EMPTY MEANS NOTHING rather than everything: an
    // add-on that grants no menus is just a billable line item, and reading
    // it as "everything" would let an empty draft hand out the whole app.
    modules: { type: [String], default: [] },

    // Extra seats on top of the plan's maxUsers. Informational, like the
    // plan's own seat count — nothing in the app enforces it yet.
    maxUsersBonus: { type: Number, default: 0 },

    status: { type: String, default: "active" }, // "active" | "archived"
  },
  baseOptions
);

// Exported as a bare schema — ../tenantModels.js binds it onto the master
// database's connection.
module.exports = { schema: addOnSchema };
