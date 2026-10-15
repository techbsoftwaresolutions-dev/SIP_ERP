const { mongoose, baseOptions } = require("./_shared");

// Platform operators — TechB staff, not a client's users. Lives in master_db
// alongside the tenant registry, never in a client database, because these
// accounts can reroute or suspend ANY client.
//
// `passwordHash` is scrypt (salt:derivedKey), never the password itself —
// see superAdminAuth.js. The client-side User model still stores plaintext;
// that is a separate pre-existing problem and is not made worse here.
const superAdminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // "owner" can manage other super admins; "operator" can run the platform
    // but not change who else has access.
    role: { type: String, default: "operator" }, // owner | operator
    status: { type: String, default: "active" }, // active | disabled
    lastLoginAt: { type: Date, default: null },
  },
  baseOptions
);

// Never let the hash out of the server, whatever serialises this document.
// `id` is carried across from _id before it is dropped — without it these
// rows have no identifier at all, and nothing can address one to edit it.
superAdminSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    delete ret.passwordHash;
    return ret;
  },
});

module.exports = { schema: superAdminSchema };
