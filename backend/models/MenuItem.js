const { mongoose, baseOptions } = require("./_shared");

// Sidebar presentation overrides. Master database, so one edit reaches every
// client at once.
//
// A row here NEVER decides whether a menu is reachable — that is the plan, the
// add-ons, the per-client menu limit and the role, all of which are enforced
// on the server. `hidden` only takes an item out of the sidebar; its pages and
// API routes carry on working for anyone who has the URL. It is for tidying a
// navigation nobody uses, not for taking a feature away. To actually withdraw
// something, disable the module (Modules) or narrow the client's menus.
//
// Only overrides live here. An item with no row renders exactly as the
// platform ships it (see ../menuCatalogue.js), so an empty collection means
// the sidebar looks the way it always has.
const menuItemSchema = new mongoose.Schema(
  {
    // A key from MENU_ITEMS in ../menuCatalogue.js — the catalogue is the only
    // thing that decides which items exist, so a row for an unknown key is
    // simply ignored rather than conjuring a menu with no page behind it.
    key: { type: String, required: true, unique: true },

    // Empty means "keep the shipped label/icon" rather than "blank" — the
    // resolver falls back for anything not set.
    label: { type: String, default: "" },
    icon: { type: String, default: "" },

    // Position within its group, low to high. Defaults to the catalogue's own
    // ordering when absent.
    order: { type: Number, default: null },

    parentKey: { type: String, default: "" },
    hidden: { type: Boolean, default: false },
  },
  baseOptions
);

// Exported as a bare schema — ../tenantModels.js binds it onto the master
// database's connection.
module.exports = { schema: menuItemSchema };
