const { mongoose, baseOptions } = require("./_shared");

const userSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    name: { type: String, required: true },
    email: { type: String, default: "" },

    // scrypt, as "salt:derivedKey" — see ../clientAuth.js. Empty means the
    // account has never set one: either it predates hashing (and still has
    // a legacy `password` below) or it is waiting on an invite.
    passwordHash: { type: String, default: "" },
    passwordSetAt: { type: Date, default: null },

    // LEGACY. Passwords used to be stored and compared in plain text. Rows
    // written before that changed still carry one; the first successful
    // sign-in rehashes it and clears this field, so the column empties
    // itself as people sign in rather than needing a migration window.
    password: { type: String, default: "" },

    // Set-password invitations and password resets share one mechanism: a
    // single-use token, stored only as its SHA-256, with an expiry. The raw
    // token exists only in the email that was sent.
    inviteTokenHash: { type: String, default: "" },
    inviteExpiresAt: { type: Date, default: null },
    // "invite" on a new account, "reset" on a forgotten password — so the
    // set-password screen can word itself correctly.
    invitePurpose: { type: String, default: "" },

    role: { type: String, default: "Viewer" },
    // Active | Inactive | Invited — Invited cannot sign in yet because it
    // has no password, and saying so is clearer than a failed login.
    status: { type: String, default: "Active" },
    lastLogin: { type: String, default: "—" },
  },
  baseOptions
);

module.exports = mongoose.model("User", userSchema);
