const { mongoose, baseOptions } = require("./_shared");

// Every change made through the platform admin panel. Master database.
//
// The per-tenant ActivityLog records what happens INSIDE a client's app. This
// records what TechB does to the platform: who moved a template between tiers,
// who narrowed a client's menus, who added a super admin. Those actions reach
// every client at once and, until now, left no trace at all.
//
// Written by one middleware on the admin router rather than by each route, so
// a route added later is covered without anybody remembering to instrument it.
const adminAuditLogSchema = new mongoose.Schema(
  {
    // Who. Falls back to "master key" for calls authenticated with
    // X-MASTER-KEY rather than a signed-in session — those are anonymous by
    // nature, and saying so is more honest than attributing them to nobody.
    actor: { type: String, default: "" },
    actorEmail: { type: String, default: "" },

    // What. `area` is the registry touched ("clients", "themes"), `action` the
    // verb, `target` the specific row.
    area: { type: String, default: "" },
    action: { type: String, default: "" }, // create | update | delete | other
    target: { type: String, default: "" },

    method: { type: String, default: "" },
    path: { type: String, default: "" },
    status: { type: Number, default: 0 },

    // A short human sentence, built at write time — so the log still reads
    // correctly after the thing it describes has been renamed or deleted.
    summary: { type: String, default: "" },

    // The request body, with anything secret stripped. Enough to answer "what
    // did they actually change?" without becoming a second copy of the data.
    details: { type: mongoose.Schema.Types.Mixed, default: null },

    ip: { type: String, default: "" },
  },
  baseOptions
);

// Newest first is the only way this is ever read.
adminAuditLogSchema.index({ createdAt: -1 });

module.exports = { schema: adminAuditLogSchema };
