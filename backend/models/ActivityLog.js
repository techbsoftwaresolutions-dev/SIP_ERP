const { mongoose, baseOptions } = require("./_shared");

const activityLogSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    user: { type: String, default: "Admin" },
    action: { type: String, required: true },
    details: { type: String, default: "" },
    date: { type: String, default: "" },
    // Request context, filled in for actions that carry an HTTP request
    // (logins today). Older rows simply have these blank.
    ip: { type: String, default: "" },
    device: { type: String, default: "" }, // e.g. "Chrome on Windows · Desktop"
    location: { type: String, default: "" }, // e.g. "Chennai, India" (best-effort, GEOIP_ENABLED)
    // Audit-log fields (Phase 1). All optional so pre-existing rows stay valid.
    role: { type: String, default: "" },
    module: { type: String, default: "" }, // Customers, Sales, Authentication, ...
    status: { type: String, default: "Success" }, // Success | Failed | Warning
    entityType: { type: String, default: "" }, // model / resource name
    entityId: { type: String, default: "" }, // human id of the affected record
    description: { type: String, default: "" }, // short human summary (falls back to `details`)
    method: { type: String, default: "" }, // HTTP verb
    path: { type: String, default: "" }, // request path
    // For updates: only the top-level fields that actually changed.
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  baseOptions
);

module.exports = mongoose.model("ActivityLog", activityLogSchema);
