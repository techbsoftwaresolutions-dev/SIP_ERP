const { mongoose, baseOptions } = require("./_shared");

// Messages from the platform to its clients — maintenance windows, new
// features, billing notices. Master database, delivered through the same bell
// the operational reminders use, so a client has one place to look rather
// than two.
//
// Deliberately NOT per-client rows: one announcement is written once and
// scoped to an audience, the same way approval rules are. Writing the same
// notice 200 times is exactly what this exists to avoid.
const announcementSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true }, // slug, e.g. "maintenance-oct"
    title: { type: String, required: true },
    body: { type: String, default: "" },
    // Where the bell item points, if anywhere. A relative path inside the
    // client app — never an external URL, so a notice can't be used to send
    // someone off-site.
    link: { type: String, default: "" },

    // info | warning | critical. Critical sorts alongside overdue work;
    // anything lower sits below it, because a notice from us should not bury
    // a customer who has not paid.
    severity: { type: String, default: "info" },

    // all | plans | clients — same scoping vocabulary as ApprovalRule.
    audience: { type: String, default: "all" },
    planCodes: { type: [String], default: [] },
    subdomains: { type: [String], default: [] },

    // Optional window. Blank start = live as soon as it is published; blank
    // end = until it is unpublished by hand.
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },

    // draft never reaches anyone, which is what makes it safe to write one
    // in advance of a maintenance window.
    status: { type: String, default: "draft" }, // draft | published

    createdBy: { type: String, default: "" },
  },
  baseOptions
);

module.exports = { schema: announcementSchema };
