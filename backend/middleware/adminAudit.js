// Records every change made through the platform admin panel.
//
// One middleware rather than a call in each route: there are forty-odd admin
// endpoints now and more coming, and a trail that depends on each author
// remembering to write to it is a trail with holes in it. Mounting this on the
// router covers everything, including routes added later.

const { getAdminAuditLogModel } = require("../tenancy/tenantModels");

// Never store these, whatever a route happens to accept.
const SECRET_KEYS = new Set(["password", "passwordHash", "token", "masterKey", "secret"]);

// The admin path segment -> what to call it in the log. Anything unlisted
// falls back to the raw segment, so a new registry still reads sensibly.
const AREAS = {
  tenants: "Clients",
  plans: "Subscription Plans",
  modules: "Modules",
  "add-ons": "Add-ons",
  menus: "Menu Management",
  themes: "Themes",
  "invoice-templates": "Invoice Templates",
  "payment-methods": "Payment Methods",
  "approval-rules": "Approval Engine",
  "notification-types": "Notifications",
  announcements: "Announcements",
  "global-roles": "Global Roles",
  "global-permissions": "Global Permissions",
  "super-admins": "Super Admins",
};

function actionFor(method, path) {
  if (/\/default$/.test(path)) return "update";
  if (/\/apply$/.test(path)) return "update";
  if (/\/reset$/.test(path)) return "update";
  switch (String(method || "").toUpperCase()) {
    case "POST":
      return "create";
    case "PUT":
    case "PATCH":
      return "update";
    case "DELETE":
      return "delete";
    default:
      return "other";
  }
}

// Strips secrets and anything unreasonably large. Base64 logos and signatures
// would turn the audit log into the biggest collection in the database.
function safeDetails(body) {
  if (!body || typeof body !== "object") return null;
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    // Any key that looks like a credential is hidden, not just the exact names
    // above — a new field such as adminPassword must never reach the log.
    if (SECRET_KEYS.has(k) || /password|secret|token/i.test(k)) {
      out[k] = "(hidden)";
      continue;
    }
    if (typeof v === "string" && v.length > 300) {
      out[k] = `${v.slice(0, 120)}… (${v.length} chars)`;
      continue;
    }
    if (Array.isArray(v) && v.length > 40) {
      out[k] = `${v.length} items`;
      continue;
    }
    out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

// Inside a mounted router req.path is RELATIVE to the mount point, so
// PUT /api/admin/menus/customers arrives here as baseUrl "/api/admin/menus"
// and path "/customers". The area comes from the mount, the target from the
// path — reading both off req.path alone logged every change against its own
// row id as if that were the registry.
//
//   ("/api/admin/menus", "/customers") -> { area: "Menu Management", target: "customers" }
function describe(baseUrl, path) {
  const mount = String(baseUrl || "").split("/").filter(Boolean).pop() || "";
  const area = AREAS[mount] || mount || "Admin";
  const parts = String(path || "").split("/").filter(Boolean);
  // The row is the first segment, unless it is a verb like "default".
  const first = parts[0] && !["default", "reset", "apply"].includes(parts[0]) ? parts[0] : "";
  return { area, target: first };
}

function summarise({ actor, action, area, target, method, path }) {
  const verb =
    action === "create" ? "created" : action === "delete" ? "deleted" : action === "update" ? "changed" : "called";
  const what = target ? `${area} → ${target}` : area;
  if (action === "other") return `${actor} called ${method} ${path}`;
  return `${actor} ${verb} ${what}`;
}

// Mount with router.use(). Records only mutations, and only ones that
// SUCCEEDED — a rejected request changed nothing, and logging refusals here
// would bury the real changes under validation noise.
function adminAuditMiddleware(req, res, next) {
  const method = String(req.method || "").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return next();

  const body = safeDetails(req.body);

  res.on("finish", () => {
    if (res.statusCode >= 400) return;
    const actor = req.superAdmin ? req.superAdmin.name : "master key";
    const action = actionFor(method, req.path);
    const { area, target } = describe(req.baseUrl, req.path);
    // Fire and forget: an audit write must never fail the request that was
    // already answered, but a silent failure would be a hole in the trail, so
    // it is at least reported to the server log.
    getAdminAuditLogModel()
      .create({
        actor,
        actorEmail: (req.superAdmin && req.superAdmin.email) || "",
        area,
        action,
        target,
        method,
        path: req.originalUrl || req.path,
        status: res.statusCode,
        summary: summarise({ actor, action, area, target, method, path: req.path }),
        details: body,
        ip: req.ip || "",
      })
      .catch((err) => console.error("Admin audit write failed:", err.message));
  });

  next();
}

module.exports = { adminAuditMiddleware, AREAS, safeDetails, describe, actionFor, summarise };
