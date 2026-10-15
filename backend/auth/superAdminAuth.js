// Super-admin credentials and sessions.
//
// Passwords are hashed with scrypt from Node's own crypto module — no new
// dependency, salted per account, and deliberately slow so a stolen hash is
// expensive to attack. Sessions are server-side rows (models/AdminSession.js)
// so access can be revoked immediately rather than waiting for expiry.
const crypto = require("crypto");
const { getSuperAdminModel, getAdminSessionModel } = require("../tenancy/tenantModels");

const SCRYPT_KEYLEN = 64;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

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
  // Length check first: timingSafeEqual throws on a mismatch.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ---- sessions ------------------------------------------------------------

const sha256 = (v) => crypto.createHash("sha256").update(String(v)).digest("hex");

async function createSession(adminId, req) {
  const AdminSession = getAdminSessionModel();
  // 32 random bytes — the only copy the client ever sees.
  const token = crypto.randomBytes(32).toString("hex");
  await AdminSession.create({
    tokenHash: sha256(token),
    adminId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    ip: (req.ip || "").replace(/^::ffff:/, ""),
    userAgent: String(req.get("user-agent") || "").slice(0, 300),
  });
  return { token, expiresAt: new Date(Date.now() + SESSION_TTL_MS) };
}

async function destroySession(token) {
  if (!token) return;
  await getAdminSessionModel().deleteOne({ tokenHash: sha256(token) });
}

// Called after a self-service password change: every OTHER signed-in device
// for this admin is logged out, same as the client app does on its own
// change-password route. `keepToken` is the session making the change, so
// that device isn't signed out of the very form it just used.
async function forgetOtherSessions(adminId, keepToken) {
  const AdminSession = getAdminSessionModel();
  const filter = { adminId: String(adminId) };
  if (keepToken) filter.tokenHash = { $ne: sha256(keepToken) };
  await AdminSession.deleteMany(filter);
}

// Resolves a bearer token to its admin, or null. Also refreshes lastSeenAt so
// the sessions list is useful.
async function resolveSession(token) {
  if (!token) return null;
  const AdminSession = getAdminSessionModel();
  const session = await AdminSession.findOne({ tokenHash: sha256(token) }).lean();
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await AdminSession.deleteOne({ _id: session._id });
    return null;
  }
  const admin = await getSuperAdminModel().findById(session.adminId);
  // A disabled account loses access immediately, without needing its session
  // to be hunted down.
  if (!admin || admin.status !== "active") return null;
  AdminSession.updateOne({ _id: session._id }, { $set: { lastSeenAt: new Date() } }).catch(() => {});
  return { admin, session };
}

function tokenFromRequest(req) {
  const header = req.get("authorization") || "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return req.get("x-admin-token") || "";
}

// Express middleware. Attaches req.superAdmin on success.
function requireSuperAdmin(req, res, next) {
  resolveSession(tokenFromRequest(req))
    .then((found) => {
      if (!found) {
        return res.status(401).json({ message: "Your admin session has ended. Please sign in again." });
      }
      req.superAdmin = found.admin;
      req.superAdminToken = tokenFromRequest(req);
      next();
    })
    .catch(next);
}

// Only an "owner" may manage other super admins.
function requireOwner(req, res, next) {
  if (!req.superAdmin || req.superAdmin.role !== "owner") {
    return res.status(403).json({ message: "Only an owner account can manage super admins." });
  }
  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  forgetOtherSessions,
  resolveSession,
  tokenFromRequest,
  requireSuperAdmin,
  requireOwner,
  SESSION_TTL_MS,
};
