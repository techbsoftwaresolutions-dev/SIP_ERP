const { mongoose, baseOptions } = require("./_shared");

// One row per signed-in super-admin device. Sessions are server-side on
// purpose: revoking access has to be possible without waiting for a token to
// expire, which is the "session management" half of System Security.
//
// Only a SHA-256 of the token is stored — a leaked database dump then can't
// be used to impersonate anyone.
const adminSessionSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true, index: true },
    adminId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    lastSeenAt: { type: Date, default: Date.now },
  },
  baseOptions
);

// Mongo drops the row itself once it lapses, so expired sessions can't pile up.
adminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = { schema: adminSessionSchema };
