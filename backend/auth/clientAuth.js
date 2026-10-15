// Credentials and sessions for CLIENT users — the people who use the app.
//
// This replaces an arrangement where passwords were compared in plain text and
// no route verified anything at all: the acting user and the tenant both
// arrived in headers the caller chose. Two headers and no password were enough
// to read another client's data.
//
// The shape here mirrors superAdminAuth.js deliberately, so there is one way
// this app does authentication rather than two:
//   - scrypt from Node's own crypto, salted per account, no new dependency
//   - server-side sessions, so access can be revoked immediately
//   - only the SHA-256 of a token is ever stored
//
// The one structural difference is WHERE sessions live: master_db, not the
// client's own database. A session has to be resolved before we know which
// tenant a request belongs to, and looking it up in a tenant database would
// mean trusting the header we are trying to stop trusting.

const crypto = require("crypto");
const { getClientSessionModel } = require("../tenancy/tenantModels");

const SCRYPT_KEYLEN = 64;
// Long enough that a working day does not end in a surprise sign-out, short
// enough that a forgotten session on a shared machine does not live forever.
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
// An invitation or reset link is single-use and short-lived. Two days covers
// "sent on Friday, opened on Monday morning" without leaving links valid for
// weeks in somebody's inbox.
const INVITE_TTL_MS = 48 * 60 * 60 * 1000;

const MIN_PASSWORD_LENGTH = 8;

// ---- passwords -----------------------------------------------------------

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== "string" || !stored.includes(":")) return false;
  const [salt, expected] = stored.split(":");
  let derived;
  try {
    derived = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN).toString("hex");
  } catch (_) {
    return false;
  }
  const a = Buffer.from(derived, "hex");
  const b = Buffer.from(expected, "hex");
  // Length first: timingSafeEqual throws when the buffers differ in size.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// What a password has to be. Deliberately modest — this gates a business app
// used by shop-floor staff, and a rule nobody can satisfy gets written on a
// sticky note next to the monitor.
function passwordProblem(password) {
  const pw = String(password || "");
  if (pw.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (!/[a-zA-Z]/.test(pw)) return "Password must contain at least one letter.";
  if (!/[0-9]/.test(pw)) return "Password must contain at least one number.";
  return null;
}

// ---- single-use tokens (invites and resets) ------------------------------

const sha256 = (v) => crypto.createHash("sha256").update(String(v)).digest("hex");

// Returns the raw token (which goes in the email, and is never stored) and
// the fields to save on the user.
function createInviteToken(purpose) {
  const token = crypto.randomBytes(32).toString("hex");
  return {
    token,
    fields: {
      inviteTokenHash: sha256(token),
      inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
      invitePurpose: purpose === "reset" ? "reset" : "invite",
    },
  };
}

// Cleared on use, so a link works exactly once.
const CLEAR_INVITE = { inviteTokenHash: "", inviteExpiresAt: null, invitePurpose: "" };

function inviteTokenValid(user, token) {
  if (!user || !user.inviteTokenHash || !token) return false;
  if (!user.inviteExpiresAt || new Date(user.inviteExpiresAt).getTime() <= Date.now()) return false;
  const a = Buffer.from(sha256(token), "hex");
  const b = Buffer.from(user.inviteTokenHash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ---- sessions ------------------------------------------------------------

async function createSession(identity, req) {
  const ClientSession = getClientSessionModel();
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await ClientSession.create({
    tokenHash: sha256(token),
    tenantSubdomain: identity.tenantSubdomain || "",
    userId: identity.userId || "",
    name: identity.name || "",
    email: identity.email || "",
    role: identity.role || "",
    builtin: Boolean(identity.builtin),
    expiresAt,
    ip: ((req && req.ip) || "").replace(/^::ffff:/, ""),
    userAgent: String((req && req.get && req.get("user-agent")) || "").slice(0, 300),
  });
  return { token, expiresAt };
}

// Every API request has to prove who is calling. Looking the session up in
// the database each time added a full network round trip in front of every
// single request, so a verified session is remembered in memory for a short
// while. Anything that ends a session drops it from here at once; the short
// lifetime bounds the delay for a revocation made by another server process.
const SESSION_CACHE_TTL_MS = 30 * 1000;
const TOUCH_INTERVAL_MS = 60 * 1000;
const sessionCache = new Map(); // tokenHash -> { session, until, touchedAt }

function forgetSession(tokenHash) {
  sessionCache.delete(tokenHash);
}

function forgetSessionsForUser(tenantSubdomain, userId) {
  for (const [hash, entry] of sessionCache) {
    if ((entry.session.tenantSubdomain || "") === (tenantSubdomain || "") && (entry.session.userId || "") === (userId || "")) {
      sessionCache.delete(hash);
    }
  }
}

async function destroySession(token) {
  if (!token) return;
  const tokenHash = sha256(token);
  forgetSession(tokenHash);
  await getClientSessionModel().deleteOne({ tokenHash });
}

// Every session belonging to one user, for "sign out everywhere" — used after
// a password change, because a changed password that leaves old sessions alive
// has not actually locked anybody out.
async function destroySessionsForUser(tenantSubdomain, userId) {
  forgetSessionsForUser(tenantSubdomain, userId);
  await getClientSessionModel().deleteMany({ tenantSubdomain: tenantSubdomain || "", userId: userId || "" });
}

async function resolveSession(token) {
  if (!token) return null;
  const tokenHash = sha256(token);
  const now = Date.now();

  const hit = sessionCache.get(tokenHash);
  if (hit && hit.until > now && new Date(hit.session.expiresAt).getTime() > now) {
    touchSession(hit, tokenHash, now);
    return hit.session;
  }
  sessionCache.delete(tokenHash);

  const ClientSession = getClientSessionModel();
  const session = await ClientSession.findOne({ tokenHash }).lean();
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() <= now) {
    await ClientSession.deleteOne({ _id: session._id });
    return null;
  }
  const entry = { session, until: now + SESSION_CACHE_TTL_MS, touchedAt: 0 };
  sessionCache.set(tokenHash, entry);
  touchSession(entry, tokenHash, now);
  return session;
}

// "Last active" is written at most once a minute per session — precise enough
// for a session list, and never on the request's critical path.
function touchSession(entry, tokenHash, now) {
  if (now - entry.touchedAt < TOUCH_INTERVAL_MS) return;
  entry.touchedAt = now;
  getClientSessionModel()
    .updateOne({ tokenHash }, { $set: { lastSeenAt: new Date(now) } })
    .catch(() => {});
}

function tokenFromRequest(req) {
  const header = String((req.headers && req.headers.authorization) || "");
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return "";
}

module.exports = {
  SESSION_TTL_MS,
  INVITE_TTL_MS,
  MIN_PASSWORD_LENGTH,
  CLEAR_INVITE,
  hashPassword,
  verifyPassword,
  passwordProblem,
  createInviteToken,
  inviteTokenValid,
  createSession,
  destroySession,
  destroySessionsForUser,
  resolveSession,
  tokenFromRequest,
  sha256,
};
