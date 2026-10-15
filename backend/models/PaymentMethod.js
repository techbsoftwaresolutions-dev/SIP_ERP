const { mongoose, baseOptions } = require("./_shared");

// How customers may pay, offered on every client's invoice form. Master
// database, so one edit reaches all of them.
//
// This registry stores COMPLETE rows rather than overrides, because unlike
// modules or invoice templates there is no code catalogue underneath: a
// payment method is a label recorded on an invoice, so a super admin can
// create genuinely new ones and delete their own.
//
// Invoice.paymentMode stores the LABEL, not this code — it is a record of what
// a customer actually did, printed back out on the invoice. That means
// renaming or deleting a method here never rewrites history: an invoice filed
// under "Cheque" still says Cheque. The trade-off is that a rename does not
// retroactively tidy old invoices either, which is the right way round.
const paymentMethodSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true }, // slug, e.g. "bank-transfer"
    label: { type: String, required: true }, // what the invoice form and the print show
    description: { type: String, default: "" },

    // Whether taking this payment means recording something alongside it — a
    // cheque number, a UPI transaction ID. When true the invoice form shows a
    // second field and requires it, so "paid by cheque" is never filed without
    // saying which cheque.
    requiresReference: { type: Boolean, default: false },
    // What that field is called. Falls back to "Reference" when blank.
    referenceLabel: { type: String, default: "" },

    // Platform kill switch: a disabled method leaves every client's invoice
    // form. Invoices already recorded against it are untouched, because the
    // label was copied onto them at the time.
    status: { type: String, default: "active" }, // "active" | "disabled"

    order: { type: Number, default: 0 },

    // Preselected on a new invoice. Exactly one row carries this — the admin
    // route clears it from the others when it moves.
    isDefault: { type: Boolean, default: false },

    // Seeded from ../paymentCatalogue.js. Built-ins can be renamed, reordered
    // and switched off, but not deleted — the names invoices were filed under
    // should keep existing somewhere.
    builtIn: { type: Boolean, default: false },
  },
  baseOptions
);

// Exported as a bare schema — ../tenantModels.js binds it onto the master
// database's connection.
module.exports = { schema: paymentMethodSchema };
