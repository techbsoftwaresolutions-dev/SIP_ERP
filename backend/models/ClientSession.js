const { mongoose, baseOptions } = require("./_shared");

// Signed-in sessions for CLIENT users — the people who use the app, not the
// platform operators (those are models/AdminSession.js).
//
// These live in the MASTER database, not in the client's own, and that is the
// whole point. A session has to be resolved BEFORE we know which tenant the
// request belongs to; if sessions lived per-tenant we would have to trust the
// caller's X-Tenant header to find one, which is exactly the hole this
// closes. The session itself says which tenant and which role — nothing about
// identity is taken from a header any more.
//
// Only the SHA-256 of the token is stored. A leaked database therefore yields
// no usable session, and the raw token exists only in the client's browser.
const clientSessionSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true },

    // Which client's data this session may reach. Empty means the default
    // database — local development, or an install that predates tenants.
    tenantSubdomain: { type: String, default: "" },

    // Who, as resolved at sign-in. Copied rather than referenced because the
    // gate needs them on every request and a per-request lookup into another
    // database would be a round trip per call.
    userId: { type: String, default: "" }, // User.id, or "" for the built-in admin
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    role: { type: String, default: "" },
    // The single account that signs in with the Company Settings credentials
    // rather than a Users & Roles record.
    builtin: { type: Boolean, default: false },

    expiresAt: { type: Date, required: true },
    lastSeenAt: { type: Date, default: Date.now },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  baseOptions
);

// Mongo removes the row itself once it expires, so nothing accumulates and an
// expired session cannot be resurrected by a clock change on the app server.
clientSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = { schema: clientSessionSchema };
