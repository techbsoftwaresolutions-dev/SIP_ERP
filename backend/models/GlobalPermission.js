const { mongoose, baseOptions } = require("./_shared");

// Which ACTIONS each module supports, platform-wide. Master database.
//
// The permission strings themselves ("sales.create") are still generated from
// the code catalogue — this decides which of them are on offer at all. Two
// things follow from a row here:
//
//   1. the client's Roles matrix only draws checkboxes for actions the module
//      actually supports, instead of four cells for every menu whether they
//      mean anything or not;
//   2. an action switched off here cannot be exercised by ANYONE on ANY
//      client, including a client's own Administrator — that is what makes it
//      a platform policy rather than a UI tidy-up.
//
// `view` is deliberately not in this collection's gift: a module nobody can
// view is simply a module that is switched off, and that is what the Modules
// kill switch is for. So view is always granted and always shown locked.
const globalPermissionSchema = new mongoose.Schema(
  {
    // A top-level MODULES key from ../permissions.js. Sub-pages inherit their
    // parent's row, the same way role grants already do.
    moduleKey: { type: String, required: true, unique: true },

    // Subset of ACTIONS. Seeded with ALL of them, so creating these rows
    // changes nothing until someone deliberately removes one.
    actions: { type: [String], default: [] },

    // Free text shown on the admin screen — why this module is restricted.
    note: { type: String, default: "" },
  },
  baseOptions
);

// Exported as a bare schema — ../tenantModels.js binds it onto the master
// database's connection.
module.exports = { schema: globalPermissionSchema };
