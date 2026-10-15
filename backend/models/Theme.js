const { mongoose, baseOptions } = require("./_shared");

// White-label themes. Master database, alongside Plans and the Tenant
// registry — one theme can be shared by many clients.
//
// Deliberately only FOUR colours and a corner radius. The app has around
// forty CSS custom properties, but most of them are surface and status
// colours that carry meaning (red is danger, amber is a warning) or that the
// light/dark/sepia modes already handle. Exposing all of them would let a
// client end up with an unreadable app and green error messages. What is here
// is what actually carries a brand: the sidebar, the primary action colour,
// and how round the corners are. Everything else is derived from those (see
// frontend/src/utils/themeTokens.js) so the result stays legible whatever
// colour is picked.
//
// NOT to be confused with invoiceThemes.js — those are the printed invoice
// layouts a plan unlocks. This is the application's own chrome.
const themeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true }, // slug, e.g. "ocean"
    name: { type: String, required: true },
    description: { type: String, default: "" },

    // Sidebar background. Its hover shade is derived from this.
    sidebar: { type: String, default: "#161f2f" },
    // The solid pill behind the active menu item.
    sidebarActive: { type: String, default: "#2563eb" },
    // Resting colour of sidebar labels; the active one is always white,
    // because it sits on the solid pill above.
    sidebarText: { type: String, default: "#a3aec1" },
    // Primary action colour — buttons, links, focus rings. Its hover shade
    // and its soft chip background are derived, in both light and dark.
    primary: { type: String, default: "#2563eb" },
    // Corner radius in px, applied through --radius.
    radius: { type: Number, default: 10 },

    // Which surface modes clients on this theme may choose between. The app
    // ships light, dark and sepia; a brand that only works on one of them can
    // offer just that one.
    modes: { type: [String], default: ["light", "dark"] },
    // What a client sees before they pick anything.
    defaultMode: { type: String, default: "light" },

    // The theme handed to any client with none of their own. Exactly one row
    // carries this — the admin route clears it from the others when it moves.
    isDefault: { type: Boolean, default: false },

    status: { type: String, default: "active" }, // "active" | "archived"
  },
  baseOptions
);

// Exported as a bare schema — ../tenantModels.js binds it onto the master
// database's connection.
module.exports = { schema: themeSchema };
