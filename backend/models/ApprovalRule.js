const { mongoose, baseOptions } = require("./_shared");

// When a document needs signing off before it counts. Master database, so a
// rule is written once and applies across whichever clients it targets.
//
// The engine is deliberately declarative: a rule says WHICH document type,
// under WHAT condition, and WHO may approve. There is no per-client special
// case anywhere in the code — "Acme needs approval over ₹50,000" is a row
// here, not a branch in the invoice route.
//
// No rules means no approvals, which is how every client behaves until one is
// written. Creating this collection changes nothing on its own.
const approvalRuleSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true }, // slug, e.g. "large-invoice"
    name: { type: String, required: true },
    description: { type: String, default: "" },

    // Which document this governs, as a MODULES key from ../permissions.js —
    // "sales:invoices", "purchase:orders". Keeping it to catalogue keys means
    // a rule can never point at a document type that does not exist.
    documentType: { type: String, required: true },

    // What makes it apply:
    //   always        — every document of this type
    //   amount_above  — grand total over `threshold`
    //   discount_above— discount percent over `threshold`
    condition: { type: String, default: "always" },
    threshold: { type: Number, default: 0 },

    // Role names (matching a client's own Role records, and the Global Roles
    // templates they are usually created from) allowed to approve. Empty means
    // Administrator only — never "anyone", because a rule nobody can clear
    // would freeze the documents it catches.
    approverRoles: { type: [String], default: [] },

    // Who this rule governs:
    //   all     — every client
    //   plans   — clients on any plan in `planCodes`
    //   clients — the clients listed in `subdomains`
    appliesTo: { type: String, default: "all" },
    planCodes: { type: [String], default: [] },
    subdomains: { type: [String], default: [] },

    status: { type: String, default: "active" }, // "active" | "disabled"
    order: { type: Number, default: 0 },
  },
  baseOptions
);

// Exported as a bare schema — ../tenantModels.js binds it onto the master
// database's connection.
module.exports = { schema: approvalRuleSchema };
