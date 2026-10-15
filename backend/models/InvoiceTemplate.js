const { mongoose, baseOptions } = require("./_shared");

// Commercial metadata for the invoice print templates. Master database,
// alongside Plans and the Tenant registry.
//
// WHAT THIS IS NOT: the templates themselves. The actual layouts are React
// components in frontend/src/print/, and the catalogue of which ones EXIST is
// THEMES in ../invoiceThemes.js — a row here with no layout behind it would
// put a template in a client's picker that cannot print. What this collection
// decides is which TIER unlocks each one, what it is called, whether it is
// still on offer, and which one a client gets before choosing.
//
// Before this existed, moving a template from Advanced to Basic meant editing
// a constant and redeploying. That is the thing this makes configurable.
//
// Rows are seeded from the code catalogue the first time the screen is opened,
// and back-filled whenever a template is added to it, so the two cannot drift.
const invoiceTemplateSchema = new mongoose.Schema(
  {
    // A THEMES key from ../invoiceThemes.js, e.g. "modern".
    key: { type: String, required: true, unique: true },

    // Empty means "keep what the catalogue ships", rather than "blank" — the
    // resolver falls back for anything not set, so an untouched row renders
    // exactly as before.
    label: { type: String, default: "" },
    description: { type: String, default: "" },

    // Which subscription tier unlocks this template: basic | advanced |
    // premium. Tiers are inclusive, so a plan on "advanced" also gets every
    // basic template. Seeded with whatever the code catalogue says, so
    // creating these rows entitles nobody to anything new.
    tier: { type: String, default: "" },

    // Platform kill switch. "disabled" withdraws the template from every
    // client at once, whatever their plan — for pulling a layout that prints
    // wrong, not for per-client tailoring. A client sitting on a disabled
    // template falls back to the default rather than being unable to print.
    status: { type: String, default: "active" }, // "active" | "disabled"

    // Position in the client's template picker, low to high.
    order: { type: Number, default: 0 },

    // The template a client gets before they choose one. Exactly one row
    // carries this — the admin route clears it from the others when it moves.
    isDefault: { type: Boolean, default: false },
  },
  baseOptions
);

// Exported as a bare schema — ../tenantModels.js binds it onto the master
// database's connection.
module.exports = { schema: invoiceTemplateSchema };
