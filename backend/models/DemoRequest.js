const { mongoose, baseOptions } = require("./_shared");

// A sales lead from the public SIPERP website (Book a Demo / Contact forms).
// Master database — a lead belongs to the platform, not to any client.
const demoRequestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: String, default: "", trim: true },
    phone: { type: String, default: "" },
    email: { type: String, default: "", trim: true, lowercase: true },
    industry: { type: String, default: "" },
    teamSize: { type: String, default: "" },
    message: { type: String, default: "" },

    // Which form it came from: "demo" or "contact".
    kind: { type: String, default: "demo" },
    // Where the visitor was on the site, for knowing what brings people in.
    page: { type: String, default: "" },

    // Worked by hand in Super Admin -> Demo Requests.
    status: { type: String, enum: ["new", "contacted", "won", "lost"], default: "new" },
    notes: { type: String, default: "" },

    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  baseOptions
);

// Newest first is the only way these are read.
demoRequestSchema.index({ createdAt: -1 });

module.exports = { schema: demoRequestSchema };
