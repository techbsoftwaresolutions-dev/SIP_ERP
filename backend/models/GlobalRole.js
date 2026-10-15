const { mongoose, baseOptions } = require("./_shared");

// Role TEMPLATES defined once at platform level. Master database, next to the
// Tenant registry — never in a client's own database.
//
// These are not the roles anyone signs in with. Every client keeps its own
// Role collection (models/Role.js) in its own database, and that is what the
// middleware enforces against. A global role is the STARTING POINT those are
// created from: define "Sales Executive" once here instead of hand-building
// it 200 times, then push it out to whichever clients should have it.
//
// A client is free to edit their copy afterwards. Pushing the template again
// overwrites that copy — which is the point, and why the admin screen says so
// before it does it.
const globalRoleSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true }, // slug, e.g. "sales-executive"
    name: { type: String, required: true }, // the role name created in the client's DB
    description: { type: String, default: "" },

    // "<module>.<action>" strings, exactly as a client Role stores them, so
    // applying a template is a straight copy with no translation step.
    permissions: { type: [String], default: [] },

    // Administrator is marked protected: it always holds every permission by
    // name (see isAdminRole in ../permissions.js), so letting someone edit or
    // delete the template would imply a control that does not exist.
    protected: { type: Boolean, default: false },

    // Seeded templates start active; archiving keeps one on the books without
    // offering it for new clients.
    status: { type: String, default: "active" }, // "active" | "archived"
  },
  baseOptions
);

// Exported as a bare schema — ../tenantModels.js binds it onto the master
// database's connection.
module.exports = { schema: globalRoleSchema };
