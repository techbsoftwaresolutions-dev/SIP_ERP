require("dotenv").config();
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const mongoose = require("mongoose");
const { connectDB, MONGODB_URI } = require("./config/db");
const {
  Customer,
  CustomerGroup,
  Supplier,
  SupplierGroup,
  Category,
  Brand,
  Warehouse,
  Product,
  Item,
  PurchaseOrder,
  GoodsReceipt,
  PurchaseInvoice,
  PurchaseReturn,
  InventoryItem,
  StockTransaction,
  SalesOrder,
  Enquiry,
  Quotation,
  DeliveryChallan,
  Invoice,
  SalesReturn,
  MaintenanceTask,
  User,
  Role,
  ActivityLog,
  LedgerEntry,
  Settings,
  CustomFieldDefinition,
} = require("./models/tenantProxy");
const {
  getRequestContext,
  getPlanModel,
  getTenantRegistryModel,
  getSubscriptionOrderModel,
  getGlobalRoleModel,
  getPlatformRegistry,
  invalidateRegistryCache,
} = require("./tenancy/tenantModels");
const razorpay = require("./services/razorpayClient");
const { TERM_MONTHS } = require("./routes/tenantAdminRoutes");
const { registerAiRoutes } = require("./routes/aiRoutes");
const {
  THEMES,
  normaliseTier,
  themeKeysForTier,
  resolveTheme,
  resolveAccent,
  canPickAccent,
  resolveTemplates,
} = require("./catalogues/invoiceThemes");
const { resolveMenu } = require("./catalogues/menuCatalogue");
const { themeForTenant } = require("./catalogues/themeCatalogue");
const { resolvePaymentMethods } = require("./catalogues/paymentCatalogue");
const { evaluateDocument, rulesForDocument, canApprove } = require("./services/approvalEngine");
const { notificationRules, announcementItems } = require("./catalogues/notificationCatalogue");
const clientAuth = require("./auth/clientAuth");
const { loginThrottle, requestLimit } = require("./middleware/loginThrottle");
const { sendMail, smtpConfigured, setPasswordEmail } = require("./services/mailer");
const { lookupGstin } = require("./services/gstLookup");
const { isBlocked, blockedMessage } = require("./tenancy/subscription");
const { runWithModels, currentModels } = require("./tenancy/tenantContext");
const { registerTenantAdminRoutes } = require("./routes/tenantAdminRoutes");
const { registerPublicRoutes } = require("./routes/publicRoutes");
const { registerManufacturingRoutes } = require("./routes/manufacturingRoutes");
const { registerSuperAdminRoutes } = require("./routes/superAdminRoutes");
const { buildReminders, parseTermDays } = require("./services/reminders");
const {
  ACTIONS,
  MODULES,
  DEFAULT_ROLES,
  isExempt,
  moduleKeyForPath,
  actionForMethod,
  allPermissions,
  isAdminRole,
  roleHasPermission,
  effectiveMenuAllows,
  planAllowsModule,
  clientAllowsModule,
  addOnAllowsModule,
  addOnModulesFor,
  moduleRegistryIndex,
  actionsForModule,
  globalActionAllowed,
  ALWAYS_ALLOWED_ACTION,
  planMenuSummary,
} = require("./auth/permissions");

const app = express();
const PORT = process.env.PORT || 5000;

// In production the app sits behind Hostinger's reverse proxy, so the real
// client IP arrives in X-Forwarded-For — trust it so req.ip reflects the
// actual visitor (used by the activity log). Harmless locally.
app.set("trust proxy", true);

// The app runs on <client>.domain and calls this API on another host, and it
// sends Authorization / X-Tenant headers — so the browser first asks the API
// for permission with an OPTIONS "preflight" before every kind of request.
// Without maxAge Chrome remembers that answer for only 5 seconds, which made
// nearly every call cost two round trips. 7200s is the longest Chrome honours.
app.use(cors({ maxAge: 7200 }));
// Several responses (Settings' logo/signature/seal, item images, etc.) carry
// base64 image data inline and can run several MB — gzip cuts that
// significantly over the wire since base64 text compresses well. This is the
// single biggest lever on response time for those endpoints; do it before
// any route is registered so every response benefits.
app.use(compression());
app.use(express.json({ limit: "8mb" }));

// Root route for API health and information
app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "SIP ERP Backend API is running.",
    frontend: "http://localhost:5173",
  });
});

// Dynamic client management (create/edit/remove tenant registry rows from
// the frontend's "Manage Clients" screen) — registered before the tenant
// middleware below since these routes manage the registry itself, not any
// one client's data, and are locked down separately (see tenantAdminRoutes.js).
// An admin changing what a plan unlocks, or moving a client onto a different
// plan, must take effect on the next request rather than waiting out the
// cache. Registered ABOVE the admin routes because app.use() only sees
// requests to routes declared after it.
app.use((req, res, next) => {
  const p = req.path;
  if (req.method !== "GET" && (p.startsWith("/api/admin/plans") || p.startsWith("/api/admin/tenants"))) {
    res.on("finish", () => {
      if (res.statusCode < 400) invalidatePlanCache();
    });
  }
  next();
});

registerTenantAdminRoutes(app);

// Platform control plane (super-admin sign-in + cross-client dashboard).
// Registered here, ABOVE the tenant middleware, because these routes serve
// TechB rather than any one client and so have no tenant context to resolve.
// `asyncHandler` is a hoisted function declaration further down this file.
registerSuperAdminRoutes(app, { asyncHandler });

// The public SIPERP marketing site (siperp.in) posts its Book-a-Demo / Contact
// forms here. No sign-in and no tenant, so it sits above the auth middleware.
registerPublicRoutes(app, { asyncHandler });

// ---------- Multi-tenant DB routing ----------
// One backend, one .env, many client databases on the same Atlas cluster.
// Each frontend sends which client it's serving via the X-Tenant header
// (derived from its own subdomain — see frontend/src/api/client.js); this
// resolves that to a database (via the master tenant registry) and makes
// that tenant's models available to every route below through
// AsyncLocalStorage, with zero changes to the routes themselves. A missing
// or unrecognized tenant falls back to the database MONGODB_URI already
// points at, so any client that hasn't been added to the registry yet (or
// a plain curl/local script) keeps working exactly as before.
// Reachable even when a client's subscription has lapsed, so the frontend can
// find out why and render the block screen. (/api/admin/* is registered above
// this middleware and is master-key gated, so TechB can always administrate.)

// ---------- Who is calling ----------
//
// This runs BEFORE tenant resolution, and that order is the whole point.
// Until now the acting user and the client came from X-User-Role and
// X-Tenant — two headers the caller chose — so `curl -H "X-Tenant: acme"
// -H "X-User-Role: Administrator"` read anybody's data without a password.
//
// A verified session says which tenant and which role. When one is present
// its values REPLACE those headers, so every downstream reader (the
// permission gate, the audit log, the tenant binder) becomes correct without
// each of them having to learn about sessions.

// Paths that must work before anyone is signed in: signing in itself, the
// health check, the subscription state the block screen renders, and the
// theme and menu the login page is painted with.
const AUTH_EXEMPT = [
  /^\/api\/auth\//,
  /^\/api\/health\b/,
  /^\/api\/subscription\/status\b/,
  /^\/api\/theme\b/,
  /^\/api\/menu\b/,
];

// An escape hatch, not a default. Set REQUIRE_CLIENT_AUTH=false only to get
// an old integration or script working again while it is being updated —
// with it off, the header-trusting behaviour described above is back.
const REQUIRE_CLIENT_AUTH = String(process.env.REQUIRE_CLIENT_AUTH || "true").toLowerCase() !== "false";

app.use(
  asyncHandler(async (req, res, next) => {
    if (!req.path.startsWith("/api/") || req.path.startsWith("/api/admin/")) return next();

    const session = await clientAuth.resolveSession(clientAuth.tokenFromRequest(req));
    if (session) {
      req._session = session;
      // Normalise the request from what was actually verified. A caller may
      // still SEND these headers; they are simply overwritten.
      req.headers["x-tenant"] = session.tenantSubdomain || "";
      req.headers["x-user-role"] = session.role || "";
      return next();
    }

    if (!REQUIRE_CLIENT_AUTH) return next();
    if (AUTH_EXEMPT.some((re) => re.test(req.path))) {
      // Nobody is signed in, so nothing may be claimed about who this is.
      delete req.headers["x-user-role"];
      return next();
    }
    return res.status(401).json({
      code: "NOT_SIGNED_IN",
      message: "Your session has ended. Please sign in again.",
    });
  })
);

const SUBSCRIPTION_EXEMPT_PATHS = new Set(["/api/subscription/status", "/api/health"]);

app.use((req, res, next) => {
  // The session, when there is one, has already overwritten x-tenant with
  // the tenant it was issued for — so this reads a verified value rather
  // than whatever the caller sent. Before sign-in it is the subdomain, which
  // only selects which database to check credentials against.
  const subdomain = (req.headers["x-tenant"] || "").toLowerCase().trim() || null;
  getRequestContext(subdomain)
    .then(({ models, tenant, subscription }) => {
      req._tenant = tenant;
      req.subscription = subscription;
      // An expired or suspended client is refused outright — including login.
      // A request with no recognized tenant (localhost, curl, a subdomain not
      // in the registry) is state "none" and is never blocked.
      if (isBlocked(subscription) && !SUBSCRIPTION_EXEMPT_PATHS.has(req.path)) {
        return res.status(402).json({
          code: "SUBSCRIPTION_INACTIVE",
          state: subscription.state,
          message: blockedMessage(subscription),
          planName: subscription.planName,
          subscriptionEnd: subscription.subscriptionEnd,
          companyName: subscription.companyName,
        });
      }
      runWithModels(models, next);
    })
    .catch(next);
});

// ---------- Audit log: module mapping + generic write capture ----------
// First matching rule wins; order matters (e.g. /api/purchase-orders and
// /api/purchase/* both start with "purchase"; /api/sales/invoices is split
// out from /api/sales).
const AUDIT_MODULE_RULES = [
  [/^\/api\/auth\b/, "Authentication"],
  [/^\/api\/customers\b/, "Customers"],
  [/^\/api\/suppliers\b/, "Suppliers"],
  [/^\/api\/sales\/invoices\b/, "Invoices"],
  [/^\/api\/sales\b/, "Sales"],
  [/^\/api\/(purchase-orders|purchase)\b/, "Purchase"],
  [/^\/api\/manufacturing\b/, "Manufacturing"],
  [/^\/api\/(categories|brands|warehouses|items|inventory)\b/, "Inventory"],
  [/^\/api\/(users|roles)\b/, "Users & Roles"],
  [/^\/api\/settings\b/, "Settings"],
  [/^\/api\/reports\b/, "Reports"],
];

function moduleForPath(p) {
  for (const [re, name] of AUDIT_MODULE_RULES) if (re.test(p || "")) return name;
  return "System";
}

function actionForRequest(method, p) {
  if (/\/(export|print)\b/.test(p) || p.includes("/backup/export")) return "Export";
  if (method === "POST") return "Create";
  if (method === "PUT" || method === "PATCH") return "Update";
  if (method === "DELETE") return "Delete";
  return method;
}

// Stash the tenant models synchronously (ALS is active here; the later res
// "finish" event may run outside ALS). For mutating /api calls, write one
// generic audit row after a successful response — unless the route already
// logged a richer entry itself (which sets req._audited via audit()).
app.use((req, res, next) => {
  try {
    req._auditModels = currentModels();
  } catch (_e) {
    req._auditModels = null;
  }
  const m = req.method;
  const isWrite = m === "POST" || m === "PUT" || m === "DELETE" || m === "PATCH";
  if (
    isWrite &&
    req.path.startsWith("/api/") &&
    !req.path.startsWith("/api/activity-log") &&
    !req.path.startsWith("/api/auth/")
  ) {
    res.on("finish", () => {
      if (req._audited || res.statusCode >= 400) return;
      const p = (req.originalUrl || req.path || "").split("?")[0];
      const action = actionForRequest(m, p);
      // "/api/sales/orders/PSO-1" -> type "orders", id "PSO-1"
      // "/api/customers/CUST-1"   -> type "customers", id "CUST-1"
      const entityId = (req.params && req.params.id) || "";
      const parts = p
        .split("/")
        .filter(Boolean)
        .slice(1) // drop "api"
        .filter((s) => s !== entityId);
      const entityType = parts[parts.length - 1] || "";
      audit(req, {
        action,
        module: moduleForPath(p),
        entityType,
        entityId,
        description: `${action} ${entityType}${entityId ? " " + entityId : ""}`.trim(),
        status: "Success",
      });
    });
  }
  next();
});

// ---------- Role permissions ----------
// Resolution order is deliberate. Administrator always passes, and an EMPTY
// Roles collection means "not configured yet — allow everything", which is
// what keeps every existing user working the day this ships. Once a tenant
// has defined any role, an unrecognised role name is denied rather than
// waved through, so partial configuration can't silently grant full access.
// Administrator remains the guaranteed way back in.
//
// Roles change rarely, so each tenant's set is cached briefly.
const roleCache = new Map(); // dbKey -> { roles, expiresAt }
const ROLE_CACHE_MS = 30 * 1000;

function invalidateRoleCache() {
  roleCache.clear();
}

// The tenant's plan decides which menus exist at all for this client;
// the role decides which of those a given user may touch. Both must
// allow. Cached briefly like roles — plans change rarely.
const planCache = new Map(); // planCode -> { plan, expiresAt }
const PLAN_CACHE_MS = 60 * 1000;

function invalidatePlanCache() {
  planCache.clear();
}

async function planForRequest(req) {
  const tenant = req._tenant;
  const code = tenant && tenant.planCode;
  if (!code) return null;
  const hit = planCache.get(code);
  if (hit && hit.expiresAt > Date.now()) return hit.plan;
  const plan = await getPlanModel().findOne({ code }).lean();
  planCache.set(code, { plan, expiresAt: Date.now() + PLAN_CACHE_MS });
  return plan;
}

async function rolesForRequest(req) {
  const key = (req.headers["x-tenant"] || "").toLowerCase().trim() || "__default__";
  const hit = roleCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.roles;
  const models = req._auditModels || currentModels();
  const roles = await models.Role.find({}, { _id: 0, __v: 0 }).lean();
  roleCache.set(key, { roles, expiresAt: Date.now() + ROLE_CACHE_MS });
  return roles;
}

app.use(
  asyncHandler(async (req, res, next) => {
    if (!req.path.startsWith("/api/") || isExempt(req.path)) return next();

    // READING settings is not a sellable feature — it's how the app draws
    // itself. The sidebar logo and company name, the dashboard, and all three
    // print layouts (invoice, delivery challan, purchase order) fetch
    // /api/settings, so gating the read breaks pages the client DID buy.
    // Writes stay gated, which is what "the Settings menu" actually means.
    if (req.method === "GET" && /^\/api\/settings\b/.test(req.path)) return next();

    const roleName = (req.headers["x-user-role"] || "").trim();
    if (!roleName) return next();          // curl, scripts, built-in admin
    // Administrator bypasses the ROLE check but not the PLAN check —
    // a plan limit is commercial, not a staff-permission matter.
    const adminRole = isAdminRole(roleName);

    const moduleKey = moduleKeyForPath(req.path);
    if (!moduleKey) return next();         // path isn't permission-controlled

    // Commercial gates, in the order effectiveMenuAllows() defines. They are
    // spelled out here rather than delegated to it so each refusal can carry
    // its own code: the UI says something different for "buy an upgrade",
    // "your admin switched this off" and "we withdrew this module".
    const plan = await planForRequest(req);
    const registry = await getPlatformRegistry();
    const { disabled, core } = moduleRegistryIndex(registry.modules);
    const parentKey = moduleKey.includes(":") ? moduleKey.split(":")[0] : null;
    const flagged = (set) => set.has(moduleKey) || (parentKey ? set.has(parentKey) : false);

    // 1. Platform kill switch — outranks everything, including what they
    //    bought, because the module has been withdrawn for all clients.
    if (flagged(disabled)) {
      return res.status(403).json({
        code: "MODULE_DISABLED",
        message: "This module is currently unavailable.",
        module: moduleKey,
      });
    }

    // 2. A core module is always reachable, so a client narrowed right down
    //    still has somewhere to land. Skips both gates below.
    if (!flagged(core)) {
      // 3. Bought it? Through the plan, or through an add-on bolted on top —
      //    add-ons are the one thing that widens access past the plan.
      const viaPlan = planAllowsModule(plan, moduleKey);
      const viaAddOn = addOnAllowsModule(req._tenant, registry.addOns, moduleKey);
      if (!viaPlan && !viaAddOn) {
        return res.status(403).json({
          code: "PLAN_UPGRADE_REQUIRED",
          message: `${moduleKey} is not included in the ${plan.name} plan.`,
          module: moduleKey,
          plan: plan.name,
        });
      }

      // 4. Then the client's own menu override, set by a super admin in
      //    Manage Clients. Not an upsell — the menu was switched off for
      //    this client deliberately, so offering an upgrade would mislead.
      if (!clientAllowsModule(req._tenant, moduleKey)) {
        return res.status(403).json({
          code: "MENU_DISABLED_FOR_CLIENT",
          message: "This menu is not enabled for your account.",
          module: moduleKey,
        });
      }
    }

    // Global permission policy. Unlike everything below it, this is not a
    // per-client or per-role matter: an action withdrawn here is withdrawn
    // for the whole platform, so it is checked BEFORE the Administrator
    // bypass rather than after it.
    const requested = actionForMethod(req.method);
    if (!globalActionAllowed(registry.permissions, moduleKey, requested)) {
      return res.status(403).json({
        code: "ACTION_NOT_PERMITTED",
        message: `The ${requested} action is switched off for ${moduleKey} on this platform.`,
        module: moduleKey,
        action: requested,
      });
    }

    if (adminRole) return next();

    const roles = await rolesForRequest(req);
    if (roles.length === 0) return next(); // feature not configured yet

    const roleDoc = roles.find((r) => String(r.name).toLowerCase() === roleName.toLowerCase());
    const action = actionForMethod(req.method);

    if (!roleDoc) {
      return res.status(403).json({
        code: "PERMISSION_DENIED",
        message: `Your role "${roleName}" has no permissions configured. Ask an administrator to set it up.`,
        module: moduleKey,
        action,
      });
    }
    if (!roleHasPermission(roleDoc, moduleKey, action)) {
      return res.status(403).json({
        code: "PERMISSION_DENIED",
        message: `Your role "${roleName}" is not allowed to ${action} in ${moduleKey}.`,
        module: moduleKey,
        action,
      });
    }
    next();
  })
);

// Any successful write to a role invalidates the cache, so a permission
// change takes effect on the very next request rather than up to 30s later.
// Covers create, update and delete in one place — the addCrudRoutes
// `sanitize` hook only runs on PUT.
app.use((req, res, next) => {
  if (req.path.startsWith("/api/roles") && req.method !== "GET") {
    res.on("finish", () => {
      if (res.statusCode < 400) invalidateRoleCache();
    });
  }
  next();
});

// ---------- Helpers ----------
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "DD Mon YYYY" label for a given Date (defaults to now). Record dates
// (invoice date, order date, ledger entries, ...) are stamped with the real
// current date at the moment they're created.
function formatDateLabel(d = new Date()) {
  return `${String(d.getDate()).padStart(2, "0")} ${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`;
}

function todayLabel() {
  return formatDateLabel();
}

// Keeps phone/mobile numbers as digits only — no country code, spaces, or letters.
function sanitizePhone(value) {
  if (!value) return "";
  return String(value).replace(/\D/g, "").slice(0, 10);
}

function futureLabel(days, base) {
  const d = base instanceof Date && !Number.isNaN(base.getTime()) ? new Date(base) : new Date();
  d.setDate(d.getDate() + days);
  return formatDateLabel(d);
}

// A document date typed by the user (invoice date), as the "DD Mon YYYY" label
// every record stores. Accepts the date picker's YYYY-MM-DD or a label; anything
// else, or a date outside 2000-2100, gives "" so the caller falls back to today
// (new invoice) or keeps the old date (edit). Past AND future dates are fine:
// a client may ask for an invoice dated before or after the day it is raised.
function userDateLabel(value) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (iso) {
    // 2026-02-31 would silently roll over to 3 March; refuse it instead.
    const check = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (check.getMonth() !== Number(iso[2]) - 1) return "";
  }
  const label = isoToDateLabel(value);
  const d = parseDateLabel(label);
  if (!d || d.getFullYear() < 2000 || d.getFullYear() > 2100) return "";
  return formatDateLabel(d);
}

// Parses a "DD Mon YYYY" label (as produced by futureLabel/todayLabel) back into a Date.
function parseDateLabel(str) {
  if (!str) return null;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const parts = String(str).trim().split(" ");
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = months.indexOf(parts[1]);
  const year = parseInt(parts[2], 10);
  if (month === -1 || Number.isNaN(day) || Number.isNaN(year)) return null;
  return new Date(year, month, day);
}

// Returns { seq, number } — seq is used for default sort order (new records
// always get the highest seq so they appear first); number is used to build
// the human-readable id, which may have a numeric offset (e.g. PO-04xx).
async function nextSeqAndNumber(Model, offset = 0) {
  // Base the next number on the highest seq ever assigned, not the current
  // document count — using count() causes duplicate-key errors once any
  // record has been deleted (count drops, so a "new" number collides with
  // an id that's still in use).
  const last = await Model.findOne({}, { seq: 1 }).sort({ seq: -1 }).lean();
  const maxSeq = last?.seq || 0;
  return { seq: maxSeq + 1, number: maxSeq + 1 + offset };
}

// ---- Request-context helpers for the activity log ----

// Real client IP. `trust proxy` is on, so req.ip already accounts for
// X-Forwarded-For in production; here we just tidy the value.
function clientIp(req) {
  let ip = (req.ip || req.connection?.remoteAddress || "").toString();
  if (ip.startsWith("::ffff:")) ip = ip.slice(7); // IPv4-mapped IPv6
  if (ip === "::1" || ip === "127.0.0.1" || ip === "") return "127.0.0.1";
  return ip;
}

function isPrivateIp(ip) {
  return (
    !ip ||
    ip === "127.0.0.1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip.startsWith("::1") ||
    ip.toLowerCase().startsWith("fc") ||
    ip.toLowerCase().startsWith("fd")
  );
}

// "Chrome on Windows · Desktop" from a User-Agent string. Regex-only, no dep.
function parseUserAgent(ua = "") {
  ua = String(ua);
  if (!ua) return "Unknown device";

  const isTablet = /iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
  const isMobile = !isTablet && /Mobi|iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry/i.test(ua);
  const device = isTablet ? "Tablet" : isMobile ? "Mobile" : "Desktop";

  let os = "Unknown OS";
  if (/Windows NT 10/i.test(ua)) os = "Windows";
  else if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/CrOS/i.test(ua)) os = "ChromeOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Unknown browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/SamsungBrowser/i.test(ua)) browser = "Samsung Internet";
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Version\/.*Safari/i.test(ua)) browser = "Safari";
  else if (/MSIE|Trident/i.test(ua)) browser = "Internet Explorer";

  return `${browser} on ${os} · ${device}`;
}

// Best-effort city/country from IP. OFF unless GEOIP_ENABLED is truthy —
// when on, it makes one outbound HTTPS call per new IP (cached in memory)
// to a keyless geo-IP service. Never blocks or throws into the caller.
const geoCache = new Map();
async function geoLookup(ip) {
  if (!process.env.GEOIP_ENABLED || process.env.GEOIP_ENABLED === "false") return "";
  if (isPrivateIp(ip)) return "Local network";
  if (geoCache.has(ip)) return geoCache.get(ip);
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: AbortSignal.timeout(2500),
      headers: { "User-Agent": "siperp" },
    });
    const j = await res.json();
    const loc = [j.city, j.region, j.country_name].filter(Boolean).join(", ");
    const value = loc || "";
    geoCache.set(ip, value);
    return value;
  } catch {
    return "";
  }
}

// Fields that are never interesting in a before/after diff.
const AUDIT_NOISE_KEYS = new Set(["_id", "__v", "seq", "id", "createdAt", "updatedAt", "date"]);

function plainDoc(d) {
  if (!d) return null;
  return typeof d.toObject === "function" ? d.toObject() : d;
}

function shortAuditVal(v) {
  if (v == null) return v;
  if (typeof v === "string") return v.length > 300 ? v.slice(0, 300) + "…" : v;
  if (Array.isArray(v)) return `[${v.length} item${v.length === 1 ? "" : "s"}]`;
  if (typeof v === "object") return "[object]";
  return v;
}

// Whole-record snapshot (used for creates/deletes, where there's only one side).
function snapshotValues(doc) {
  const d = plainDoc(doc);
  if (!d) return null;
  const out = {};
  for (const k of Object.keys(d)) {
    if (AUDIT_NOISE_KEYS.has(k)) continue;
    out[k] = shortAuditVal(d[k]);
  }
  return out;
}

// Top-level fields that actually changed → { before:{k:old}, after:{k:new} }, or null.
function diffValues(before, after) {
  const b = plainDoc(before);
  const a = plainDoc(after);
  if (!b || !a) return null;
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const outB = {};
  const outA = {};
  let changed = false;
  for (const k of keys) {
    if (AUDIT_NOISE_KEYS.has(k)) continue;
    if (JSON.stringify(b[k]) === JSON.stringify(a[k])) continue;
    outB[k] = shortAuditVal(b[k]);
    outA[k] = shortAuditVal(a[k]);
    changed = true;
  }
  return changed ? { before: outB, after: outA } : null;
}

// Writes one audit row, retrying on the unique-id race (concurrent writers
// can compute the same next seq; `id` is unique so one create throws).
async function writeAuditRow(Model, doc) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const last = await Model.findOne({}, { seq: 1 }).sort({ seq: -1 }).lean();
      const nextSeq = (last?.seq || 0) + 1;
      await Model.create({ id: `AUD-${String(nextSeq).padStart(5, "0")}`, seq: nextSeq, ...doc });
      return;
    } catch (e) {
      if (e && e.code === 11000 && attempt < 3) continue;
      return; // logging must never break the request
    }
  }
}

// Main audit writer. `req` (optional) supplies actor headers + IP/device/location.
// Setting `opts.before`/`opts.after` records a value diff. Sets req._audited so
// the generic middleware doesn't also log a plain row for the same request.
async function audit(req, opts = {}) {
  // Claim the request synchronously: callers don't await this, and the
  // res "finish" hook can fire before the awaits below resolve — setting the
  // flag later would let the generic middleware log a duplicate row.
  if (req) req._audited = true;
  try {
    const path = req ? (req.originalUrl || req.path || "").split("?")[0] : "";
    // Both sides given → record only what changed. One side (create/delete)
    // → record that whole snapshot.
    let diff = null;
    if (opts.before !== undefined && opts.after !== undefined) {
      diff = diffValues(opts.before, opts.after);
    } else if (opts.before !== undefined) {
      diff = { before: snapshotValues(opts.before), after: null };
    } else if (opts.after !== undefined) {
      diff = { before: null, after: snapshotValues(opts.after) };
    }

    let ip = "";
    let device = "";
    let location = "";
    if (req) {
      ip = clientIp(req);
      device = parseUserAgent(req.headers["user-agent"]);
      location = await geoLookup(ip);
    }

    const Model = (req && req._auditModels && req._auditModels.ActivityLog) || ActivityLog;
    await writeAuditRow(Model, {
      user: opts.user || (req && req.headers["x-user"]) || "System",
      role: opts.role || (req && req.headers["x-user-role"]) || "",
      action: opts.action || "Action",
      module: opts.module || moduleForPath(path) || "",
      status: opts.status || "Success",
      entityType: opts.entityType || "",
      entityId: opts.entityId || "",
      description: opts.description || "",
      details: opts.description || opts.details || "", // keep old column populated
      method: (req && req.method) || "",
      path,
      date: todayLabel(),
      ip,
      device,
      location,
      before: diff ? diff.before : null,
      after: diff ? diff.after : null,
    });
  } catch (_e) {
    // Audit logging must never break the request it's attached to.
  }
}

// Back-compat shim for older call sites.
async function logActivity(user, action, details = "", req = null) {
  await audit(req, { user, action, description: details, module: "Authentication" });
}

// ---- Document numbering (Settings > Numbering Settings) ----
// Each document type is numbered prefix + zero-padded serial, all three
// parts configurable per tenant. Before this existed the prefixes were
// hardcoded here and the settings screen saved values nothing ever read.
//
// FALLBACKS are the old hardcoded prefixes, used only when a tenant has no
// value stored, so a brand-new tenant numbers exactly as before.
const DOC_NUMBERING = {
  invoice: { prefix: "PSINV-", start: 2001, digits: 4 },
  salesOrder: { prefix: "PSO-", start: 1, digits: 4 },
  purchaseOrder: { prefix: "PO-", start: 401, digits: 4 },
  quotation: { prefix: "QTN-", start: 1, digits: 4 },
  deliveryChallan: { prefix: "PDC-", start: 1, digits: 4 },
  customerCode: { prefix: "CUST-", start: 1, digits: 4 },
  supplierCode: { prefix: "SUP-", start: 1, digits: 4 },
};

// Claims the next serial for `kind` and advances the stored counter in one
// atomic $inc, so two simultaneous creates can never take the same number.
async function claimSerial(kind) {
  const fallback = DOC_NUMBERING[kind];
  const prefixField = `${kind}Prefix`;
  const nextField = `${kind}NextNumber`;
  const digitsField = `${kind}Digits`;

  // findOneAndUpdate with new:false hands back the pre-increment document,
  // i.e. the number this caller owns.
  const claim = () =>
    Settings.findOneAndUpdate(
      { [nextField]: { $type: "number" } },
      { $inc: { [nextField]: 1 } },
      { new: false }
    ).lean();

  let doc = await claim();
  if (!doc) {
    // Counter not initialised (a Settings doc written before these fields
    // existed). Seed it, leaving any prefix the admin already set alone.
    await Settings.updateOne(
      {},
      { $set: { [nextField]: fallback.start, [digitsField]: fallback.digits } },
      { upsert: true }
    );
    doc = await claim();
  }

  const prefix = doc && doc[prefixField] != null ? doc[prefixField] : fallback.prefix;
  const digits = Number(doc && doc[digitsField]) || fallback.digits;
  const n = Number(doc && doc[nextField]) || fallback.start;
  return { prefix, digits, n };
}

// Returns the next free id for `Model`. An admin can rewind "Next Number",
// so skip forward over any id that already exists rather than letting the
// unique index reject the create.
async function allocateDocNumber(Model, kind) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const { prefix, digits, n } = await claimSerial(kind);
    const id = `${prefix}${String(n).padStart(digits, "0")}`;
    if (!(await Model.exists({ id }))) return id;
  }
  throw new Error(
    "Could not allocate a free document number — check Next Number in Numbering Settings."
  );
}

// Resolves an invoice/bill due date the way the business actually works:
// the customer's or supplier's own payment terms win, then the global
// default in Settings, then a hardcoded fallback. Previously every due
// date was a hardcoded futureLabel() and paymentTerms was never read.
async function defaultDueDate(kind, partyTerms, fromDate) {
  const settings = (await Settings.findOne().lean()) || {};
  const globalTerms = kind === "purchase" ? settings.purchasePaymentTerms : settings.salesPaymentTerms;
  const hardFallback = kind === "purchase" ? 30 : 15;
  const days = parseTermDays(partyTerms, parseTermDays(globalTerms, hardFallback));
  return futureLabel(days, fromDate);
}

// Free-text search across a model's text fields (and the text fields of any
// line-item sub-documents, e.g. a PO's items[].product). Used by ?search= on
// every list endpoint that goes through paginate().
function buildSearchFilter(Model, term) {
  const text = String(term || "").trim().slice(0, 100);
  if (!text) return null;
  const rx = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const clauses = [];
  Object.entries(Model.schema.paths).forEach(([p, type]) => {
    if (p === "_id" || p === "__v") return;
    if (type.instance === "String") {
      clauses.push({ [p]: rx });
    } else if (type.instance === "Array" && type.schema) {
      Object.entries(type.schema.paths).forEach(([sub, subType]) => {
        if (subType.instance === "String" && sub !== "_id") clauses.push({ [`${p}.${sub}`]: rx });
      });
    }
  });
  return clauses.length ? { $or: clauses } : null;
}

async function paginate(Model, baseFilter, req) {
  const page = parseInt(req.query.page, 10) || 1;
  const pageSize = parseInt(req.query.pageSize, 10) || 5;
  const skip = (page - 1) * pageSize;
  const searchFilter = buildSearchFilter(Model, req.query.search);
  const hasBase = baseFilter && Object.keys(baseFilter).length > 0;
  const filter = searchFilter ? (hasBase ? { $and: [baseFilter, searchFilter] } : searchFilter) : baseFilter;
  const isUnfiltered = !filter || Object.keys(filter).length === 0;
  const [data, total] = await Promise.all([
    // .lean() returns plain objects (no Mongoose document overhead) and the
    // projection drops _id/__v the frontend never uses — both cut response
    // build time and payload size on every list request.
    Model.find(filter, { _id: 0, __v: 0 }).sort({ seq: -1 }).skip(skip).limit(pageSize).lean(),
    isUnfiltered ? Model.estimatedDocumentCount() : Model.countDocuments(filter),
  ]);
  return {
    data,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// Strips fields that must never be overwritten via a PUT body.
// A plain {} object, not an array/null/string — used to validate a
// submitted `customFields` map before it's trusted and saved as-is.
function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function cleanUpdateBody(body) {
  const clean = { ...(body || {}) };
  delete clean._id;
  delete clean.id;
  delete clean.seq;
  delete clean.createdAt;
  delete clean.updatedAt;
  delete clean.__v;
  return clean;
}

// Generic update/delete routes for simple resources looked up by their
// human-readable `id` field. `sanitize` may mutate the update payload
// in place (e.g. to clean a phone number) before it's saved.
function addCrudRoutes(path, Model, { sanitize } = {}) {
  const auditModule = moduleForPath(path);

  // Single-record read, so a standalone Edit page can load what it is
  // editing. Resources that need a richer detail payload (customers,
  // suppliers, sales and purchase documents) declare their own GET earlier
  // in this file — Express keeps the first match, so those still win.
  app.get(
    `${path}/:id`,
    asyncHandler(async (req, res) => {
      const doc = await Model.findOne({ id: req.params.id });
      if (!doc) return res.status(404).json({ message: "Record not found." });
      res.json(doc);
    })
  );

  app.put(
    `${path}/:id`,
    asyncHandler(async (req, res) => {
      const updates = cleanUpdateBody(req.body);
      if (sanitize) sanitize(updates);
      const before = await Model.findOne({ id: req.params.id });
      const updated = await Model.findOneAndUpdate({ id: req.params.id }, { $set: updates }, { new: true });
      if (!updated) return res.status(404).json({ message: "Record not found." });
      res.json(updated);
      audit(req, {
        action: "Update",
        module: auditModule,
        entityType: Model.modelName,
        entityId: req.params.id,
        description: `Updated ${Model.modelName} ${req.params.id}`,
        before,
        after: updated,
      });
    })
  );

  app.delete(
    `${path}/:id`,
    asyncHandler(async (req, res) => {
      const deleted = await Model.findOneAndDelete({ id: req.params.id });
      if (!deleted) return res.status(404).json({ message: "Record not found." });
      res.json({ success: true });
      audit(req, {
        action: "Delete",
        module: auditModule,
        entityType: Model.modelName,
        entityId: req.params.id,
        description: `Deleted ${Model.modelName} ${req.params.id}`,
        before: deleted,
      });
    })
  );
}

function buildSalesOrderFilter(query) {
  const filter = {};
  if (query.customer && query.customer !== "all") filter.customer = query.customer;
  if (query.status && query.status !== "all") filter.status = query.status;
  if (query.salesRep && query.salesRep !== "all") filter.salesRep = query.salesRep;
  // ?search= is handled generically by paginate() (all text fields + line items).
  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }
  return filter;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Shop-floor summary for the dashboard. Everything here is derived live from
// work orders and production receipts — nothing is stored pre-aggregated.
async function computeManufacturingSummary(models, thisMonthStart) {
  const { WorkOrder, ProductionReceipt, Machine, Bom } = models;
  const OPEN_STATUSES = ["Draft", "Released", "In Progress"];

  const [draft, released, inProgress, completedTotal, activeBoms] = await Promise.all([
    WorkOrder.countDocuments({ status: "Draft" }),
    WorkOrder.countDocuments({ status: "Released" }),
    WorkOrder.countDocuments({ status: "In Progress" }),
    WorkOrder.countDocuments({ status: "Completed" }),
    Bom.countDocuments({ status: "Active" }),
  ]);

  // Output booked this month. Only accepted quantity counts as production;
  // rejects are tracked separately so the yield figure means something.
  const [outputAgg] = await ProductionReceipt.aggregate([
    { $match: { status: "Accepted", createdAt: { $gte: thisMonthStart } } },
    { $group: { _id: null, accepted: { $sum: "$acceptedQty" }, rejected: { $sum: "$rejectedQty" } } },
  ]);
  const producedThisMonth = outputAgg?.accepted || 0;
  const rejectedThisMonth = outputAgg?.rejected || 0;
  const totalOutput = producedThisMonth + rejectedThisMonth;
  const yieldPct = totalOutput > 0 ? Math.round((producedThisMonth / totalOutput) * 1000) / 10 : null;

  // Orders that are released to the floor but still waiting on material —
  // the single most useful "why is nothing moving" signal.
  const [shortageAgg] = await WorkOrder.aggregate([
    { $match: { status: { $in: ["Released", "In Progress"] } } },
    {
      $addFields: {
        short: {
          $filter: {
            input: { $ifNull: ["$requirements", []] },
            cond: { $lt: [{ $ifNull: ["$$this.issuedQty", 0] }, { $ifNull: ["$$this.requiredQty", 0] }] },
          },
        },
      },
    },
    { $match: { "short.0": { $exists: true } } },
    { $count: "n" },
  ]);

  // Due dates are stored as display labels ("12 Sep 2026"), which Mongo can't
  // compare — so overdue is worked out in JS over the open orders only.
  const openOrders = await WorkOrder.find({ status: { $in: OPEN_STATUSES } }, { id: 1, dueDate: 1 }).lean();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const overdue = openOrders.filter((w) => {
    const due = parseDateLabel(w.dueDate);
    return due && due < startOfToday;
  }).length;

  const machinesDown = await Machine.countDocuments({ status: { $in: ["Under Maintenance", "Breakdown"] } });

  return {
    stats: {
      openWorkOrders: draft + released + inProgress,
      draft,
      released,
      inProgress,
      completedTotal,
      activeBoms,
      producedThisMonth,
      rejectedThisMonth,
      yieldPct,
      materialShortages: shortageAgg?.n || 0,
      overdueWorkOrders: overdue,
      machinesDown,
    },
    recentWorkOrders: await WorkOrder.find(
      {},
      { id: 1, product: 1, plannedQty: 1, producedQty: 1, unit: 1, status: 1, dueDate: 1, workCenter: 1 }
    )
      .sort({ seq: -1 })
      .limit(5)
      .lean(),
  };
}

// Accepted output per month, same shape as computeSalesTrend so the frontend
// can render it with the identical chart component.
async function computeProductionTrend(ProductionReceipt, months = 12) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const agg = await ProductionReceipt.aggregate([
    { $match: { status: "Accepted", createdAt: { $gte: start } } },
    {
      $group: {
        _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" } },
        total: { $sum: "$acceptedQty" },
      },
    },
  ]);
  const totalsByKey = {};
  agg.forEach((row) => {
    totalsByKey[`${row._id.y}-${row._id.m}`] = row.total;
  });

  const trend = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    trend.push({ month: MONTH_LABELS[d.getMonth()], value: totalsByKey[`${d.getFullYear()}-${d.getMonth() + 1}`] || 0 });
  }
  return trend;
}

// Builds a real monthly revenue trend (based on when invoices were actually
// created) instead of hardcoded numbers — always reflects the live database.
async function computeSalesTrend(months = 6) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const agg = await Invoice.aggregate([
    { $match: { createdAt: { $gte: start } } },
    {
      $group: {
        _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" } },
        total: { $sum: "$amount" },
      },
    },
  ]);
  const totalsByKey = {};
  agg.forEach((row) => {
    totalsByKey[`${row._id.y}-${row._id.m}`] = row.total;
  });

  const trend = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    trend.push({ month: MONTH_LABELS[d.getMonth()], value: totalsByKey[key] || 0 });
  }
  return trend;
}

const REPORTS = [
  { id: "RPT-01", name: "Sales Summary Report", category: "Sales", description: "Monthly and yearly sales performance by customer, product and region." },
  { id: "RPT-02", name: "Inventory Valuation Report", category: "Inventory", description: "Current stock quantity and value across all warehouses." },
  { id: "RPT-03", name: "Purchase Analysis Report", category: "Purchase", description: "Supplier-wise purchase spend and delivery performance." },
  { id: "RPT-04", name: "Accounts Receivable Aging", category: "Finance", description: "Outstanding customer invoices grouped by aging bucket." },
  { id: "RPT-05", name: "Customer Outstanding Report", category: "Finance", description: "Customer-wise outstanding balances and credit limits." },
  { id: "RPT-06", name: "Low Stock Alert Report", category: "Inventory", description: "Products below reorder level that need replenishment." },
];

// ---------- Auth ----------
// Which client this request is signing in to. Pre-authentication, so it does
// still come from the subdomain header — but it only chooses WHICH database to
// check credentials against. Without a matching password nothing comes back,
// and from here on the tenant is read off the session instead.
function loginTenant(req) {
  return String(req.headers["x-tenant"] || "").toLowerCase().trim();
}

app.post(
  "/api/auth/login",
  loginThrottle({ keyFor: (req) => `${loginTenant(req)}|${String((req.body || {}).username || "").trim()}` }),
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      await audit(req, {
        user: username || "(unknown)",
        action: "Failed Login",
        module: "Authentication",
        status: "Failed",
        description: "Username or password missing",
      });
      return res.status(400).json({ success: false, message: "Username and password are required." });
    }

    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});

    const enteredUser = username.trim().toLowerCase();
    const storedUser = (settings.username || "admin").trim().toLowerCase();

    // ---- the built-in admin, from Company Settings ----
    if (enteredUser === storedUser) {
      // Either a stored hash, or — for an install that predates hashing — the
      // legacy plain-text field, which is upgraded on the spot. Nobody has to
      // be migrated in a maintenance window; the column empties as people
      // sign in. The "admin123" fallback is kept only so a brand-new install
      // with no settings row can still get in.
      const legacy = settings.password || "admin123";
      const viaHash = settings.adminPasswordHash
        ? clientAuth.verifyPassword(password, settings.adminPasswordHash)
        : false;
      const viaLegacy = !settings.adminPasswordHash && password === legacy;

      if (viaHash || viaLegacy) {
        if (viaLegacy) {
          await Settings.updateOne(
            { _id: settings._id },
            { $set: { adminPasswordHash: clientAuth.hashPassword(password), password: "" } }
          );
        }
        const rawName = username.includes("@") ? username.split("@")[0] : username;
        const derivedName =
          rawName
            .replace(/[._]+/g, " ")
            .trim()
            .split(" ")
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ") || "Admin";
        const displayName = settings.adminName || derivedName;
        const email = username.includes("@") ? username : `${username}@company.com`;

        const session = await clientAuth.createSession(
          {
            tenantSubdomain: loginTenant(req),
            userId: "",
            name: displayName,
            email,
            role: "Administrator",
            builtin: true,
          },
          req
        );

        await audit(req, {
          user: displayName,
          role: "Administrator",
          action: "Login",
          module: "Authentication",
          description: `Signed in as ${username}`,
        });
        return res.json({
          success: true,
          token: session.token,
          expiresAt: session.expiresAt,
          user: {
            builtin: true,
            name: displayName,
            role: "Administrator",
            email,
            avatar: settings.adminAvatar || "🙂",
          },
        });
      }
    }

    // ---- accounts created under Users & Roles ----
    const matchedUser = await User.findOne({ email: emailRegex(username.trim()) });
    if (matchedUser) {
      const viaHash = matchedUser.passwordHash
        ? clientAuth.verifyPassword(password, matchedUser.passwordHash)
        : false;
      // Same one-time upgrade as above.
      const viaLegacy = !matchedUser.passwordHash && matchedUser.password && matchedUser.password === password;

      if (viaHash || viaLegacy) {
        if (matchedUser.status === "Invited") {
          return res.status(401).json({
            success: false,
            message: "This account has not been set up yet. Use the link in your invitation email.",
          });
        }
        if (matchedUser.status !== "Active") {
          await audit(req, {
            user: matchedUser.name,
            role: matchedUser.role || "",
            action: "Failed Login",
            module: "Authentication",
            status: "Failed",
            description: "Account is inactive",
          });
          return res
            .status(401)
            .json({ success: false, message: "This account is inactive. Contact your administrator." });
        }

        const update = { lastLogin: todayLabel() };
        if (viaLegacy) {
          update.passwordHash = clientAuth.hashPassword(password);
          update.password = "";
          update.passwordSetAt = new Date();
        }
        await User.findOneAndUpdate({ id: matchedUser.id }, { $set: update });

        const session = await clientAuth.createSession(
          {
            tenantSubdomain: loginTenant(req),
            userId: matchedUser.id,
            name: matchedUser.name,
            email: matchedUser.email,
            role: matchedUser.role || "Viewer",
            builtin: false,
          },
          req
        );

        await audit(req, {
          user: matchedUser.name,
          role: matchedUser.role || "Viewer",
          action: "Login",
          module: "Authentication",
          description: `Signed in as ${matchedUser.email}`,
        });
        return res.json({
          success: true,
          token: session.token,
          expiresAt: session.expiresAt,
          user: {
            builtin: false,
            id: matchedUser.id,
            name: matchedUser.name,
            role: matchedUser.role || "Viewer",
            email: matchedUser.email,
            avatar: "🙂",
          },
        });
      }
    }

    await audit(req, {
      user: username,
      action: "Failed Login",
      module: "Authentication",
      status: "Failed",
      description: "Incorrect username or password",
    });
    // Deliberately identical whether the account exists or not — a different
    // message here is how an attacker enumerates who works at a company.
    return res.status(401).json({ success: false, message: "Incorrect username or password." });
  })
);

// Register / Create Account endpoint
app.post(
  "/api/auth/register",
  loginThrottle({ keyFor: (req) => `${loginTenant(req)}|reg|${req.ip}` }),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Full name is required." });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: "Email address is required." });
    }
    if (!password) {
      return res.status(400).json({ success: false, message: "Password is required." });
    }

    const problem = clientAuth.passwordProblem(password);
    if (problem) {
      return res.status(400).json({ success: false, message: problem });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if email already belongs to settings/admin
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});
    const adminEmail = (settings.email || settings.adminEmail || "").trim().toLowerCase();
    const adminUser = (settings.username || "admin").trim().toLowerCase();
    if (cleanEmail === adminEmail || cleanEmail === adminUser) {
      return res.status(409).json({ success: false, message: "An account with this email already exists." });
    }

    // Check if email belongs to an existing User
    const existing = await User.findOne({ email: emailRegex(cleanEmail) });
    if (existing) {
      return res.status(409).json({ success: false, message: "An account with this email already exists." });
    }

    const totalUsers = await User.countDocuments();
    // Every registered user receives Administrator role so they can manage their account and top up via Razorpay
    const isFirstUser = totalUsers === 0 && (!settings.email || settings.email === "");
    const role = "Administrator";
    const nextSeq = totalUsers + 1;
    const userId = "usr_" + Math.random().toString(36).substring(2, 10);

    const newUser = await User.create({
      id: userId,
      seq: nextSeq,
      name: name.trim(),
      email: cleanEmail,
      passwordHash: clientAuth.hashPassword(password),
      passwordSetAt: new Date(),
      role,
      status: "Active",
      lastLogin: todayLabel(),
    });

    if (isFirstUser) {
      settings.email = cleanEmail;
      settings.adminName = name.trim();
      await settings.save();
    }

    const session = await clientAuth.createSession(
      {
        tenantSubdomain: loginTenant(req),
        userId: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        builtin: false,
      },
      req
    );

    await audit(req, {
      user: newUser.name,
      role: newUser.role,
      action: "Register",
      module: "Authentication",
      description: `Registered new account as ${newUser.email}`,
    });

    return res.json({
      success: true,
      token: session.token,
      expiresAt: session.expiresAt,
      user: {
        builtin: false,
        id: newUser.id,
        name: newUser.name,
        role: newUser.role,
        email: newUser.email,
        avatar: "🙂",
      },
    });
  })
);

// Verify Google ID token or Google access token
async function verifyGoogleUser({ credential, access_token }) {
  if (credential) {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google token validation failed: ${errText}`);
    }
    const data = await res.json();
    return {
      email: data.email,
      name: data.name || data.email,
      picture: data.picture || "",
      sub: data.sub,
      email_verified: data.email_verified === "true" || data.email_verified === true,
      aud: data.aud,
    };
  }

  if (access_token) {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google profile validation failed: ${errText}`);
    }
    const data = await res.json();
    return {
      email: data.email,
      name: data.name || data.email,
      picture: data.picture || "",
      sub: data.sub,
      email_verified: data.email_verified === true,
      aud: data.aud,
    };
  }

  throw new Error("No Google credential or access token provided.");
}

// Google Sign-In endpoint
app.post(
  "/api/auth/google",
  loginThrottle({ keyFor: (req) => `${loginTenant(req)}|google|${req.ip}` }),
  asyncHandler(async (req, res) => {
    const { credential, access_token } = req.body || {};
    if (!credential && !access_token) {
      return res.status(400).json({ success: false, message: "Google authentication token missing." });
    }

    let googleProfile;
    try {
      googleProfile = await verifyGoogleUser({ credential, access_token });
    } catch (err) {
      await audit(req, {
        user: "(google)",
        action: "Failed Login",
        module: "Authentication",
        status: "Failed",
        description: err.message,
      });
      return res.status(401).json({ success: false, message: "Google verification failed. Please try again." });
    }

    if (!googleProfile.email || !googleProfile.email_verified) {
      return res.status(400).json({
        success: false,
        message: "Your Google account email is either missing or unverified.",
      });
    }

    const email = googleProfile.email.toLowerCase().trim();

    // 1. Built-in admin match
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});

    const adminUsername = (settings.username || "admin").trim().toLowerCase();
    const adminEmail = (settings.email || settings.adminEmail || "").trim().toLowerCase();
    const isBuiltinAdmin = (adminUsername && email === adminUsername) || (adminEmail && email === adminEmail);

    if (isBuiltinAdmin) {
      const displayName = settings.adminName || googleProfile.name || "Admin";
      const session = await clientAuth.createSession(
        {
          tenantSubdomain: loginTenant(req),
          userId: "",
          name: displayName,
          email,
          role: "Administrator",
          builtin: true,
        },
        req
      );

      await audit(req, {
        user: displayName,
        role: "Administrator",
        action: "Login",
        module: "Authentication",
        description: `Signed in with Google as admin (${email})`,
      });

      return res.json({
        success: true,
        token: session.token,
        expiresAt: session.expiresAt,
        user: {
          builtin: true,
          name: displayName,
          role: "Administrator",
          email,
          avatar: googleProfile.picture || settings.adminAvatar || "🙂",
        },
      });
    }

    // 2. User account match
    const matchedUser = await User.findOne({ email: emailRegex(email) });
    if (matchedUser) {
      if (matchedUser.status === "Inactive") {
        await audit(req, {
          user: matchedUser.name,
          role: matchedUser.role || "",
          action: "Failed Login",
          module: "Authentication",
          status: "Failed",
          description: "Account is inactive (Google sign-in)",
        });
        return res.status(401).json({
          success: false,
          message: "This account is inactive. Contact your administrator.",
        });
      }

      const update = { lastLogin: todayLabel() };
      if (matchedUser.status === "Invited") {
        update.status = "Active";
      }
      await User.findOneAndUpdate({ id: matchedUser.id }, { $set: update });

      const session = await clientAuth.createSession(
        {
          tenantSubdomain: loginTenant(req),
          userId: matchedUser.id,
          name: matchedUser.name,
          email: matchedUser.email,
          role: matchedUser.role || "Viewer",
          builtin: false,
        },
        req
      );

      await audit(req, {
        user: matchedUser.name,
        role: matchedUser.role || "Viewer",
        action: "Login",
        module: "Authentication",
        description: `Signed in with Google as ${matchedUser.email}`,
      });

      return res.json({
        success: true,
        token: session.token,
        expiresAt: session.expiresAt,
        user: {
          builtin: false,
          id: matchedUser.id,
          name: matchedUser.name,
          role: matchedUser.role || "Viewer",
          email: matchedUser.email,
          avatar: googleProfile.picture || "🙂",
        },
      });
    }

    // 3. User does not exist — require account creation first
    await audit(req, {
      user: email,
      action: "Failed Login",
      module: "Authentication",
      status: "Failed",
      description: "Google email not associated with any SIPERP user",
    });

    return res.status(401).json({
      success: false,
      message: `No SIPERP account is linked with ${email}. Please create an account first.`,
    });
  })
);

// Ends the session server-side, so the token stops working immediately rather
// than merely being forgotten by the browser.
app.post(
  "/api/auth/logout",
  asyncHandler(async (req, res) => {
    await clientAuth.destroySession(clientAuth.tokenFromRequest(req));
    await audit(req, { action: "Logout", module: "Authentication", description: "Signed out" });
    res.json({ success: true });
  })
);

// Who the bearer token belongs to. The frontend calls this on load so a
// refresh does not depend on whatever it cached in localStorage — if the
// session has been revoked or has expired, this says so.
app.get(
  "/api/auth/me",
  asyncHandler(async (req, res) => {
    const session = await clientAuth.resolveSession(clientAuth.tokenFromRequest(req));
    if (!session) return res.status(401).json({ success: false, message: "Not signed in." });
    res.json({
      success: true,
      user: {
        builtin: session.builtin,
        id: session.userId || undefined,
        name: session.name,
        role: session.role,
        email: session.email,
        avatar: "🙂",
      },
      expiresAt: session.expiresAt,
    });
  })
);


// ---------- Setting and changing passwords ----------
//
// Invitations and resets share one mechanism: a single-use token, stored only
// as its SHA-256, emailed as a link. An admin never types a password on
// somebody else's behalf, so nobody's password is ever known to a second
// person — which is the point of the exercise.

// Where the set-password link points.
//
// The API and the client app are NOT the same host — the API lives on its own
// host (e.g. api.<domain>), while every client's own app is served from its
// own subdomain (<subdomain>.<domain>; see the toast in ClientForm.jsx and the
// Subdomain column in Clients.jsx, which assume this same pattern). The domain
// is NOT written into the code: set APP_BASE_DOMAIN in the environment. It is
// deliberately not guessed from the request, because a reset link built from a
// caller-supplied host could be pointed at someone else's site. Building the link from the API
// request's own host — the previous behaviour — always pointed it at the
// API instead, giving a dead "Cannot GET /set-password" link. When the
// caller's tenant is known (an authenticated request — invite/reset always
// is), the client's own subdomain is used instead. APP_ORIGIN remains an
// escape hatch for a single fixed frontend origin, used only when no tenant
// is known (there being no one right subdomain to guess in that case).
const APP_BASE_DOMAIN = String(process.env.APP_BASE_DOMAIN || "").trim().replace(/^\.+/, "");
const APP_DEV_PORT = process.env.APP_DEV_PORT || "5173";
if (!APP_BASE_DOMAIN && !process.env.APP_ORIGIN) {
  // eslint-disable-next-line no-console
  console.warn(
    "APP_BASE_DOMAIN is not set: set-password and reset links cannot point at a client's own address. " +
    "Set APP_BASE_DOMAIN (e.g. example.com) in the environment."
  );
}

function appOrigin(req) {
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "http").split(",")[0];
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0];
  // Set by the auth middleware from the verified session — not client input —
  // for any already-authenticated request, which every caller of appOrigin() is.
  const subdomain = String(req.headers["x-tenant"] || "").trim();
  if (subdomain) {
    const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
    if (isLocal) return `http://${subdomain}.localhost:${APP_DEV_PORT}`;
    if (APP_BASE_DOMAIN) return `https://${subdomain}.${APP_BASE_DOMAIN}`;
    // No domain configured: use the fixed frontend origin if there is one.
  }
  return process.env.APP_ORIGIN || (host ? `${proto}://${host}` : "");
}

// Issues a token for a user and tries to email it. Returns what the caller
// should tell the admin — including the raw link, ALWAYS, so an unconfigured
// mail server never leaves somebody unable to be invited.
async function issueSetPasswordLink(req, user, purpose) {
  const { token, fields } = clientAuth.createInviteToken(purpose);
  await User.updateOne({ id: user.id }, { $set: fields });

  const link = `${appOrigin(req)}/set-password?token=${token}`;
  const settings = (await Settings.findOne().lean()) || {};
  const mail = setPasswordEmail({
    name: user.name,
    companyName: settings.companyName,
    link,
    purpose,
    expiresHours: Math.round(clientAuth.INVITE_TTL_MS / 3600000),
  });
  const result = await sendMail(settings, { to: user.email, ...mail });
  return {
    link,
    emailed: result.sent,
    emailError: result.sent ? "" : result.error,
    smtpConfigured: smtpConfigured(settings),
  };
}

// Invite, or re-invite, a user. Admin-only by way of the users module gate
// that already protects /api/users.
app.post(
  "/api/users/:id/invite",
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ id: req.params.id }).lean();
    if (!user) return res.status(404).json({ message: "User not found." });
    if (!user.email) return res.status(400).json({ message: "This user has no email address to send an invite to." });

    const out = await issueSetPasswordLink(req, user, user.passwordHash ? "reset" : "invite");
    await User.updateOne({ id: user.id }, { $set: { status: user.passwordHash ? user.status : "Invited" } });
    await audit(req, {
      action: "Invited",
      module: "Users",
      entityType: "User",
      entityId: user.id,
      description: `Sent a set-password link to ${user.email}`,
    });
    res.json({ success: true, ...out });
  })
);

// What the set-password screen asks before showing its form: is this link
// real, and whose is it? Deliberately says nothing about the account beyond a
// first name — a leaked link should not also leak an email address.
app.get(
  "/api/auth/set-password/check",
  asyncHandler(async (req, res) => {
    const token = String(req.query.token || "");
    const user = token ? await User.findOne({ inviteTokenHash: clientAuth.sha256(token) }).lean() : null;
    if (!user || !clientAuth.inviteTokenValid(user, token)) {
      return res.status(400).json({
        valid: false,
        message: "This link has expired or has already been used. Ask for a new one.",
      });
    }
    res.json({
      valid: true,
      name: String(user.name || "").split(" ")[0],
      purpose: user.invitePurpose || "invite",
      minLength: clientAuth.MIN_PASSWORD_LENGTH,
    });
  })
);

// Setting the password the link was issued for.
app.post(
  "/api/auth/set-password",
  asyncHandler(async (req, res) => {
    const { token, password } = req.body || {};
    const found = token ? await User.findOne({ inviteTokenHash: clientAuth.sha256(String(token)) }) : null;
    if (!found || !clientAuth.inviteTokenValid(found, token)) {
      return res.status(400).json({ message: "This link has expired or has already been used." });
    }
    const problem = clientAuth.passwordProblem(password);
    if (problem) return res.status(400).json({ message: problem });

    await User.updateOne(
      { id: found.id },
      {
        $set: {
          passwordHash: clientAuth.hashPassword(password),
          passwordSetAt: new Date(),
          // The legacy plain-text column empties here too, not just on login.
          password: "",
          status: found.status === "Invited" ? "Active" : found.status,
          ...clientAuth.CLEAR_INVITE,
        },
      }
    );
    // Any session opened before the password changed is no longer trustworthy
    // — a reset is often a response to a suspected compromise.
    await clientAuth.destroySessionsForUser(String(req.headers["x-tenant"] || ""), found.id);

    await audit(req, {
      user: found.name,
      action: "Password Changed",
      module: "Authentication",
      entityType: "User",
      entityId: found.id,
      description: `Password set via ${found.invitePurpose === "reset" ? "reset" : "invitation"} link`,
    });
    res.json({ success: true, message: "Password set. You can sign in now." });
  })
);

// Forgotten password. Always answers the same way, whether or not the address
// exists — a different response here is how an attacker learns who works at a
// company.
app.post(
  "/api/auth/forgot-password",
  asyncHandler(async (req, res) => {
    const email = String((req.body || {}).email || "").trim();
    const generic = {
      success: true,
      message: "If that email belongs to an account, a reset link is on its way.",
    };
    if (!email) return res.json(generic);

    const user = await User.findOne({ email: emailRegex(email) }).lean();
    if (!user || user.status === "Inactive") return res.json(generic);

    const out = await issueSetPasswordLink(req, user, "reset");
    await audit(req, {
      user: user.name,
      action: "Password Reset Requested",
      module: "Authentication",
      entityType: "User",
      entityId: user.id,
      description: `Reset link requested for ${user.email}`,
    });
    // The link is never returned here — only the invite route, which is behind
    // the admin gate, hands it back for manual delivery.
    if (!out.emailed) console.error("Password reset email failed:", out.emailError);
    res.json(generic);
  })
);

// Changing your own password, knowing the current one.
app.post(
  "/api/auth/change-password",
  asyncHandler(async (req, res) => {
    const session = req._session;
    if (!session) return res.status(401).json({ message: "Sign in first." });
    const { currentPassword, newPassword } = req.body || {};

    const problem = clientAuth.passwordProblem(newPassword);
    if (problem) return res.status(400).json({ message: problem });
    if (currentPassword === newPassword) {
      return res.status(400).json({ message: "The new password is the same as the current one." });
    }

    // The built-in admin account lives in Settings, everyone else in Users.
    if (session.builtin) {
      const settings = await Settings.findOne();
      const ok = settings.adminPasswordHash
        ? clientAuth.verifyPassword(currentPassword, settings.adminPasswordHash)
        : String(currentPassword) === String(settings.password || "admin123");
      if (!ok) return res.status(400).json({ message: "Your current password is not correct." });
      await Settings.updateOne(
        { _id: settings._id },
        { $set: { adminPasswordHash: clientAuth.hashPassword(newPassword), password: "" } }
      );
    } else {
      const user = await User.findOne({ id: session.userId });
      if (!user) return res.status(404).json({ message: "Account not found." });
      const ok = user.passwordHash
        ? clientAuth.verifyPassword(currentPassword, user.passwordHash)
        : Boolean(user.password) && user.password === currentPassword;
      if (!ok) return res.status(400).json({ message: "Your current password is not correct." });
      await User.updateOne(
        { id: user.id },
        {
          $set: {
            passwordHash: clientAuth.hashPassword(newPassword),
            passwordSetAt: new Date(),
            password: "",
            ...clientAuth.CLEAR_INVITE,
          },
        }
      );
    }

    // Every other session for this account ends; the one making the change is
    // reissued, so the person doing it is not signed out of their own browser.
    await clientAuth.destroySessionsForUser(session.tenantSubdomain, session.userId);
    const fresh = await clientAuth.createSession(
      {
        tenantSubdomain: session.tenantSubdomain,
        userId: session.userId,
        name: session.name,
        email: session.email,
        role: session.role,
        builtin: session.builtin,
      },
      req
    );

    await audit(req, {
      user: session.name,
      role: session.role,
      action: "Password Changed",
      module: "Authentication",
      description: "Changed their own password",
    });
    res.json({ success: true, token: fresh.token, expiresAt: fresh.expiresAt });
  })
);


// Which of these menus the caller may open — the same rules the sidebar and
// the permission middleware apply: not withdrawn platform-wide, included in
// the client's plan/add-ons/override, and (unless roles are unconfigured or
// the caller is an administrator) granted "view" to their role.
async function moduleViewAccess(req, keys) {
  const roleName = (req.headers["x-user-role"] || "").trim();
  const [plan, registry, roles] = await Promise.all([
    planForRequest(req),
    getPlatformRegistry(),
    rolesForRequest(req),
  ]);
  const unrestricted = !roleName || isAdminRole(roleName) || roles.length === 0;
  const roleDoc = roles.find((r) => String(r.name).toLowerCase() === roleName.toLowerCase());
  const out = {};
  keys.forEach((key) => {
    out[key] =
      effectiveMenuAllows(plan, req._tenant, key, registry) && (unrestricted || roleHasPermission(roleDoc, key, "view"));
  });
  return out;
}

// ---------- Dashboard ----------
app.get(
  "/api/dashboard",
  asyncHandler(async (req, res) => {
    // Every query below is independent, so they all go out at once — the
    // response takes as long as the slowest one, not the sum of all of them
    // (each is a network round trip to the database).
    const nowD = new Date();
    const thisMonthStart = new Date(nowD.getFullYear(), nowD.getMonth(), 1);
    const lastMonthStart = new Date(nowD.getFullYear(), nowD.getMonth() - 1, 1);
    // Month-over-month deltas — this calendar month vs the previous one, by
    // when the record was created. Only computed for the two metrics that
    // have a real time series (invoiced revenue, purchase spend); the KPI
    // card shows a delta chip only where one is returned.
    const sumIn = (Model, gte, lt) =>
      Model.aggregate([
        { $match: { createdAt: lt ? { $gte: gte, $lt: lt } : { $gte: gte } } },
        { $group: { _id: null, t: { $sum: "$amount" } } },
      ]);

    // The dashboard only carries what the caller's menus allow — a user
    // without Customers never receives customer figures, not merely a page
    // that hides them.
    const access = await moduleViewAccess(req, ["sales", "customers", "suppliers", "purchase", "products", "inventory", "manufacturing"]);
    const gate = (module, run, empty) => (access[module] ? run() : Promise.resolve(empty));

    const topCustomersPromise = gate("customers", () => Customer.find().sort({ totalOrders: -1 }).limit(5).exec(), []);

    const [
      openSalesOrders,
      deliveredThisMonth,
      pendingApproval,
      totalCustomers,
      totalSuppliers,
      totalProducts,
      lowStockItems,
      [openValueAgg],
      [invoiceAgg],
      [purchaseAgg],
      [stockValueAgg],
      ordersByStatusAgg,
      recentSalesOrders,
      recentInvoices,
      topCustomersRaw,
      revThis,
      revLast,
      poThis,
      poLast,
      topCustRev,
      manufacturing,
      salesTrend,
      productionTrend,
    ] = await Promise.all([
      gate("sales", () => SalesOrder.countDocuments({ status: "Open" }), 0),
      gate("sales", () => SalesOrder.countDocuments({ status: "Delivered" }), 0),
      gate("sales", () => SalesOrder.countDocuments({ status: "Pending" }), 0),
      gate("customers", () => Customer.countDocuments(), 0),
      gate("suppliers", () => Supplier.countDocuments(), 0),
      gate("products", () => Item.countDocuments(), 0),
      gate("inventory", () => Item.countDocuments({ $expr: { $lte: ["$qty", "$minStockLevel"] } }), 0),
      gate(
        "sales",
        () =>
          SalesOrder.aggregate([
            { $match: { status: "Open" } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
          ]),
        []
      ),
      gate(
        "sales",
        () => Invoice.aggregate([{ $group: { _id: null, totalAmount: { $sum: "$amount" }, totalBalance: { $sum: "$balance" } } }]),
        []
      ),
      gate("purchase", () => PurchaseOrder.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]), []),
      gate(
        "inventory",
        () => Item.aggregate([{ $group: { _id: null, total: { $sum: { $multiply: ["$purchasePrice", "$qty"] } } } }]),
        []
      ),
      gate("sales", () => SalesOrder.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]), []),
      gate("sales", () => SalesOrder.find().sort({ seq: -1 }).limit(5), []),
      gate("sales", () => Invoice.find().sort({ seq: -1 }).limit(5), []),
      topCustomersPromise,
      gate("sales", () => sumIn(Invoice, thisMonthStart), []),
      gate("sales", () => sumIn(Invoice, lastMonthStart, thisMonthStart), []),
      gate("purchase", () => sumIn(PurchaseOrder, thisMonthStart), []),
      gate("purchase", () => sumIn(PurchaseOrder, lastMonthStart, thisMonthStart), []),
      // Needs the top customers' names, so it chains off that one query
      // instead of waiting for everything else.
      topCustomersPromise.then((customers) =>
        customers.length
          ? Invoice.aggregate([
            { $match: { customer: { $in: customers.map((c) => c.name) } } },
            { $group: { _id: "$customer", total: { $sum: "$amount" } } },
          ])
          : []
      ),
      gate("manufacturing", () => computeManufacturingSummary(currentModels(), thisMonthStart), null),
      // 12 months so the frontend can offer 3M / 6M / 12M ranges off one payload.
      gate("sales", () => computeSalesTrend(12), []),
      gate("manufacturing", () => computeProductionTrend(currentModels().ProductionReceipt, 12), []),
    ]);

    const ordersByStatus = {};
    ordersByStatusAgg.forEach((o) => {
      ordersByStatus[o._id] = o.count;
    });
    const pctChange = (cur, prev) =>
      prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : cur > 0 ? 100 : 0;
    const revByCustomer = {};
    topCustRev.forEach((r) => {
      revByCustomer[r._id] = r.total;
    });

    res.json({
      stats: {
        openSalesOrders,
        totalOpenValue: openValueAgg?.total || 0,
        deliveredThisMonth,
        pendingApproval,
        totalCustomers,
        totalSuppliers,
        totalProducts,
        lowStockItems,
        totalRevenueYTD: invoiceAgg?.totalAmount || 0,
        outstandingReceivables: invoiceAgg?.totalBalance || 0,
        totalPurchaseValue: purchaseAgg?.total || 0,
        stockValue: stockValueAgg?.total || 0,
      },
      deltas: {
        revenue: pctChange(revThis[0]?.t || 0, revLast[0]?.t || 0),
        purchases: pctChange(poThis[0]?.t || 0, poLast[0]?.t || 0),
      },
      access,
      salesTrend,
      productionTrend,
      manufacturing,
      ordersByStatus,
      recentSalesOrders,
      recentInvoices,
      topCustomers: topCustomersRaw.map((c) => ({
        id: c.id,
        name: c.name,
        city: c.city,
        totalOrders: c.totalOrders,
        value: revByCustomer[c.name] || 0,
      })),
    });
  })
);

// GST number -> state / registered address, for the Add Customer and Add
// Supplier forms. Registered ahead of every "/api/customers/:id"-style route
// so "gst-lookup" is not read as a record id. Each path sits under its own
// module's permission, and the optional paid provider is rate-limited per client.
const gstLookupLimit = requestLimit({
  keyFor: (req) => String(req.headers["x-tenant"] || "default"),
  max: 120,
  windowMs: 10 * 60 * 1000,
  message: "Too many GST lookups just now. Please wait a few minutes, or type the address in.",
});
for (const base of ["/api/customers", "/api/suppliers"]) {
  app.get(
    `${base}/gst-lookup`,
    gstLookupLimit,
    asyncHandler(async (req, res) => res.json(await lookupGstin(req.query.gstin)))
  );
}

// ---------- Customer Ledger ----------
app.get(
  "/api/customers/ledger",
  asyncHandler(async (req, res) => {
    const filter = { partyType: "Customer" };
    if (req.query.customer && req.query.customer !== "all") filter.partyName = req.query.customer;
    const entries = await LedgerEntry.find(filter).sort({ seq: 1 });
    const totalDebit = entries.reduce((a, e) => a + e.debit, 0);
    const totalCredit = entries.reduce((a, e) => a + e.credit, 0);
    res.json({
      entries,
      openingBalance: 0,
      totalDebit,
      totalCredit,
      closingBalance: totalDebit - totalCredit,
    });
  })
);

app.post(
  "/api/customers/ledger",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.partyName) return res.status(400).json({ message: "Customer is required." });
    const { seq, number } = await nextSeqAndNumber(LedgerEntry);
    const newEntry = await LedgerEntry.create({
      id: `LED-${String(number).padStart(5, "0")}`,
      seq,
      partyType: "Customer",
      partyName: body.partyName,
      date: todayLabel(),
      type: body.type || "Manual Entry",
      referenceNo: body.referenceNo || "—",
      debit: Number(body.debit) || 0,
      credit: Number(body.credit) || 0,
    });
    res.status(201).json(newEntry);
  })
);

addCrudRoutes("/api/customers/ledger", LedgerEntry);

// ---------- Customers: Outstanding Receivables ----------
app.get(
  "/api/customers/outstanding",
  asyncHandler(async (req, res) => {
    const rows = await Invoice.aggregate([
      { $match: { balance: { $gt: 0 } } },
      { $group: { _id: "$customer", totalOutstanding: { $sum: "$balance" }, invoiceCount: { $sum: 1 } } },
      { $sort: { totalOutstanding: -1 } },
    ]);
    res.json(rows.map((r) => ({ customer: r._id, totalOutstanding: r.totalOutstanding, invoiceCount: r.invoiceCount })));
  })
);

// ---------- Custom Fields ----------
// Lets a client add their own extra fields to the Customer/Supplier/Item
// forms from Settings → Custom Fields, with no code change needed per
// client. A definition here only decides what the FORM shows; the value
// itself lives in that record's own `customFields` map (see Customer.js /
// Supplier.js / Item.js) so removing a definition later never corrupts data
// already saved under it — it just stops showing on the form.
const CUSTOM_FIELD_ENTITIES = [
  "customer",
  "supplier",
  "item",
  "category",
  "brand",
  "warehouse",
  "maintenance-task",
  "work-center",
  "machine",
  "bom",
  "work-order",
  "job-card",
  "enquiry",
  "quotation",
  "sales-order",
  "delivery-challan",
  "sales-invoice",
  "sales-return",
  "purchase-order",
  "goods-receipt",
  "purchase-invoice",
  "purchase-return",
];
const CUSTOM_FIELD_TYPES = ["text", "textarea", "number", "date", "select"];

// "PAN Number" -> "panNumber" — matches the camelCase keys the rest of this
// app's schemas already use (contactPerson, gstNo, ...).
function slugifyFieldKey(label) {
  const words = String(label || "")
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
  if (!words.length) return "";
  return words.map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join("");
}

app.get(
  "/api/custom-fields",
  asyncHandler(async (req, res) => {
    const entity = String(req.query.entity || "");
    const filter = CUSTOM_FIELD_ENTITIES.includes(entity) ? { entity } : {};
    const fields = await CustomFieldDefinition.find(filter).sort({ order: 1, seq: 1 });
    res.json({ fields });
  })
);

app.post(
  "/api/custom-fields",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const entity = String(body.entity || "");
    if (!CUSTOM_FIELD_ENTITIES.includes(entity)) {
      return res.status(400).json({ message: `entity must be one of: ${CUSTOM_FIELD_ENTITIES.join(", ")}` });
    }
    const label = String(body.label || "").trim();
    if (!label) return res.status(400).json({ message: "Label is required." });
    const key = slugifyFieldKey(label);
    if (!key) return res.status(400).json({ message: "Could not derive a field key from that label." });
    const clash = await CustomFieldDefinition.findOne({ entity, key });
    if (clash) return res.status(409).json({ message: `A field already exists for "${label}" on this form.` });
    const type = CUSTOM_FIELD_TYPES.includes(body.type) ? body.type : "text";
    const options = type === "select" && Array.isArray(body.options) ? body.options.map(String).filter(Boolean) : [];
    const { seq, number } = await nextSeqAndNumber(CustomFieldDefinition);
    const last = await CustomFieldDefinition.findOne({ entity }).sort({ order: -1 });
    const created = await CustomFieldDefinition.create({
      id: `CF-${String(number).padStart(4, "0")}`,
      seq,
      entity,
      key,
      label,
      type,
      options,
      required: Boolean(body.required),
      order: last ? last.order + 1 : 0,
    });
    res.status(201).json(created);
  })
);

app.put(
  "/api/custom-fields/:id",
  asyncHandler(async (req, res) => {
    // entity and key are the field's identity — every record already
    // holding a value is keyed on them, so they're never editable, only the
    // presentation of the field is.
    const body = req.body || {};
    const updates = {};
    if (body.label !== undefined) {
      const label = String(body.label).trim();
      if (!label) return res.status(400).json({ message: "Label is required." });
      updates.label = label;
    }
    if (body.type !== undefined) updates.type = CUSTOM_FIELD_TYPES.includes(body.type) ? body.type : "text";
    if (body.options !== undefined) {
      updates.options = Array.isArray(body.options) ? body.options.map(String).filter(Boolean) : [];
    }
    if (body.required !== undefined) updates.required = Boolean(body.required);
    if (body.order !== undefined) updates.order = Number(body.order) || 0;
    const updated = await CustomFieldDefinition.findOneAndUpdate({ id: req.params.id }, { $set: updates }, { new: true });
    if (!updated) return res.status(404).json({ message: "Field not found." });
    res.json(updated);
  })
);

app.delete(
  "/api/custom-fields/:id",
  asyncHandler(async (req, res) => {
    const deleted = await CustomFieldDefinition.findOneAndDelete({ id: req.params.id });
    if (!deleted) return res.status(404).json({ message: "Field not found." });
    res.json({ success: true });
  })
);

// ---------- Customers ----------
app.get(
  "/api/customers",
  asyncHandler(async (req, res) => {
    const result = await paginate(Customer, {}, req);
    const [orderStats, invoiceStats] = await Promise.all([
      SalesOrder.aggregate([
        { $sort: { createdAt: -1 } },
        { $group: { _id: "$customer", totalOrders: { $sum: 1 }, lastOrderDate: { $first: "$orderDate" } } },
      ]),
      Invoice.aggregate([
        {
          $group: {
            _id: "$customer",
            totalInvoices: { $sum: 1 },
            invoicedAmount: { $sum: "$amount" },
            outstanding: { $sum: "$balance" },
          },
        },
      ]),
    ]);
    const statsMap = {};
    orderStats.forEach((o) => {
      statsMap[o._id] = { totalOrders: o.totalOrders, lastOrderDate: o.lastOrderDate };
    });
    const invoiceMap = {};
    invoiceStats.forEach((i) => {
      invoiceMap[i._id] = { totalInvoices: i.totalInvoices, invoicedAmount: i.invoicedAmount, outstanding: i.outstanding };
    });
    result.data = result.data.map((c) => {
      const stats = statsMap[c.name] || { totalOrders: 0, lastOrderDate: "" };
      const invStats = invoiceMap[c.name] || { totalInvoices: 0, invoicedAmount: 0, outstanding: 0 };
      return {
        ...c,
        totalOrders: stats.totalOrders,
        lastOrderDate: stats.lastOrderDate,
        totalInvoices: invStats.totalInvoices,
        invoicedAmount: invStats.invoicedAmount,
        outstanding: invStats.outstanding,
      };
    });
    res.json(result);
  })
);

// Single-record lookup with full stats + recent activity — used by the
// standalone Customer Detail view (click a customer code in the list).
app.get(
  "/api/customers/:id",
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ id: req.params.id });
    if (!customer) return res.status(404).json({ message: "Customer not found." });

    const [orderStats, invoiceStats, recentOrders, recentInvoices] = await Promise.all([
      SalesOrder.aggregate([
        { $match: { customer: customer.name } },
        { $group: { _id: "$customer", totalOrders: { $sum: 1 }, lastOrderDate: { $first: "$orderDate" } } },
      ]),
      Invoice.aggregate([
        { $match: { customer: customer.name } },
        { $group: { _id: "$customer", totalInvoices: { $sum: 1 }, invoicedAmount: { $sum: "$amount" }, outstanding: { $sum: "$balance" } } },
      ]),
      SalesOrder.find({ customer: customer.name }).sort({ seq: -1 }).limit(10),
      Invoice.find({ customer: customer.name }).sort({ seq: -1 }).limit(10),
    ]);

    const stats = orderStats[0] || { totalOrders: 0, lastOrderDate: "" };
    const invStats = invoiceStats[0] || { totalInvoices: 0, invoicedAmount: 0, outstanding: 0 };

    res.json({
      ...customer.toJSON(),
      totalOrders: stats.totalOrders,
      lastOrderDate: stats.lastOrderDate,
      totalInvoices: invStats.totalInvoices,
      invoicedAmount: invStats.invoicedAmount,
      outstanding: invStats.outstanding,
      recentOrders,
      recentInvoices,
    });
  })
);

app.post(
  "/api/customers",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ message: "Name is required." });
    const { seq } = await nextSeqAndNumber(Customer);
    const customerId = await allocateDocNumber(Customer, "customerCode");
    const newCustomer = await Customer.create({
      id: customerId,
      seq,
      name: body.name,
      contactPerson: body.contactPerson || "—",
      customerType: body.customerType || "Industrial",
      packingCategory: body.packingCategory || "",
      paymentTerms: body.paymentTerms || "",
      gstNo: body.gstNo || "",
      address: body.address || "",
      city: body.city || "Chennai",
      state: body.state || "",
      pincode: body.pincode || "",
      phone: sanitizePhone(body.phone),
      email: body.email || "",
      totalOrders: 0,
      outstanding: 0,
      status: "Active",
      customFields: isPlainObject(body.customFields) ? body.customFields : {},
    });
    res.status(201).json(newCustomer);
  })
);

addCrudRoutes("/api/customers", Customer, {
  sanitize: (updates) => {
    if (updates.phone !== undefined) updates.phone = sanitizePhone(updates.phone);
  },
});

// ---------- Customer Groups ----------
app.get(
  "/api/customer-groups",
  asyncHandler(async (req, res) => res.json(await paginate(CustomerGroup, {}, req)))
);

app.post(
  "/api/customer-groups",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ message: "Name is required." });
    const { seq, number } = await nextSeqAndNumber(CustomerGroup);
    const newGroup = await CustomerGroup.create({
      id: `CGRP-${String(number).padStart(4, "0")}`,
      seq,
      name: body.name,
      description: body.description || "",
      status: "Active",
    });
    res.status(201).json(newGroup);
  })
);

addCrudRoutes("/api/customer-groups", CustomerGroup);

// ---------- Supplier Ledger ----------
app.get(
  "/api/suppliers/ledger",
  asyncHandler(async (req, res) => {
    const filter = { partyType: "Supplier" };
    if (req.query.supplier && req.query.supplier !== "all") filter.partyName = req.query.supplier;
    const entries = await LedgerEntry.find(filter).sort({ seq: 1 });
    const totalDebit = entries.reduce((a, e) => a + e.debit, 0);
    const totalCredit = entries.reduce((a, e) => a + e.credit, 0);
    res.json({
      entries,
      openingBalance: 0,
      totalDebit,
      totalCredit,
      closingBalance: totalDebit - totalCredit,
    });
  })
);

app.post(
  "/api/suppliers/ledger",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.partyName) return res.status(400).json({ message: "Supplier is required." });
    const { seq, number } = await nextSeqAndNumber(LedgerEntry);
    const newEntry = await LedgerEntry.create({
      id: `LED-${String(number).padStart(5, "0")}`,
      seq,
      partyType: "Supplier",
      partyName: body.partyName,
      date: todayLabel(),
      type: body.type || "Manual Entry",
      referenceNo: body.referenceNo || "—",
      debit: Number(body.debit) || 0,
      credit: Number(body.credit) || 0,
    });
    res.status(201).json(newEntry);
  })
);

addCrudRoutes("/api/suppliers/ledger", LedgerEntry);

// ---------- Suppliers: Outstanding Payables ----------
app.get(
  "/api/suppliers/outstanding",
  asyncHandler(async (req, res) => {
    const rows = await PurchaseInvoice.aggregate([
      { $match: { status: { $ne: "Paid" } } },
      { $group: { _id: "$supplier", totalOutstanding: { $sum: "$amount" }, invoiceCount: { $sum: 1 } } },
      { $sort: { totalOutstanding: -1 } },
    ]);
    res.json(rows.map((r) => ({ supplier: r._id, totalOutstanding: r.totalOutstanding, invoiceCount: r.invoiceCount })));
  })
);

// ---------- Suppliers ----------
app.get(
  "/api/suppliers",
  asyncHandler(async (req, res) => {
    const result = await paginate(Supplier, {}, req);
    const [supplyStats, outstandingStats] = await Promise.all([
      GoodsReceipt.aggregate([
        { $sort: { createdAt: -1 } },
        { $unwind: "$items" },
        { $group: { _id: "$supplier", itemsSupplied: { $sum: 1 }, lastSupplyDate: { $first: "$date" } } },
      ]),
      PurchaseInvoice.aggregate([
        { $match: { status: { $ne: "Paid" } } },
        { $group: { _id: "$supplier", totalOutstanding: { $sum: "$amount" } } },
      ]),
    ]);
    const supplyMap = {};
    supplyStats.forEach((s) => {
      supplyMap[s._id] = { itemsSupplied: s.itemsSupplied, lastSupplyDate: s.lastSupplyDate };
    });
    const outstandingMap = {};
    outstandingStats.forEach((o) => {
      outstandingMap[o._id] = o.totalOutstanding;
    });
    result.data = result.data.map((s) => {
      const supply = supplyMap[s.name] || { itemsSupplied: 0, lastSupplyDate: "" };
      return {
        ...s,
        itemsSupplied: supply.itemsSupplied,
        lastSupplyDate: supply.lastSupplyDate,
        outstanding: outstandingMap[s.name] || 0,
      };
    });
    res.json(result);
  })
);

// Single-record lookup with full stats + recent activity — used by the
// standalone Supplier Detail view (click a supplier code in the list).
app.get(
  "/api/suppliers/:id",
  asyncHandler(async (req, res) => {
    const supplier = await Supplier.findOne({ id: req.params.id });
    if (!supplier) return res.status(404).json({ message: "Supplier not found." });

    const [supplyStats, outstandingStats, recentOrders, recentInvoices] = await Promise.all([
      GoodsReceipt.aggregate([
        { $match: { supplier: supplier.name } },
        { $unwind: "$items" },
        { $group: { _id: "$supplier", itemsSupplied: { $sum: 1 }, lastSupplyDate: { $first: "$date" } } },
      ]),
      PurchaseInvoice.aggregate([
        { $match: { supplier: supplier.name, status: { $ne: "Paid" } } },
        { $group: { _id: "$supplier", totalOutstanding: { $sum: "$amount" } } },
      ]),
      PurchaseOrder.find({ supplier: supplier.name }).sort({ seq: -1 }).limit(10),
      PurchaseInvoice.find({ supplier: supplier.name }).sort({ seq: -1 }).limit(10),
    ]);

    const supply = supplyStats[0] || { itemsSupplied: 0, lastSupplyDate: "" };
    const outstanding = outstandingStats[0]?.totalOutstanding || 0;

    res.json({
      ...supplier.toJSON(),
      itemsSupplied: supply.itemsSupplied,
      lastSupplyDate: supply.lastSupplyDate,
      outstanding,
      recentOrders,
      recentInvoices,
    });
  })
);

app.post(
  "/api/suppliers",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ message: "Name is required." });
    const { seq } = await nextSeqAndNumber(Supplier);
    const supplierId = await allocateDocNumber(Supplier, "supplierCode");
    const newSupplier = await Supplier.create({
      id: supplierId,
      seq,
      name: body.name,
      contactPerson: body.contactPerson || "",
      category: body.category || "General",
      packingCategory: body.packingCategory || "",
      paymentTerms: body.paymentTerms || "",
      gstNo: body.gstNo || "",
      address: body.address || "",
      city: body.city || "Chennai",
      state: body.state || "",
      pincode: body.pincode || "",
      email: body.email || "",
      phone: sanitizePhone(body.phone),
      rating: "4.0",
      leadTimeDays: 7,
      status: "Active",
      customFields: isPlainObject(body.customFields) ? body.customFields : {},
    });
    res.status(201).json(newSupplier);
  })
);

addCrudRoutes("/api/suppliers", Supplier, {
  sanitize: (updates) => {
    if (updates.phone !== undefined) updates.phone = sanitizePhone(updates.phone);
  },
});

// ---------- Supplier Groups ----------
app.get(
  "/api/supplier-groups",
  asyncHandler(async (req, res) => res.json(await paginate(SupplierGroup, {}, req)))
);

app.post(
  "/api/supplier-groups",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ message: "Name is required." });
    const { seq, number } = await nextSeqAndNumber(SupplierGroup);
    const newGroup = await SupplierGroup.create({
      id: `SGRP-${String(number).padStart(4, "0")}`,
      seq,
      name: body.name,
      description: body.description || "",
      status: "Active",
    });
    res.status(201).json(newGroup);
  })
);

addCrudRoutes("/api/supplier-groups", SupplierGroup);

// ---------- Product Categories ----------
app.get(
  "/api/categories",
  asyncHandler(async (req, res) => {
    const result = await paginate(Category, {}, req);
    // Counts come from Item, the live catalog — Product is legacy and its
    // standalone screen is gone, so counting it always returned zero.
    const counts = await Item.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }]);
    const countMap = {};
    counts.forEach((c) => {
      countMap[c._id] = c.count;
    });
    result.data = result.data.map((c) => ({ ...c, itemCount: countMap[c.name] || 0 }));
    res.json(result);
  })
);

app.post(
  "/api/categories",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ message: "Name is required." });
    const { seq, number } = await nextSeqAndNumber(Category);
    const newCategory = await Category.create({
      id: `CAT-${String(number).padStart(4, "0")}`,
      seq,
      name: body.name,
      description: body.description || "",
      materialType: body.materialType || "",
      unit: body.unit || "Nos",
      taxRate: body.taxRate !== undefined && body.taxRate !== "" ? Number(body.taxRate) : 18,
      status: body.status || "Active",
      customFields: isPlainObject(body.customFields) ? body.customFields : {},
    });
    res.status(201).json(newCategory);
  })
);

addCrudRoutes("/api/categories", Category);

// ---------- Product Brands ----------
app.get(
  "/api/brands",
  asyncHandler(async (req, res) => {
    const result = await paginate(Brand, {}, req);
    const counts = await Item.aggregate([{ $group: { _id: "$brand", count: { $sum: 1 } } }]);
    const countMap = {};
    counts.forEach((c) => {
      countMap[c._id] = c.count;
    });
    result.data = result.data.map((b) => ({ ...b, itemCount: countMap[b.name] || 0 }));
    res.json(result);
  })
);

app.post(
  "/api/brands",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ message: "Name is required." });
    const { seq, number } = await nextSeqAndNumber(Brand);
    const newBrand = await Brand.create({
      id: `BRD-${String(number).padStart(4, "0")}`,
      seq,
      name: body.name,
      description: body.description || "",
      packingCategory: body.packingCategory || "",
      manufacturer: body.manufacturer || "",
      material: body.material || "",
      status: body.status || "Active",
      customFields: isPlainObject(body.customFields) ? body.customFields : {},
    });
    res.status(201).json(newBrand);
  })
);

addCrudRoutes("/api/brands", Brand);

// ---------- Warehouses ----------
app.get(
  "/api/warehouses",
  asyncHandler(async (req, res) => res.json(await paginate(Warehouse, {}, req)))
);

app.post(
  "/api/warehouses",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ message: "Name is required." });
    const { seq, number } = await nextSeqAndNumber(Warehouse);
    const newWarehouse = await Warehouse.create({
      id: `WH-${String(number).padStart(4, "0")}`,
      seq,
      name: body.name,
      location: body.location || "",
      status: "Active",
      customFields: isPlainObject(body.customFields) ? body.customFields : {},
    });
    res.status(201).json(newWarehouse);
  })
);

addCrudRoutes("/api/warehouses", Warehouse);

// ---------- Items ----------
app.get(
  "/api/items",
  asyncHandler(async (req, res) => res.json(await paginate(Item, {}, req)))
);

app.post(
  "/api/items",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ message: "Name is required." });
    const { seq, number } = await nextSeqAndNumber(Item);
    const newItem = await Item.create({
      id: `ITM-${String(number).padStart(5, "0")}`,
      seq,
      name: body.name,
      product: body.product || "",
      itemCode: body.itemCode || "",
      barcode: body.barcode || "",
      description: body.description || "",
      hsnCode: body.hsnCode || "",
      taxPercent: Number(body.taxPercent) || 0,
      cgst: Number(body.cgst) || 0,
      igst: Number(body.igst) || 0,
      category: body.category || "",
      brand: body.brand || "",
      itemType: body.itemType || "Raw Material",
      batchNo: body.batchNo || "",
      size: body.size || "",
      warehouse: body.warehouse || "Main Warehouse",
      qty: Number(body.qty) || 0,
      unit: body.unit || "Pcs",
      sellingPrice: Number(body.sellingPrice) || 0,
      purchasePrice: Number(body.purchasePrice) || 0,
      minStockLevel: Number(body.minStockLevel) || 0,
      status: body.status || "Active",
      customFields: isPlainObject(body.customFields) ? body.customFields : {},
    });
    res.status(201).json(newItem);
  })
);

addCrudRoutes("/api/items", Item);

// Normalizes a submitted line-item array and computes per-row amount + totals.
// rowCalc(row) returns the row's line amount; used for PO / Purchase Invoice (qty * price * (1+tax%)).
function computeLineItems(rawItems, rowCalc) {
  const items = (Array.isArray(rawItems) ? rawItems : [])
    .filter((r) => r && r.product)
    .map((r) => {
      const quantity = Number(r.quantity) || 0;
      const unitPrice = Number(r.unitPrice) || 0;
      const taxPercent = Number(r.taxPercent) || 0;
      const amount = rowCalc ? rowCalc({ quantity, unitPrice, taxPercent }) : quantity * unitPrice;
      const serials = Array.isArray(r.serials) ? r.serials.map((s) => String(s).trim()).filter(Boolean) : [];
      return { product: r.product, hsnCode: r.hsnCode || "", quantity, unit: r.unit || "Nos", unitPrice, taxPercent, amount, serials };
    });
  const subTotal = items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);
  const taxTotal = items.reduce((a, i) => a + (i.amount - i.quantity * i.unitPrice), 0);
  const total = items.reduce((a, i) => a + i.amount, 0);
  return { items, subTotal, taxTotal, total };
}

// ---------- Purchase Orders ----------
function buildPurchaseOrderFilter(query) {
  const filter = {};
  if (query.supplier && query.supplier !== "all") filter.supplier = query.supplier;
  if (query.status && query.status !== "all") filter.status = query.status;
  if (query.paymentTerms && query.paymentTerms !== "all") filter.paymentTerms = query.paymentTerms;
  // ?search= is handled generically by paginate() (all text fields + line items).
  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }
  return filter;
}

// The most recent Goods Receipt's own `status` for each PO number given
// (e.g. "Received", "Rejected", "Partially Accepted") — or "Not Received"
// for any PO with no Goods Receipt against it at all. Lets the Purchase
// Orders list show, at a glance, which POs still need receiving.
async function computeGrnStatuses(poIds) {
  if (!poIds.length) return {};
  const receipts = await GoodsReceipt.find({ poNumber: { $in: poIds } }).sort({ createdAt: -1 });
  const map = {};
  receipts.forEach((gr) => {
    if (!map[gr.poNumber]) map[gr.poNumber] = gr.status || "Pending";
  });
  return map;
}

app.get(
  "/api/purchase-orders",
  asyncHandler(async (req, res) => {
    const filter = buildPurchaseOrderFilter(req.query);
    const result = await paginate(PurchaseOrder, filter, req);
    const grnStatusMap = await computeGrnStatuses(result.data.map((po) => po.id));
    result.data = result.data.map((po) => ({
      ...po,
      grnStatus: grnStatusMap[po.id] || "Not Received",
    }));
    res.json(result);
  })
);

// Read-only preview of the PO number the next save will actually receive —
// used by the Add Purchase Order form so "Purchase Order No" is a real
// fetched value, not a client-side guess. Doesn't reserve/increment
// anything; the authoritative number is still assigned at creation time.
app.get(
  "/api/purchase-orders/next-number",
  asyncHandler(async (req, res) => {
    const last = await PurchaseOrder.findOne({}, { seq: 1 }).sort({ seq: -1 }).lean();
    const nextNumber = (last?.seq || 0) + 1 + 400;
    res.json({ number: `PO-${String(nextNumber).padStart(4, "0")}` });
  })
);

// Single-record lookup by PO number — used by the Add Purchase Order form
// so typing an existing PO number can fetch and display its details.
app.get(
  "/api/purchase-orders/:id",
  asyncHandler(async (req, res) => {
    const po = await PurchaseOrder.findOne({ id: req.params.id });
    if (!po) return res.status(404).json({ message: "Purchase order not found." });
    const grnStatusMap = await computeGrnStatuses([po.id]);
    res.json({ ...po.toJSON(), grnStatus: grnStatusMap[po.id] || "Not Received" });
  })
);

app.post(
  "/api/purchase-orders",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.supplier) return res.status(400).json({ message: "Supplier is required." });
    const { seq } = await nextSeqAndNumber(PurchaseOrder);
    const purchaseOrderId = await allocateDocNumber(PurchaseOrder, "purchaseOrder");
    const { items, subTotal, taxTotal, total } = computeLineItems(
      body.items,
      ({ quantity, unitPrice, taxPercent }) => quantity * unitPrice * (1 + taxPercent / 100)
    );
    const newPO = await PurchaseOrder.create({
      id: purchaseOrderId,
      seq,
      supplier: body.supplier,
      orderDate: todayLabel(),
      expectedDate: body.expectedDate || futureLabel(7),
      items,
      subTotal,
      taxTotal,
      amount: total,
      paymentTerms: body.paymentTerms || "30 Days",
      status: body.status === "Submit" ? "Sent" : "Draft",
      customFields: isPlainObject(body.customFields) ? body.customFields : {},
    });
    res.status(201).json(newPO);
  })
);

app.put(
  "/api/purchase-orders/:id",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.supplier) return res.status(400).json({ message: "Supplier is required." });
    const { items, subTotal, taxTotal, total } = computeLineItems(
      body.items,
      ({ quantity, unitPrice, taxPercent }) => quantity * unitPrice * (1 + taxPercent / 100)
    );
    const updated = await PurchaseOrder.findOneAndUpdate(
      { id: req.params.id },
      {
        $set: {
          supplier: body.supplier,
          expectedDate: body.expectedDate || futureLabel(7),
          items,
          subTotal,
          taxTotal,
          amount: total,
          paymentTerms: body.paymentTerms || "30 Days",
          status: body.status || "Draft",
          customFields: isPlainObject(body.customFields) ? body.customFields : {},
        },
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Record not found." });
    res.json(updated);
  })
);

app.delete(
  "/api/purchase-orders/:id",
  asyncHandler(async (req, res) => {
    const deleted = await PurchaseOrder.findOneAndDelete({ id: req.params.id });
    if (!deleted) return res.status(404).json({ message: "Record not found." });
    res.json({ success: true });
  })
);

// ---------- Goods Receipt ----------
function normalizeGrItems(rawItems) {
  return (Array.isArray(rawItems) ? rawItems : [])
    .filter((r) => r && r.product)
    .map((r) => ({
      product: r.product,
      poQty: Number(r.poQty) || 0,
      receivedQty: Number(r.receivedQty) || 0,
      rejectedQty: Number(r.rejectedQty) || 0,
      unit: r.unit || "Pcs",
    }));
}

function computeGrStatus(items) {
  if (items.length === 0) return "Pending";
  const totalOrdered = items.reduce((a, i) => a + i.poQty, 0);
  const totalReceived = items.reduce((a, i) => a + i.receivedQty, 0);
  const totalRejected = items.reduce((a, i) => a + i.rejectedQty, 0);
  if (totalReceived >= totalOrdered && totalRejected === 0) return "Completed";
  if (totalReceived > 0) return "Partially Accepted";
  return "Pending";
}

// This is what actually moves a Goods Receipt into Stock Overview — every
// line with a received quantity increments (sign: 1) or reverses
// (sign: -1) the matching Item's stock, matched by name + warehouse (same
// identity Stock Overview itself groups by). Creates the Item if a catalog
// entry for it doesn't exist yet, so receiving something new still shows up.
async function applyGrStockDelta(items, warehouse, sign) {
  const wh = warehouse || "Main Warehouse";
  for (const item of items || []) {
    const qtyDelta = (Number(item.receivedQty) || 0) * sign;
    if (!qtyDelta || !item.product) continue;
    const nameRe = new RegExp(`^${item.product.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
    const existing = await Item.findOne({ name: nameRe, warehouse: wh });
    if (existing) {
      await Item.updateOne({ _id: existing._id }, { $inc: { qty: qtyDelta } });
    } else if (qtyDelta > 0) {
      const { seq, number } = await nextSeqAndNumber(Item);
      await Item.create({
        id: `ITM-${String(number).padStart(5, "0")}`,
        seq,
        name: item.product,
        warehouse: wh,
        qty: qtyDelta,
        unit: item.unit || "Pcs",
        status: "Active",
      });
    }
    // A negative delta with no matching Item (e.g. reversing a GR whose
    // Item was since deleted) has nothing left to reverse — safe to skip.
  }
}

// Mirror of applyGrStockDelta for the opposite direction: a Purchase Return
// sends stock BACK to the supplier, so sign is -1 to record it (create) and
// +1 to reverse it (edit's "undo the old items" step, and delete). Uses
// returnQty rather than receivedQty; otherwise identical, including matching
// on name + warehouse and silently skipping a reversal with no Item left to
// reverse against.
async function applyPurchaseReturnStockDelta(items, warehouse, sign) {
  const wh = warehouse || "Main Warehouse";
  for (const item of items || []) {
    const qtyDelta = (Number(item.returnQty) || 0) * sign;
    if (!qtyDelta || !item.product) continue;
    const nameRe = new RegExp(`^${item.product.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
    const existing = await Item.findOne({ name: nameRe, warehouse: wh });
    if (existing) {
      await Item.updateOne({ _id: existing._id }, { $inc: { qty: qtyDelta } });
    }
    // No Item to create here (unlike GR): a return can only reduce stock
    // that's presumed to already exist from having been received, so there
    // is nothing sensible to create when none is found.
  }
}

app.get(
  "/api/purchase/goods-receipts",
  asyncHandler(async (req, res) => res.json(await paginate(GoodsReceipt, {}, req)))
);

// Single-record lookup — used by the Goods Receipt details page.
app.get(
  "/api/purchase/goods-receipts/:id",
  asyncHandler(async (req, res) => {
    const gr = await GoodsReceipt.findOne({ id: req.params.id });
    if (!gr) return res.status(404).json({ message: "Goods receipt not found." });
    res.json(gr);
  })
);

app.post(
  "/api/purchase/goods-receipts",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.supplier) return res.status(400).json({ message: "Supplier is required." });
    const { seq, number } = await nextSeqAndNumber(GoodsReceipt);
    const items = normalizeGrItems(body.items);
    const newGR = await GoodsReceipt.create({
      id: `GR-${String(number).padStart(4, "0")}`,
      seq,
      poNumber: body.poNumber || "—",
      supplier: body.supplier,
      date: todayLabel(),
      invoiceNo: body.invoiceNo || "",
      invoiceDate: body.invoiceDate || "",
      items,
      warehouse: body.warehouse || "Main Warehouse",
      inspection: body.inspection || "Pending",
      status: body.status || computeGrStatus(items),
      customFields: isPlainObject(body.customFields) ? body.customFields : {},
    });
    await applyGrStockDelta(items, newGR.warehouse, 1);
    res.status(201).json(newGR);
  })
);

app.put(
  "/api/purchase/goods-receipts/:id",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.supplier) return res.status(400).json({ message: "Supplier is required." });
    const existing = await GoodsReceipt.findOne({ id: req.params.id });
    if (!existing) return res.status(404).json({ message: "Record not found." });
    const items = normalizeGrItems(body.items);
    const newWarehouse = body.warehouse || "Main Warehouse";
    // Reverse what this GR previously contributed to stock, then apply what
    // it contributes now — nets out correctly even if items were added,
    // removed, or their received quantities changed since it was last saved.
    await applyGrStockDelta(existing.items, existing.warehouse, -1);
    await applyGrStockDelta(items, newWarehouse, 1);
    const updated = await GoodsReceipt.findOneAndUpdate(
      { id: req.params.id },
      {
        $set: {
          poNumber: body.poNumber || "—",
          supplier: body.supplier,
          invoiceNo: body.invoiceNo || "",
          invoiceDate: body.invoiceDate || "",
          items,
          warehouse: newWarehouse,
          inspection: body.inspection || "Pending",
          status: body.status || computeGrStatus(items),
          customFields: isPlainObject(body.customFields) ? body.customFields : {},
        },
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Record not found." });
    res.json(updated);
  })
);

app.delete(
  "/api/purchase/goods-receipts/:id",
  asyncHandler(async (req, res) => {
    const deleted = await GoodsReceipt.findOneAndDelete({ id: req.params.id });
    if (!deleted) return res.status(404).json({ message: "Record not found." });
    await applyGrStockDelta(deleted.items, deleted.warehouse, -1);
    res.json({ success: true });
  })
);

// ---------- Purchase Invoice ----------
function computePurchaseInvoiceStatus(paidAmount, total) {
  if (total > 0 && paidAmount >= total) return "Paid";
  if (paidAmount > 0) return "Partially Paid";
  return "Unpaid";
}

app.get(
  "/api/purchase/invoices",
  asyncHandler(async (req, res) => res.json(await paginate(PurchaseInvoice, {}, req)))
);

// Single-record lookup — used by the standalone Edit Purchase Invoice page.
app.get(
  "/api/purchase/invoices/:id",
  asyncHandler(async (req, res) => {
    const invoice = await PurchaseInvoice.findOne({ id: req.params.id });
    if (!invoice) return res.status(404).json({ message: "Purchase invoice not found." });
    res.json(invoice);
  })
);

app.post(
  "/api/purchase/invoices",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.supplier) return res.status(400).json({ message: "Supplier is required." });
    const { seq, number } = await nextSeqAndNumber(PurchaseInvoice, 3000);
    const { items, subTotal, taxTotal, total } = computeLineItems(
      body.items,
      ({ quantity, unitPrice, taxPercent }) => quantity * unitPrice * (1 + taxPercent / 100)
    );
    const paidAmount = Number(body.paidAmount) || 0;
    const supplierRecord = await Supplier.findOne({ name: body.supplier }, { paymentTerms: 1 }).lean();
    const supplierTerms = supplierRecord && supplierRecord.paymentTerms;
    const newInvoice = await PurchaseInvoice.create({
      id: `PINV-${String(number).padStart(4, "0")}`,
      seq,
      poNumber: body.poNumber || "—",
      grNumber: body.grNumber || "—",
      supplier: body.supplier,
      date: todayLabel(),
      dueDate: body.dueDate || (await defaultDueDate("purchase", supplierTerms)),
      items,
      subTotal,
      taxTotal,
      amount: total,
      paidAmount,
      status: body.status || computePurchaseInvoiceStatus(paidAmount, total),
      customFields: isPlainObject(body.customFields) ? body.customFields : {},
    });
    res.status(201).json(newInvoice);
  })
);

app.put(
  "/api/purchase/invoices/:id",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.supplier) return res.status(400).json({ message: "Supplier is required." });
    const { items, subTotal, taxTotal, total } = computeLineItems(
      body.items,
      ({ quantity, unitPrice, taxPercent }) => quantity * unitPrice * (1 + taxPercent / 100)
    );
    const paidAmount = Number(body.paidAmount) || 0;
    const updated = await PurchaseInvoice.findOneAndUpdate(
      { id: req.params.id },
      {
        $set: {
          poNumber: body.poNumber || "—",
          grNumber: body.grNumber || "—",
          supplier: body.supplier,
          dueDate: body.dueDate || futureLabel(30),
          items,
          subTotal,
          taxTotal,
          amount: total,
          paidAmount,
          status: body.status || computePurchaseInvoiceStatus(paidAmount, total),
          customFields: isPlainObject(body.customFields) ? body.customFields : {},
        },
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Record not found." });
    res.json(updated);
  })
);

app.delete(
  "/api/purchase/invoices/:id",
  asyncHandler(async (req, res) => {
    const deleted = await PurchaseInvoice.findOneAndDelete({ id: req.params.id });
    if (!deleted) return res.status(404).json({ message: "Record not found." });
    res.json({ success: true });
  })
);

// ---------- Purchase Return ----------
app.get(
  "/api/purchase/returns",
  asyncHandler(async (req, res) => res.json(await paginate(PurchaseReturn, {}, req)))
);

// Single-record lookup — used by the standalone Edit Purchase Return page to
// load what it's editing.
app.get(
  "/api/purchase/returns/:id",
  asyncHandler(async (req, res) => {
    const ret = await PurchaseReturn.findOne({ id: req.params.id });
    if (!ret) return res.status(404).json({ message: "Purchase return not found." });
    res.json(ret);
  })
);

app.post(
  "/api/purchase/returns",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.supplier) return res.status(400).json({ message: "Supplier is required." });
    const { seq, number } = await nextSeqAndNumber(PurchaseReturn);
    const items = (Array.isArray(body.items) ? body.items : [])
      .filter((r) => r && r.product)
      .map((r) => {
        const invoicedQty = Number(r.invoicedQty) || 0;
        const returnQty = Number(r.returnQty) || 0;
        const unitPrice = Number(r.unitPrice) || 0;
        return { product: r.product, invoicedQty, returnQty, unitPrice, unit: r.unit || "Pcs" };
      });
    const amount = items.reduce((a, i) => a + i.returnQty * i.unitPrice, 0);
    const warehouse = body.warehouse || "Main Warehouse";
    const newReturn = await PurchaseReturn.create({
      id: `PRET-${String(number).padStart(4, "0")}`,
      seq,
      poNumber: body.poNumber || "—",
      grNumber: body.grNumber || "—",
      invoiceNumber: body.invoiceNumber || "—",
      supplier: body.supplier,
      date: todayLabel(),
      warehouse,
      items,
      amount,
      reason: body.reason || "Not specified",
      creditNote: body.creditNote || "Pending",
      status: "Pending",
      customFields: isPlainObject(body.customFields) ? body.customFields : {},
    });
    // Goods physically leave for the supplier the moment the return is
    // recorded — same "save = it happened" behavior as a Goods Receipt.
    await applyPurchaseReturnStockDelta(items, warehouse, -1);
    res.status(201).json(newReturn);
  })
);

app.put(
  "/api/purchase/returns/:id",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.supplier) return res.status(400).json({ message: "Supplier is required." });
    const existing = await PurchaseReturn.findOne({ id: req.params.id });
    if (!existing) return res.status(404).json({ message: "Record not found." });
    const items = (Array.isArray(body.items) ? body.items : [])
      .filter((r) => r && r.product)
      .map((r) => {
        const invoicedQty = Number(r.invoicedQty) || 0;
        const returnQty = Number(r.returnQty) || 0;
        const unitPrice = Number(r.unitPrice) || 0;
        return { product: r.product, invoicedQty, returnQty, unitPrice, unit: r.unit || "Pcs" };
      });
    const amount = items.reduce((a, i) => a + i.returnQty * i.unitPrice, 0);
    const warehouse = body.warehouse || existing.warehouse || "Main Warehouse";
    // Put back what this return previously took out, then take out what it
    // takes out now — same net-correctly-either-way approach as a Goods
    // Receipt edit, so changed quantities or a changed warehouse both settle
    // to the right stock level.
    await applyPurchaseReturnStockDelta(existing.items, existing.warehouse, 1);
    await applyPurchaseReturnStockDelta(items, warehouse, -1);
    const updated = await PurchaseReturn.findOneAndUpdate(
      { id: req.params.id },
      {
        $set: {
          poNumber: body.poNumber || "—",
          grNumber: body.grNumber || "—",
          invoiceNumber: body.invoiceNumber || "—",
          supplier: body.supplier,
          warehouse,
          items,
          amount,
          reason: body.reason || "Not specified",
          creditNote: body.creditNote || "Pending",
          status: body.status || "Pending",
          customFields: isPlainObject(body.customFields) ? body.customFields : {},
        },
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Record not found." });
    res.json(updated);
  })
);

app.delete(
  "/api/purchase/returns/:id",
  asyncHandler(async (req, res) => {
    const deleted = await PurchaseReturn.findOneAndDelete({ id: req.params.id });
    if (!deleted) return res.status(404).json({ message: "Record not found." });
    // Deleting a return gives the stock it took back to the supplier.
    await applyPurchaseReturnStockDelta(deleted.items, deleted.warehouse, 1);
    res.json({ success: true });
  })
);

// ---------- Inventory ----------
app.get(
  "/api/inventory",
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 5;

    // Grouped by `name` (the real catalog identity every Item always has),
    // not the legacy `product` field — that field is never actually set by
    // the Add Item form, so grouping by it made the entire real Items
    // catalog invisible here.
    const grouped = await Item.aggregate([
      {
        $group: {
          _id: { name: "$name", warehouse: "$warehouse" },
          itemCode: { $first: "$itemCode" },
          category: { $first: "$category" },
          brand: { $first: "$brand" },
          unit: { $first: "$unit" },
          minStockLevel: { $first: "$minStockLevel" },
          available: { $sum: "$qty" },
          reserved: { $sum: "$reserved" },
          damaged: { $sum: "$damaged" },
        },
      },
      { $sort: { "_id.name": 1, "_id.warehouse": 1 } },
    ]);

    const rows = grouped.map((g) => {
      const reorderLevel = g.minStockLevel || 50;
      const available = g.available || 0;
      let stockStatus = "Normal";
      if (available <= 0) stockStatus = "Out of Stock";
      else if (available <= reorderLevel) stockStatus = "Low Stock";
      return {
        id: `${g._id.name}__${g._id.warehouse}`.replace(/\s+/g, "-"),
        productCode: g.itemCode || "—",
        productName: g._id.name,
        category: g.category || "—",
        brand: g.brand || "—",
        warehouse: g._id.warehouse || "Main Warehouse",
        available,
        reserved: g.reserved || 0,
        damaged: g.damaged || 0,
        unit: g.unit || "Nos",
        stockStatus,
      };
    });

    const total = rows.length;
    const start = (page - 1) * pageSize;
    const data = rows.slice(start, start + pageSize);
    res.json({ data, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  })
);

// ---------- Inventory: Stock Transactions (In / Out / Transfer / Adjustment) ----------
function stockTransactionRoutes(path, type, idPrefix) {
  app.get(
    path,
    asyncHandler(async (req, res) => res.json(await paginate(StockTransaction, { type }, req)))
  );

  // Single-record lookup — used by the standalone Edit page.
  app.get(
    `${path}/:id`,
    asyncHandler(async (req, res) => {
      const txn = await StockTransaction.findOne({ id: req.params.id, type });
      if (!txn) return res.status(404).json({ message: "Record not found." });
      res.json(txn);
    })
  );

  app.post(
    path,
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      if (!body.product) return res.status(400).json({ message: "Product is required." });
      const { seq, number } = await nextSeqAndNumber(StockTransaction);
      const newTxn = await StockTransaction.create({
        id: `${idPrefix}-${String(number).padStart(4, "0")}`,
        seq,
        type,
        product: body.product,
        quantity: Number(body.quantity) || 0,
        warehouse: body.warehouse || "Main Warehouse",
        toWarehouse: body.toWarehouse || "",
        reason: body.reason || "",
        poNumber: body.poNumber || "",
        grnNumber: body.grnNumber || "",
        supplier: body.supplier || "",
        batchNo: body.batchNo || "",
        acceptedQty: Number(body.acceptedQty) || 0,
        status: body.status || (type === "In" ? "Pending QC" : ""),
        issueType: body.issueType || "",
        referenceNo: body.referenceNo || "",
        departmentOrCustomer: body.departmentOrCustomer || "",
        unit: body.unit || "Nos",
        date: todayLabel(),
      });
      res.status(201).json(newTxn);
    })
  );

  app.put(
    `${path}/:id`,
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      if (!body.product) return res.status(400).json({ message: "Product is required." });
      const updated = await StockTransaction.findOneAndUpdate(
        { id: req.params.id, type },
        {
          $set: {
            product: body.product,
            quantity: Number(body.quantity) || 0,
            warehouse: body.warehouse || "Main Warehouse",
            toWarehouse: body.toWarehouse || "",
            reason: body.reason || "",
            poNumber: body.poNumber || "",
            grnNumber: body.grnNumber || "",
            supplier: body.supplier || "",
            batchNo: body.batchNo || "",
            acceptedQty: Number(body.acceptedQty) || 0,
            status: body.status || (type === "In" ? "Pending QC" : ""),
            issueType: body.issueType || "",
            referenceNo: body.referenceNo || "",
            departmentOrCustomer: body.departmentOrCustomer || "",
            unit: body.unit || "Nos",
          },
        },
        { new: true }
      );
      if (!updated) return res.status(404).json({ message: "Record not found." });
      res.json(updated);
    })
  );

  app.delete(
    `${path}/:id`,
    asyncHandler(async (req, res) => {
      const deleted = await StockTransaction.findOneAndDelete({ id: req.params.id, type });
      if (!deleted) return res.status(404).json({ message: "Record not found." });
      res.json({ success: true });
    })
  );
}

stockTransactionRoutes("/api/inventory/stock-in", "In", "SIN");
stockTransactionRoutes("/api/inventory/stock-out", "Out", "SOUT");
stockTransactionRoutes("/api/inventory/stock-transfer", "Transfer", "STRF");
stockTransactionRoutes("/api/inventory/stock-adjustment", "Adjustment", "SADJ");

// ---------- Manufacturing ----------
// Lives in its own file purely for size; it is registered here, inside the
// same tenant-scoped middleware chain as every route above, and is handed the
// shared helpers rather than re-implementing them.
registerManufacturingRoutes(app, {
  asyncHandler,
  paginate,
  nextSeqAndNumber,
  addCrudRoutes,
  todayLabel,
  audit,
});

// ---------- Sales: Enquiries ----------
app.get(
  "/api/sales/enquiries",
  asyncHandler(async (req, res) => res.json(await paginate(Enquiry, {}, req)))
);

// Single-record lookup — used by the standalone Edit Enquiry page.
app.get(
  "/api/sales/enquiries/:id",
  asyncHandler(async (req, res) => {
    const enquiry = await Enquiry.findOne({ id: req.params.id });
    if (!enquiry) return res.status(404).json({ message: "Enquiry not found." });
    res.json(enquiry);
  })
);

// Tidies the product rows an enquiry was sent with and works out the flat
// product / qty / unit columns from them. Rows with no product name are
// dropped. With no rows at all the flat values the caller sent (an older
// client, or the mobile app) are used as they are.
function cleanEnquiryItems(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter((r) => r && String(r.product || "").trim())
    .map((r) => ({
      product: String(r.product).trim(),
      qty: Math.max(Number(r.qty) || 0, 0),
      unit: String(r.unit || "").trim() || "Nos",
      remarks: String(r.remarks || "").trim(),
    }));
}

function deriveEnquiryScalars(items) {
  return {
    product: items.map((i) => i.product).join(", "),
    qty: items.reduce((sum, i) => sum + i.qty, 0),
    unit: items[0].unit,
  };
}

app.post(
  "/api/sales/enquiries",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.customer) return res.status(400).json({ message: "Customer is required." });
    const items = cleanEnquiryItems(body.items);
    const flat = items.length
      ? deriveEnquiryScalars(items)
      : { product: body.product || "General Enquiry", qty: Number(body.qty) || 0, unit: body.unit || "Nos" };
    const { seq, number } = await nextSeqAndNumber(Enquiry);
    const newEnquiry = await Enquiry.create({
      id: `PENQ-${String(number).padStart(4, "0")}`,
      seq,
      customer: body.customer,
      contactPerson: body.contactPerson || "",
      date: todayLabel(),
      items,
      product: flat.product,
      qty: flat.qty,
      unit: flat.unit,
      requiredDate: body.requiredDate || "",
      source: body.source || "Website",
      priority: body.priority || "Medium",
      estValue: Number(body.estValue) || 0,
      status: body.status || "New",
      customFields: isPlainObject(body.customFields) ? body.customFields : {},
    });
    res.status(201).json(newEnquiry);
  })
);

addCrudRoutes("/api/sales/enquiries", Enquiry, {
  // Keep the flat columns in step when the product rows are edited.
  sanitize: (updates) => {
    if (!Array.isArray(updates.items)) return;
    updates.items = cleanEnquiryItems(updates.items);
    if (updates.items.length) Object.assign(updates, deriveEnquiryScalars(updates.items));
    else Object.assign(updates, { product: "General Enquiry", qty: 0, unit: "Nos" });
  },
});

// ---------- Sales: Quotations ----------
app.get(
  "/api/sales/quotations",
  asyncHandler(async (req, res) => res.json(await paginate(Quotation, {}, req)))
);

app.post(
  "/api/sales/quotations",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.customer) return res.status(400).json({ message: "Customer is required." });
    const { seq } = await nextSeqAndNumber(Quotation);
    const quotationId = await allocateDocNumber(Quotation, "quotation");
    const totals = computeQuotationTotals(body);
    const { items, subTotal, taxTotal, discountType, discountValue, discountAmount, freightCharges } = totals;
    const customerRecord = await Customer.findOne({ name: body.customer }, { state: 1 }).lean();
    const newQuotation = await Quotation.create({
      id: quotationId,
      seq,
      customer: body.customer,
      address: body.address || "",
      phone: body.phone || "",
      placeOfSupply: body.placeOfSupply || (customerRecord && customerRecord.state) || "",
      subject: body.subject || "",
      referenceNo: body.referenceNo || "",
      paymentTerms: body.paymentTerms || "",
      deliveryTerms: body.deliveryTerms || "",
      notes: body.notes || "",
      date: isoToDateLabel(body.date) || todayLabel(),
      validTill: isoToDateLabel(body.validTill) || futureLabel(15),
      items,
      discountType,
      discountValue,
      discountAmount,
      freightCharges,
      subTotal,
      taxTotal,
      product: items.map((i) => i.product).join(", "),
      // Items drive the total; a quotation sent with no items (the old
      // amount-only form) keeps the amount it was given.
      amount: items.length ? totals.amount : Number(body.amount) || 0,
      status: "Draft",
      customFields: isPlainObject(body.customFields) ? body.customFields : {},
    });
    res.status(201).json(newQuotation);
  })
);

// Totals for a quotation, always worked out here from the lines rather than
// trusting the client's arithmetic. The discount comes off the sub total
// BEFORE tax, and the tax shrinks with it (each line's tax is proportional to
// its value, so scaling the total tax by the same ratio is exact):
//   total = (subTotal - discount) + tax * (1 - discount/subTotal) + freight
function computeQuotationTotals(src) {
  const { items, subTotal, taxTotal: rawTax } = computeInvoiceLineItems(src.items);
  const discountType = src.discountType === "percent" ? "percent" : "amount";
  let discountValue = Math.max(Number(src.discountValue) || 0, 0);
  if (discountType === "percent") discountValue = Math.min(discountValue, 100);
  const round2 = (n) => Math.round(n * 100) / 100;
  const discountAmount = round2(
    Math.min(discountType === "percent" ? (subTotal * discountValue) / 100 : discountValue, subTotal)
  );
  const factor = subTotal > 0 ? (subTotal - discountAmount) / subTotal : 1;
  const taxTotal = round2(rawTax * factor);
  const freightCharges = Math.max(Number(src.freightCharges) || 0, 0);
  const amount = round2(subTotal - discountAmount + taxTotal + freightCharges);
  return { items, subTotal, discountType, discountValue, discountAmount, taxTotal, freightCharges, amount };
}

// The standalone Quotation page sends dates as YYYY-MM-DD; the list stores
// and shows them as "DD Mon YYYY" like every other quotation.
function isoToDateLabel(value) {
  if (!value) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "" : formatDateLabel(d);
}

addCrudRoutes("/api/sales/quotations", Quotation, {
  sanitize: (updates) => {
    if (updates.date !== undefined) updates.date = isoToDateLabel(updates.date);
    if (updates.validTill !== undefined) updates.validTill = isoToDateLabel(updates.validTill);
    if (Array.isArray(updates.items)) {
      // Totals are always recomputed server-side from the lines.
      const t = computeQuotationTotals(updates);
      updates.items = t.items;
      updates.subTotal = t.subTotal;
      updates.discountType = t.discountType;
      updates.discountValue = t.discountValue;
      updates.discountAmount = t.discountAmount;
      updates.taxTotal = t.taxTotal;
      updates.freightCharges = t.freightCharges;
      updates.product = t.items.map((i) => i.product).join(", ");
      updates.amount = t.items.length ? t.amount : Number(updates.amount) || 0;
    } else if (updates.amount !== undefined) {
      updates.amount = Number(updates.amount) || 0;
    }
  },
});

// ---------- Sales: Orders ----------
app.get(
  "/api/sales/orders/stats",
  asyncHandler(async (req, res) => {
    const [openSalesOrders, deliveredThisMonth, pendingApproval] = await Promise.all([
      SalesOrder.countDocuments({ status: "Open" }),
      SalesOrder.countDocuments({ status: "Delivered" }),
      SalesOrder.countDocuments({ status: "Pending" }),
    ]);
    const [openValueAgg] = await SalesOrder.aggregate([
      { $match: { status: "Open" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    res.json({
      openSalesOrders,
      totalOpenValue: openValueAgg?.total || 0,
      deliveredThisMonth,
      pendingApproval,
    });
  })
);

app.get(
  "/api/sales/orders",
  asyncHandler(async (req, res) => {
    const filter = buildSalesOrderFilter(req.query);
    res.json(await paginate(SalesOrder, filter, req));
  })
);

// Single-record lookup — used by the standalone Edit Sales Order page.
app.get(
  "/api/sales/orders/:id",
  asyncHandler(async (req, res) => {
    const order = await SalesOrder.findOne({ id: req.params.id });
    if (!order) return res.status(404).json({ message: "Sales order not found." });
    res.json(order);
  })
);

// Powers the "Sales" landing/overview screen (mobile bottom-nav tab and the
// native app's Sales screen): all figures are computed live from the DB,
// scoped to the requested period (defaults to the current calendar month).
app.get(
  "/api/sales/overview",
  asyncHandler(async (req, res) => {
    const now = new Date();
    const range = req.query.range || "month";
    let periodStart;
    if (range === "year") periodStart = new Date(now.getFullYear(), 0, 1);
    else if (range === "week") {
      const day = now.getDay();
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() - day);
      periodStart.setHours(0, 0, 0, 0);
    } else periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [orders, invoices] = await Promise.all([
      SalesOrder.find({ createdAt: { $gte: periodStart } }),
      Invoice.find({ createdAt: { $gte: periodStart } }),
    ]);

    const totalSalesInvoiced = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const totalOrders = orders.length;
    const totalInvoices = invoices.length;
    const orderValueSum = orders.reduce((sum, o) => sum + (o.amount || 0), 0);
    const averageOrderValue = totalOrders ? Math.round(orderValueSum / totalOrders) : 0;

    const [recentOrders, recentInvoices] = await Promise.all([
      SalesOrder.find().sort({ seq: -1 }).limit(5),
      Invoice.find().sort({ seq: -1 }).limit(5),
    ]);

    res.json({
      range,
      stats: { totalSalesInvoiced, totalOrders, totalInvoices, averageOrderValue },
      salesTrend: await computeSalesTrend(6),
      recentOrders,
      recentInvoices,
    });
  })
);

// The Sales Order form now captures everything per-product in `lineItems`;
// the flat product/qty/unit/amount/items columns are kept in sync from those
// rows so the list view, KPI totals, CSV export and "Convert to Invoice" all
// keep working. Explicit body values still win when provided (other API
// callers may post the flat fields directly, with no line items).
function deriveSalesOrderScalars(lineItems) {
  const rows = Array.isArray(lineItems) ? lineItems : [];
  return {
    product: rows.map((r) => r.product).filter(Boolean).join(", "),
    qty: rows.reduce((s, r) => s + (Number(r.orderQty) || 0), 0),
    unit: (rows.find((r) => r.unit) || {}).unit || "Nos",
    amount: rows.reduce((s, r) => s + (Number(r.orderQty) || 0) * (Number(r.unitPrice) || 0), 0),
    items: rows.length,
    requiredDate: (rows.find((r) => r.requiredDate) || {}).requiredDate || "",
  };
}

app.post(
  "/api/sales/orders",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.customer) return res.status(400).json({ message: "Customer is required." });
    const { seq } = await nextSeqAndNumber(SalesOrder);
    const orderNo = await allocateDocNumber(SalesOrder, "salesOrder");
    const lineItems = Array.isArray(body.lineItems) ? body.lineItems : [];
    const derived = deriveSalesOrderScalars(lineItems);
    const newOrder = await SalesOrder.create({
      id: orderNo,
      seq,
      orderNo,
      customer: body.customer,
      city: body.city || "Chennai",
      orderDate: body.orderDate || todayLabel(),
      deliveryDate: body.deliveryDate || futureLabel(7),
      requiredDate: body.requiredDate || derived.requiredDate || futureLabel(7),
      poNumber: body.poNumber || "",
      poDate: body.poDate || "",
      product: body.product || derived.product,
      qty: Number(body.qty) || derived.qty,
      unit: body.unit || derived.unit,
      amount: Number(body.amount) || derived.amount,
      items: Number(body.items) || derived.items || 1,
      lineItems,
      status: "Open",
      deliveryStatus: body.deliveryStatus || "Not Dispatched",
      paymentStatus: body.paymentStatus || "Pending",
      salesRep: body.salesRep || "",
      customFields: isPlainObject(body.customFields) ? body.customFields : {},
    });
    res.status(201).json(newOrder);
  })
);

addCrudRoutes("/api/sales/orders", SalesOrder, {
  // Keep the flat columns in step with edited line items.
  sanitize: (updates) => {
    if (!Array.isArray(updates.lineItems)) return;
    const d = deriveSalesOrderScalars(updates.lineItems);
    updates.product = d.product;
    updates.qty = d.qty;
    updates.unit = d.unit;
    updates.amount = d.amount;
    updates.items = d.items || 1;
    if (d.requiredDate) updates.requiredDate = d.requiredDate;
  },
});

// ---------- Sales: Delivery Challans ----------
app.get(
  "/api/sales/delivery-challans",
  asyncHandler(async (req, res) => res.json(await paginate(DeliveryChallan, {}, req)))
);

// Single-record lookup, used by the printable delivery challan view.
app.get(
  "/api/sales/delivery-challans/:id",
  asyncHandler(async (req, res) => {
    const dc = await DeliveryChallan.findOne({ id: req.params.id });
    if (!dc) return res.status(404).json({ message: "Delivery challan not found." });
    res.json(dc);
  })
);

app.post(
  "/api/sales/delivery-challans",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.customer) return res.status(400).json({ message: "Customer is required." });
    const { seq } = await nextSeqAndNumber(DeliveryChallan);
    const challanId = await allocateDocNumber(DeliveryChallan, "deliveryChallan");
    const newChallan = await DeliveryChallan.create({
      id: challanId,
      seq,
      salesOrder: body.salesOrder || "—",
      customer: body.customer,
      date: todayLabel(),
      product: body.product || "",
      dispatchedQty: Number(body.dispatchedQty) || 0,
      unit: body.unit || "Nos",
      warehouse: body.warehouse || "Main Warehouse",
      transporter: body.transporter || "",
      items: Number(body.items) || 1,
      vehicleNo: body.vehicleNo || "TN 00 AB 0000",
      status: body.status || "Pending",
      customFields: isPlainObject(body.customFields) ? body.customFields : {},
    });
    res.status(201).json(newChallan);
  })
);

addCrudRoutes("/api/sales/delivery-challans", DeliveryChallan);

// ---------- Sales: Invoices ----------
app.get(
  "/api/sales/invoices",
  asyncHandler(async (req, res) => res.json(await paginate(Invoice, {}, req)))
);

// MUST stay above the ":id" route below — Express matches in registration
// order, so a literal path registered after it is swallowed as an id.
// What this client's invoices are held by, if anything. Powers the banner
// on the invoice screens — a client with no rules gets an empty list and
// the screens show nothing at all.
app.get(
  "/api/sales/invoices/approval-rules",
  asyncHandler(async (req, res) => {
    const registry = await getPlatformRegistry();
    const rules = rulesForDocument(registry.approvalRules, "sales:invoices", req._tenant);
    res.json({
      rules: rules.map((r) => ({
        code: r.code,
        name: r.name,
        description: r.description || "",
        condition: r.condition,
        threshold: r.threshold,
        approverRoles: r.approverRoles || [],
      })),
    });
  })
);

// Single-record lookup, used by the printable invoice view.
app.get(
  "/api/sales/invoices/:id",
  asyncHandler(async (req, res) => {
    const invoice = await Invoice.findOne({ id: req.params.id });
    if (!invoice) return res.status(404).json({ message: "Invoice not found." });
    res.json(invoice);
  })
);

function computeSalesInvoiceStatus(paidAmount, total) {
  if (total > 0 && paidAmount >= total) return "Paid";
  if (paidAmount > 0) return "Partially Paid";
  return "Unpaid";
}

// Invoicing a customer name that isn't in the Customer List yet (typed
// fresh on the invoice form) also creates that customer record, so the
// Customer List and future invoices' address/phone auto-fill stay in sync.
async function ensureCustomerFromInvoice(name, address, phone) {
  if (!name) return;
  const existing = await Customer.findOne({ name });
  if (existing) {
    // Fill in address/phone on the existing record only if it doesn't have
    // them yet — never overwrite data already on file for that customer.
    const updates = {};
    if (address && !existing.address) updates.address = address;
    if (phone && !existing.phone) updates.phone = sanitizePhone(phone);
    if (Object.keys(updates).length) await Customer.updateOne({ _id: existing._id }, { $set: updates });
    return;
  }
  const { seq } = await nextSeqAndNumber(Customer);
  const customerId = await allocateDocNumber(Customer, "customerCode");
  await Customer.create({
    id: customerId,
    seq,
    name,
    address: address || "",
    phone: sanitizePhone(phone) || "",
    city: "Chennai",
    status: "Active",
  });
}

// Normalizes the invoice's line items (keeps hsnCode, unlike the generic
// computeLineItems used by Purchase — sales invoices need HSN/SAC printed
// per line) and computes subTotal/taxTotal from them server-side, so the
// stored totals are always authoritative rather than trusting client math.
function computeInvoiceLineItems(rawItems) {
  const items = (Array.isArray(rawItems) ? rawItems : [])
    .filter((r) => r && r.product)
    .map((r) => {
      // The forms already refuse these, but the API must too: a negative
      // quantity or price would quietly reduce an invoice's or quotation's
      // total, and a tax rate outside 0-100% has no meaning.
      const quantity = Math.max(Number(r.quantity) || 0, 0);
      const unitPrice = Math.max(Number(r.unitPrice) || 0, 0);
      const taxPercent = Math.min(Math.max(Number(r.taxPercent) || 0, 0), 100);
      const amount = quantity * unitPrice * (1 + taxPercent / 100);
      const serials = Array.isArray(r.serials) ? r.serials.map((s) => String(s).trim()).filter(Boolean) : [];
      return { product: r.product, hsnCode: r.hsnCode || "", quantity, unit: r.unit || "Nos", unitPrice, taxPercent, amount, serials };
    });
  const subTotal = items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);
  const taxTotal = items.reduce((a, i) => a + (i.amount - i.quantity * i.unitPrice), 0);
  return { items, subTotal, taxTotal };
}

app.post(
  "/api/sales/invoices",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.customer) return res.status(400).json({ message: "Customer is required." });
    const { seq } = await nextSeqAndNumber(Invoice);
    const invoiceId = await allocateDocNumber(Invoice, "invoice");
    // This customer's agreed terms decide the due date; defaultDueDate()
    // falls back to the global setting when they have none.
    const customerRecord = await Customer.findOne({ name: body.customer }, { paymentTerms: 1, state: 1 }).lean();
    const customerTerms = customerRecord && customerRecord.paymentTerms;
    const { items, subTotal, taxTotal } = computeInvoiceLineItems(body.items);
    const freightCharges = Number(body.freightCharges) || 0;
    const amount = subTotal + taxTotal + freightCharges;
    const paidAmount = Number(body.paidAmount) || 0;
    // The invoice date is whatever the user chose (before or after today);
    // today when none is given.
    const invoiceDate = userDateLabel(body.date) || todayLabel();
    // The Add Invoice form always sends a Place of Supply once a customer is
    // picked (it auto-fills from that customer's state, editable after), so
    // this fallback only matters for a client that doesn't send the field at
    // all — never silently left blank in normal use.
    const placeOfSupply = body.placeOfSupply || (customerRecord && customerRecord.state) || "";
    const newInvoice = await Invoice.create({
      id: invoiceId,
      seq,
      placeOfSupply,
      soNumber: body.soNumber || "—",
      dcNumber: body.dcNumber || "—",
      poNumber: body.poNumber || "",
      poDate: body.poDate || "",
      transportName: body.transportName || "",
      vehicleNo: body.vehicleNo || "",
      deliveryDate: body.deliveryDate || "",
      deliveryLocation: body.deliveryLocation || "",
      paymentMode: body.paymentMode || "",
      paymentReference: body.paymentReference || "",
      eWayBillNo: body.eWayBillNo || "",
      notes: body.notes || "",
      items,
      freightCharges,
      subTotal,
      taxTotal,
      product: items.map((i) => i.product).join(", "),
      customer: body.customer,
      address: body.address || "",
      phone: body.phone || "",
      shippingSameAsBilling: body.shippingSameAsBilling !== false,
      shippingAddress: body.shippingSameAsBilling === false ? body.shippingAddress || "" : "",
      date: invoiceDate,
      // Default due date counts from the invoice date, not from today.
      dueDate: body.dueDate || (await defaultDueDate("sales", customerTerms, parseDateLabel(invoiceDate))),
      amount,
      paidAmount,
      balance: amount - paidAmount,
      status: body.status || computeSalesInvoiceStatus(paidAmount, amount),
      customFields: isPlainObject(body.customFields) ? body.customFields : {},
      ...(await approvalFieldsFor(req, { grandTotal: amount, discountPercent: Number(body.discountPercent) || 0 })),
    });
    await ensureCustomerFromInvoice(body.customer, body.address, body.phone);
    res.status(201).json(newInvoice);
  })
);

// Runs the approval engine over an invoice about to be saved. Returns the
// fields to store on it. No rules configured means every invoice comes back
// "not_required", which is how the app behaved before approvals existed.
async function approvalFieldsFor(req, doc) {
  const registry = await getPlatformRegistry();
  const verdict = evaluateDocument(registry.approvalRules, "sales:invoices", req._tenant, doc);
  return {
    approvalStatus: verdict.status,
    approvalReason: verdict.reason,
    // Cleared on every save: an invoice edited after being signed off has to
    // be signed off again, or approval would be a one-time formality that
    // any later edit could walk straight past.
    approvedBy: "",
    approvedAt: null,
    approvalNote: "",
  };
}

app.put(
  "/api/sales/invoices/:id",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.customer) return res.status(400).json({ message: "Customer is required." });
    const beforeInvoice = await Invoice.findOne({ id: req.params.id });
    const { items, subTotal, taxTotal } = computeInvoiceLineItems(body.items);
    const freightCharges = Number(body.freightCharges) || 0;
    const amount = subTotal + taxTotal + freightCharges;
    const paidAmount = Number(body.paidAmount) || 0;
    let placeOfSupply = body.placeOfSupply || "";
    if (!placeOfSupply) {
      const customerRecord = await Customer.findOne({ name: body.customer }, { state: 1 }).lean();
      placeOfSupply = (customerRecord && customerRecord.state) || (beforeInvoice && beforeInvoice.placeOfSupply) || "";
    }
    const updated = await Invoice.findOneAndUpdate(
      { id: req.params.id },
      {
        $set: {
          placeOfSupply,
          soNumber: body.soNumber || "—",
          dcNumber: body.dcNumber || "—",
          poNumber: body.poNumber || "",
          poDate: body.poDate || "",
          transportName: body.transportName || "",
          vehicleNo: body.vehicleNo || "",
          deliveryDate: body.deliveryDate || "",
          deliveryLocation: body.deliveryLocation || "",
          paymentMode: body.paymentMode || "",
          paymentReference: body.paymentReference || "",
          eWayBillNo: body.eWayBillNo || "",
          notes: body.notes || "",
          items,
          freightCharges,
          subTotal,
          taxTotal,
          product: items.map((i) => i.product).join(", "),
          customer: body.customer,
          address: body.address || "",
          phone: body.phone || "",
          shippingSameAsBilling: body.shippingSameAsBilling !== false,
          shippingAddress: body.shippingSameAsBilling === false ? body.shippingAddress || "" : "",
          ...(userDateLabel(body.date) ? { date: userDateLabel(body.date) } : {}),
          dueDate: body.dueDate || futureLabel(15, parseDateLabel(userDateLabel(body.date) || (beforeInvoice && beforeInvoice.date))),
          amount,
          paidAmount,
          balance: amount - paidAmount,
          status: body.status || computeSalesInvoiceStatus(paidAmount, amount),
          customFields: isPlainObject(body.customFields) ? body.customFields : {},
          // Re-run on every edit, and any previous sign-off is cleared with
          // it — an approved invoice edited afterwards has to be approved
          // again, or the step would be trivially bypassable.
          ...(await approvalFieldsFor(req, {
            grandTotal: amount,
            discountPercent: Number(body.discountPercent) || 0,
          })),
        },
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Record not found." });
    await ensureCustomerFromInvoice(body.customer, body.address, body.phone);
    res.json(updated);
    audit(req, {
      action: "Update",
      module: "Invoices",
      entityType: "Invoice",
      entityId: req.params.id,
      description: `Updated invoice ${req.params.id}`,
      before: beforeInvoice,
      after: updated,
    });
  })
);

// Lightweight link-only update: stamps the Delivery Challan number onto an
// invoice after "Convert to Delivery Challan" without going through the full
// invoice PUT (which rebuilds every field from the body).

// Signing off — or refusing — an invoice the engine held.
//
// The acting role is checked against the rules that actually held THIS
// invoice, re-evaluated from what is stored rather than trusted from the
// request, so a client cannot approve their own document by claiming a role
// in a header the engine never consulted.
async function decideInvoice(req, res, decision) {
  const invoice = await Invoice.findOne({ id: req.params.id });
  if (!invoice) return res.status(404).json({ message: "Record not found." });
  if (invoice.approvalStatus !== "pending") {
    return res.status(409).json({
      code: "NOT_PENDING",
      message: `Invoice ${invoice.id} is not waiting for approval.`,
    });
  }
  const registry = await getPlatformRegistry();
  const verdict = evaluateDocument(registry.approvalRules, "sales:invoices", req._tenant, {
    grandTotal: invoice.amount,
  });
  const roleName = (req.headers["x-user-role"] || "").trim();
  if (!canApprove(roleName, verdict.approverRoles)) {
    return res.status(403).json({
      code: "NOT_AN_APPROVER",
      message: `Your role cannot ${decision === "approved" ? "approve" : "reject"} this invoice.`,
      approverRoles: verdict.approverRoles,
    });
  }
  const before = invoice.toObject();
  invoice.approvalStatus = decision;
  invoice.approvedBy = roleName;
  invoice.approvedAt = new Date();
  invoice.approvalNote = String((req.body || {}).note || "").trim();
  await invoice.save();
  res.json(invoice);
  audit(req, {
    action: decision === "approved" ? "Approved" : "Rejected",
    module: "Invoices",
    entityType: "Invoice",
    entityId: invoice.id,
    description: `${decision === "approved" ? "Approved" : "Rejected"} invoice ${invoice.id}`,
    before,
    after: invoice,
  });
}

app.post(
  "/api/sales/invoices/:id/approve",
  asyncHandler((req, res) => decideInvoice(req, res, "approved"))
);

app.post(
  "/api/sales/invoices/:id/reject",
  asyncHandler((req, res) => decideInvoice(req, res, "rejected"))
);

app.put(
  "/api/sales/invoices/:id/dc-number",
  asyncHandler(async (req, res) => {
    const dcNumber = (req.body && req.body.dcNumber) || "—";
    const updated = await Invoice.findOneAndUpdate(
      { id: req.params.id },
      { $set: { dcNumber } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Record not found." });
    res.json(updated);
  })
);

app.delete(
  "/api/sales/invoices/:id",
  asyncHandler(async (req, res) => {
    const deleted = await Invoice.findOneAndDelete({ id: req.params.id });
    if (!deleted) return res.status(404).json({ message: "Record not found." });
    res.json({ success: true });
  })
);

// ---------- Sales: Returns ----------
app.get(
  "/api/sales/returns",
  asyncHandler(async (req, res) => res.json(await paginate(SalesReturn, {}, req)))
);

// Single-record lookup — used by the standalone Edit Sales Return page.
app.get(
  "/api/sales/returns/:id",
  asyncHandler(async (req, res) => {
    const ret = await SalesReturn.findOne({ id: req.params.id });
    if (!ret) return res.status(404).json({ message: "Sales return not found." });
    res.json(ret);
  })
);

app.post(
  "/api/sales/returns",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.customer) return res.status(400).json({ message: "Customer is required." });
    const { seq, number } = await nextSeqAndNumber(SalesReturn);
    const newReturn = await SalesReturn.create({
      id: `PSR-${String(number).padStart(4, "0")}`,
      seq,
      customer: body.customer,
      invoiceNo: body.invoiceNo || "—",
      soNumber: body.soNumber || "—",
      dcNumber: body.dcNumber || "—",
      product: body.product || "",
      qty: Number(body.qty) || 0,
      unit: body.unit || "Nos",
      date: todayLabel(),
      reason: body.reason || "Not specified",
      amount: Number(body.amount) || 0,
      status: body.status || "Pending",
      customFields: isPlainObject(body.customFields) ? body.customFields : {},
    });
    res.status(201).json(newReturn);
  })
);

addCrudRoutes("/api/sales/returns", SalesReturn);

// ---------- Maintenance ----------
app.get(
  "/api/maintenance",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.view === "due") filter.status = { $in: ["Scheduled", "In Progress", "Overdue"] };
    if (req.query.view === "history") filter.status = "Completed";
    res.json(await paginate(MaintenanceTask, filter, req));
  })
);

app.post(
  "/api/maintenance",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.asset) return res.status(400).json({ message: "Asset is required." });
    const { seq, number } = await nextSeqAndNumber(MaintenanceTask);
    const newTask = await MaintenanceTask.create({
      id: `MT-${String(number).padStart(4, "0")}`,
      seq,
      asset: body.asset,
      type: body.type || "Preventive",
      scheduledDate: todayLabel(),
      assignedTo: body.assignedTo || "R. Kumar",
      status: "Scheduled",
      customFields: isPlainObject(body.customFields) ? body.customFields : {},
    });
    res.status(201).json(newTask);
  })
);

addCrudRoutes("/api/maintenance", MaintenanceTask);

// ---------- Users & Roles ----------
// Nothing that could be used to sign in, or to set a password, ever leaves
// the server on a user record.
function sanitizeUser(doc) {
  const obj = doc.toJSON ? doc.toJSON() : { ...doc };
  delete obj.password;
  delete obj.passwordHash;
  delete obj.inviteTokenHash;
  // Useful to the Users screen, and safe: whether an invite is outstanding,
  // not what it is.
  obj.hasPassword = Boolean(doc.passwordHash);
  obj.invitePending = Boolean(doc.inviteTokenHash);
  delete obj.inviteExpiresAt;
  return obj;
}

function emailRegex(email) {
  return new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
}

app.get(
  "/api/users",
  asyncHandler(async (req, res) => {
    const result = await paginate(User, {}, req);
    result.data = result.data.map(sanitizeUser);
    res.json(result);
  })
);

app.post(
  "/api/users",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ message: "Name is required." });
    // Deliberately no password field. An admin typing a password on somebody
    // else's behalf means two people know it, and it usually means it gets
    // said out loud across an office. The account is created dormant and the
    // person sets their own through a one-time link.
    const email = body.email || `${body.name.toLowerCase().replace(/\s+/g, ".")}@company.com`;
    const existing = await User.findOne({ email: emailRegex(email) });
    if (existing) return res.status(400).json({ message: "A user with this email already exists." });
    const { seq, number } = await nextSeqAndNumber(User);
    const newUser = await User.create({
      id: `USR-${String(number).padStart(3, "0")}`,
      seq,
      name: body.name,
      email,
      role: body.role || "Viewer",
      status: "Invited",
      lastLogin: "—",
    });
    res.status(201).json(sanitizeUser(newUser));
  })
);

// Single-record read for the Edit User page. Goes through sanitizeUser so
// the password hash never leaves the server.
app.get(
  "/api/users/:id",
  asyncHandler(async (req, res) => {
    const found = await User.findOne({ id: req.params.id });
    if (!found) return res.status(404).json({ message: "Record not found." });
    res.json(sanitizeUser(found));
  })
);

app.put(
  "/api/users/:id",
  asyncHandler(async (req, res) => {
    const updates = cleanUpdateBody(req.body);
    if (updates.email) {
      const existing = await User.findOne({ email: emailRegex(updates.email), id: { $ne: req.params.id } });
      if (existing) return res.status(400).json({ message: "A user with this email already exists." });
    }
    // Passwords are never set through this route. An admin editing a user
    // changes their name, role or status; the person themselves sets their
    // password through a one-time link. Anything sent here is dropped rather
    // than written, so an old client cannot reintroduce plain text.
    delete updates.password;
    delete updates.passwordHash;
    delete updates.inviteTokenHash;
    const beforeUser = await User.findOne({ id: req.params.id });
    const updated = await User.findOneAndUpdate({ id: req.params.id }, { $set: updates }, { new: true });
    if (!updated) return res.status(404).json({ message: "Record not found." });
    res.json(sanitizeUser(updated));
    const passwordChanged = false;
    const roleChanged = beforeUser && updates.role !== undefined && updates.role !== beforeUser.role;
    audit(req, {
      action: passwordChanged ? "Password Changed" : roleChanged ? "Role Changed" : "User Updated",
      module: "Users & Roles",
      entityType: "User",
      entityId: req.params.id,
      description: passwordChanged
        ? `Password changed for ${updated.name}`
        : roleChanged
          ? `Role changed for ${updated.name}: ${beforeUser.role} → ${updates.role}`
          : `Updated user ${updated.name}`,
      before: passwordChanged ? undefined : beforeUser,
      after: passwordChanged ? undefined : updated,
    });
  })
);

app.delete(
  "/api/users/:id",
  asyncHandler(async (req, res) => {
    const deleted = await User.findOneAndDelete({ id: req.params.id });
    if (!deleted) return res.status(404).json({ message: "Record not found." });
    res.json({ success: true });
    audit(req, {
      action: "User Deleted",
      module: "Users & Roles",
      entityType: "User",
      entityId: req.params.id,
      description: `Deleted user ${deleted.name}`,
      before: deleted,
    });
  })
);

// ---------- Roles & Permissions ----------
app.get(
  "/api/roles",
  asyncHandler(async (req, res) => res.json(await paginate(Role, {}, req)))
);

app.post(
  "/api/roles",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ message: "Name is required." });
    const { seq, number } = await nextSeqAndNumber(Role);
    const newRole = await Role.create({
      id: `ROLE-${String(number).padStart(3, "0")}`,
      seq,
      name: body.name,
      description: body.description || "",
      permissions: Array.isArray(body.permissions)
        ? body.permissions
        : String(body.permissions || "")
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
      status: "Active",
    });
    res.status(201).json(newRole);
  })
);

addCrudRoutes("/api/roles", Role, {
  sanitize: (updates) => {
    if (updates.permissions !== undefined && !Array.isArray(updates.permissions)) {
      updates.permissions = String(updates.permissions || "")
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
    }
  },
});

// Offered as a "Create default roles" button on an empty Roles screen.
// Not automatic: an empty Roles collection is what tells the middleware
// "not configured — allow everything", so creating them is the deliberate
// act that switches enforcement on.
//
// The templates come from the platform's Global Roles registry, so a change
// made there reaches every client that sets roles up afterwards. DEFAULT_ROLES
// remains the fallback for the case where the registry is unreachable — this
// button must keep working even if master_db is having a bad day.
app.post(
  "/api/roles/seed-defaults",
  asyncHandler(async (req, res) => {
    const existing = await Role.countDocuments();
    if (existing > 0) {
      return res.status(409).json({ message: "Roles already exist — delete them first or edit the ones you have." });
    }
    let { seq } = await nextSeqAndNumber(Role);
    const created = [];
    let templates = DEFAULT_ROLES;
    try {
      const globals = await getGlobalRoleModel().find({ status: "active" }).sort({ createdAt: 1 }).lean();
      if (globals.length) templates = globals;
    } catch (err) {
      console.error("Global roles unavailable, seeding from the built-in defaults:", err.message);
    }
    for (const r of templates) {
      created.push(
        await Role.create({
          id: `ROLE-${String(seq).padStart(3, "0")}`,
          seq,
          name: r.name,
          description: r.description,
          permissions: r.permissions,
          status: "Active",
        })
      );
      seq++;
    }
    invalidateRoleCache();
    res.status(201).json({ created: created.length, roles: created });
  })
);

// ---------- Audit log (read-only; no PUT/DELETE — rows are immutable) ----------
const SECURITY_ACTIONS = [
  "Failed Login",
  "Password Changed",
  "Role Changed",
  "Permission Changed",
  "User Deleted",
  "Logout",
];

function buildAuditLogFilter(query) {
  const filter = {};
  const eq = (field, val) => {
    if (val && val !== "all") filter[field] = val;
  };
  eq("user", query.user);
  eq("role", query.role);
  eq("module", query.module);
  eq("action", query.action);
  eq("status", query.status);
  if (query.ip) filter.ip = new RegExp(query.ip.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  if (query.search) {
    const re = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [
      { user: re },
      { action: re },
      { module: re },
      { description: re },
      { details: re },
      { entityId: re },
      { ip: re },
    ];
  }
  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }
  return filter;
}

app.get(
  "/api/activity-log/summary",
  asyncHandler(async (req, res) => {
    const [total, failedAttempts, securityEvents, systemEvents] = await Promise.all([
      ActivityLog.estimatedDocumentCount(),
      ActivityLog.countDocuments({ action: "Failed Login" }),
      ActivityLog.countDocuments({ $or: [{ status: "Failed" }, { action: { $in: SECURITY_ACTIONS } }] }),
      ActivityLog.countDocuments({ user: { $in: ["System", ""] } }),
    ]);
    res.json({
      total,
      userActions: Math.max(total - systemEvents, 0),
      systemEvents,
      securityEvents,
      failedAttempts,
    });
  })
);

app.get(
  "/api/activity-log/filter-options",
  asyncHandler(async (req, res) => {
    const [users, roles, modules, actions] = await Promise.all([
      ActivityLog.distinct("user"),
      ActivityLog.distinct("role"),
      ActivityLog.distinct("module"),
      ActivityLog.distinct("action"),
    ]);
    const clean = (arr) => arr.filter(Boolean).sort();
    res.json({ users: clean(users), roles: clean(roles), modules: clean(modules), actions: clean(actions) });
  })
);

app.get(
  "/api/activity-log",
  asyncHandler(async (req, res) => res.json(await paginate(ActivityLog, buildAuditLogFilter(req.query), req)))
);

// ---------- Reports (static, informational only) ----------
app.get("/api/reports", (req, res) => {
  const category = req.query.category;
  const list = category ? REPORTS.filter((r) => r.category === category) : REPORTS;
  res.json(list);
});

// ---------- Reports: Sales Summary ----------
app.get(
  "/api/reports/sales-summary/filters",
  asyncHandler(async (req, res) => {
    const [customers, products, categories, brands, salespeople] = await Promise.all([
      Customer.find().sort({ name: 1 }).select("name"),
      Item.find().sort({ name: 1 }).select("name"),
      Category.find().sort({ name: 1 }).select("name"),
      Brand.find().sort({ name: 1 }).select("name"),
      SalesOrder.distinct("salesRep"),
    ]);
    res.json({
      customers: customers.map((c) => c.name),
      products: products.map((p) => p.name),
      categories: categories.map((c) => c.name),
      brands: brands.map((b) => b.name),
      salespeople: salespeople.filter(Boolean).sort(),
    });
  })
);

app.get(
  "/api/reports/sales-summary",
  asyncHandler(async (req, res) => {
    const { dateFrom, dateTo, customer, product, category, brand, salesperson } = req.query;
    const match = {};
    if (customer) match.customer = customer;
    if (product) match.product = product;
    if (salesperson) match.salesRep = salesperson;
    if (dateFrom || dateTo) {
      match.createdAt = {};
      if (dateFrom) match.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        match.createdAt.$lte = end;
      }
    }

    if (category || brand) {
      const productFilter = {};
      if (category) productFilter.category = category;
      if (brand) productFilter.brand = brand;
      const matchingProducts = await Item.find(productFilter).select("name");
      const names = matchingProducts.map((p) => p.name);
      match.product = match.product ? match.product : { $in: names };
      if (match.product && typeof match.product === "object" && !match.product.$in) {
        // a specific product filter was already applied; keep it as-is
      }
    }

    const rows = await SalesOrder.aggregate([
      { $match: match },
      {
        $group: {
          _id: { customer: "$customer", product: "$product", region: "$city" },
          orders: { $sum: 1 },
          qty: { $sum: "$qty" },
          value: { $sum: "$amount" },
        },
      },
      { $sort: { value: -1 } },
    ]);

    const summary = rows.map((r) => ({
      customer: r._id.customer,
      product: r._id.product || "—",
      region: r._id.region || "—",
      orders: r.orders,
      qty: r.qty,
      value: r.value,
    }));

    const totals = summary.reduce(
      (acc, r) => ({ orders: acc.orders + r.orders, qty: acc.qty + r.qty, value: acc.value + r.value }),
      { orders: 0, qty: 0, value: 0 }
    );

    res.json({ rows: summary, totals });
  })
);

app.get(
  "/api/reports/sales-summary/breakdown",
  asyncHandler(async (req, res) => {
    const { groupBy = "month", dateFrom, dateTo, customer, product, category, brand, salesperson } = req.query;

    let productNames = null;
    if (category || brand) {
      const productFilter = {};
      if (category) productFilter.category = category;
      if (brand) productFilter.brand = brand;
      const matchingProducts = await Item.find(productFilter).select("name");
      productNames = matchingProducts.map((p) => p.name);
    }

    const dateFilter = {};
    if (dateFrom || dateTo) {
      dateFilter.createdAt = {};
      if (dateFrom) dateFilter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        dateFilter.createdAt.$lte = end;
      }
    }

    const soFilter = { ...dateFilter };
    if (customer) soFilter.customer = customer;
    if (salesperson) soFilter.salesRep = salesperson;
    if (product) soFilter.product = product;
    else if (productNames) soFilter.product = { $in: productNames };

    const invFilter = { ...dateFilter };
    if (customer) invFilter.customer = customer;
    if (product) invFilter.product = product;
    else if (productNames) invFilter.product = { $in: productNames };

    const retFilter = { ...dateFilter };
    if (customer) retFilter.customer = customer;
    if (product) retFilter.product = product;
    else if (productNames) retFilter.product = { $in: productNames };

    const [orders, invoices, returns] = await Promise.all([
      SalesOrder.find(soFilter),
      Invoice.find(invFilter),
      SalesReturn.find(retFilter),
    ]);

    if (groupBy === "month") {
      const monthLabel = (d) => new Date(d).toLocaleString("en-US", { month: "short", year: "numeric" });
      const map = new Map();
      const getRow = (key) => {
        if (!map.has(key)) {
          map.set(key, { month: key, salesOrders: 0, invoices: 0, grossSales: 0, returns: 0, paid: 0, outstanding: 0 });
        }
        return map.get(key);
      };
      orders.forEach((o) => {
        getRow(monthLabel(o.createdAt)).salesOrders += 1;
      });
      invoices.forEach((inv) => {
        const row = getRow(monthLabel(inv.createdAt));
        row.invoices += 1;
        row.grossSales += inv.amount || 0;
        row.paid += inv.paidAmount || 0;
        row.outstanding += inv.balance || 0;
      });
      returns.forEach((r) => {
        getRow(monthLabel(r.createdAt)).returns += r.amount || 0;
      });
      const rows = Array.from(map.values())
        .map((r) => ({ ...r, netSales: r.grossSales - r.returns }))
        .sort((a, b) => new Date(a.month) - new Date(b.month));
      return res.json({ rows });
    }

    if (groupBy === "customer") {
      const map = new Map();
      const getRow = (key) => {
        if (!map.has(key)) {
          map.set(key, { customer: key, orders: 0, qty: 0, grossSales: 0, returns: 0, paid: 0, outstanding: 0 });
        }
        return map.get(key);
      };
      orders.forEach((o) => {
        const row = getRow(o.customer);
        row.orders += 1;
        row.qty += o.qty || 0;
      });
      invoices.forEach((inv) => {
        const row = getRow(inv.customer);
        row.grossSales += inv.amount || 0;
        row.paid += inv.paidAmount || 0;
        row.outstanding += inv.balance || 0;
      });
      returns.forEach((r) => {
        getRow(r.customer).returns += r.amount || 0;
      });
      const rows = Array.from(map.values())
        .map((r) => ({ ...r, netSales: r.grossSales - r.returns }))
        .sort((a, b) => b.grossSales - a.grossSales);
      return res.json({ rows });
    }

    if (groupBy === "product" || groupBy === "category" || groupBy === "brand") {
      const itemDocs = await Item.find();
      const productMap = new Map(itemDocs.map((p) => [p.name, p]));

      const map = new Map();
      const getRow = (key) => {
        if (!map.has(key)) {
          map.set(key, { product: key, qty: 0, grossSales: 0, returns: 0 });
        }
        return map.get(key);
      };
      orders.forEach((o) => {
        if (!o.product) return;
        const row = getRow(o.product);
        row.qty += o.qty || 0;
      });
      invoices.forEach((inv) => {
        if (!inv.product) return;
        getRow(inv.product).grossSales += inv.amount || 0;
      });
      returns.forEach((r) => {
        if (!r.product) return;
        getRow(r.product).returns += r.amount || 0;
      });

      const productRows = Array.from(map.values()).map((r) => {
        const p = productMap.get(r.product);
        return {
          productCode: (p && p.itemCode) || "—",
          product: r.product,
          category: (p && p.category) || "—",
          brand: (p && p.brand) || "—",
          unit: (p && p.unit) || "Nos",
          qty: r.qty,
          grossSales: r.grossSales,
          returns: r.returns,
          netSales: r.grossSales - r.returns,
        };
      });

      if (groupBy === "product") {
        productRows.sort((a, b) => b.grossSales - a.grossSales);
        return res.json({ rows: productRows });
      }

      const key = groupBy; // "category" | "brand"
      const rollup = new Map();
      productRows.forEach((r) => {
        const groupKey = r[key];
        if (!rollup.has(groupKey)) {
          rollup.set(groupKey, { [key]: groupKey, qty: 0, grossSales: 0, returns: 0 });
        }
        const row = rollup.get(groupKey);
        row.qty += r.qty;
        row.grossSales += r.grossSales;
        row.returns += r.returns;
      });

      const rows = await Promise.all(
        Array.from(rollup.values()).map(async (r) => ({
          [key]: r[key],
          products: await Item.countDocuments({ [key]: r[key] }),
          qty: r.qty,
          grossSales: r.grossSales,
          returns: r.returns,
          netSales: r.grossSales - r.returns,
        }))
      );
      rows.sort((a, b) => b.grossSales - a.grossSales);
      return res.json({ rows });
    }

    if (groupBy === "detail") {
      const orderMap = new Map(orders.map((o) => [o.orderNo, o]));
      const returnsByInvoice = new Map();
      returns.forEach((r) => {
        returnsByInvoice.set(r.invoiceNo, (returnsByInvoice.get(r.invoiceNo) || 0) + (r.amount || 0));
      });
      const rows = invoices
        .map((inv) => {
          const so = orderMap.get(inv.soNumber);
          const returnAmt = returnsByInvoice.get(inv.id) || 0;
          return {
            date: inv.date,
            soNumber: inv.soNumber,
            invoiceNo: inv.id,
            customer: inv.customer,
            product: inv.product || (so && so.product) || "—",
            qty: (so && so.qty) || 0,
            salesValue: inv.amount || 0,
            returnAmt,
            net: (inv.amount || 0) - returnAmt,
            paid: inv.paidAmount || 0,
            status: inv.status,
            createdAt: inv.createdAt,
          };
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.json({ rows });
    }

    res.status(400).json({ message: "Invalid groupBy value." });
  })
);

// ---------- Reports: Purchase Summary ----------
app.get(
  "/api/reports/purchase-summary/filters",
  asyncHandler(async (req, res) => {
    const [suppliers, products, categories, brands, warehouses, purchaseStatuses, paymentStatuses] = await Promise.all([
      Supplier.find().sort({ name: 1 }).select("name"),
      Item.find().sort({ name: 1 }).select("name"),
      Category.find().sort({ name: 1 }).select("name"),
      Brand.find().sort({ name: 1 }).select("name"),
      GoodsReceipt.distinct("warehouse"),
      PurchaseOrder.distinct("status"),
      PurchaseInvoice.distinct("status"),
    ]);
    res.json({
      suppliers: suppliers.map((s) => s.name),
      products: products.map((p) => p.name),
      categories: categories.map((c) => c.name),
      brands: brands.map((b) => b.name),
      warehouses: (warehouses.filter(Boolean).length ? warehouses.filter(Boolean) : ["Main Warehouse", "Packing Store", "Chennai Depot"]).sort(),
      purchaseStatuses: purchaseStatuses.filter(Boolean).sort(),
      paymentStatuses: paymentStatuses.filter(Boolean).sort(),
    });
  })
);

app.get(
  "/api/reports/purchase-summary",
  asyncHandler(async (req, res) => {
    const { dateFrom, dateTo, supplier, product, category, brand, warehouse, purchaseStatus, paymentStatus } = req.query;

    let productNames = null;
    if (category || brand) {
      const productFilter = {};
      if (category) productFilter.category = category;
      if (brand) productFilter.brand = brand;
      const matchingProducts = await Item.find(productFilter).select("name");
      productNames = matchingProducts.map((p) => p.name);
    }
    const itemMatches = (itemProduct) => {
      if (product) return itemProduct === product;
      if (productNames) return productNames.includes(itemProduct);
      return true;
    };
    const hasProductFilter = Boolean(product || productNames);

    const dateFilter = {};
    if (dateFrom || dateTo) {
      dateFilter.createdAt = {};
      if (dateFrom) dateFilter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        dateFilter.createdAt.$lte = end;
      }
    }

    const poFilter = { ...dateFilter };
    if (supplier) poFilter.supplier = supplier;
    if (purchaseStatus) poFilter.status = purchaseStatus;

    const grFilter = { ...dateFilter };
    if (supplier) grFilter.supplier = supplier;
    if (warehouse) grFilter.warehouse = warehouse;

    const invFilter = { ...dateFilter };
    if (supplier) invFilter.supplier = supplier;
    if (paymentStatus) invFilter.status = paymentStatus;

    const [orders, receipts, invoices] = await Promise.all([
      PurchaseOrder.find(poFilter),
      GoodsReceipt.find(grFilter),
      PurchaseInvoice.find(invFilter),
    ]);

    const map = new Map();
    const getRow = (key) => {
      if (!map.has(key)) {
        map.set(key, {
          supplier: key,
          orders: 0,
          orderedQty: 0,
          purchaseValue: 0,
          receivedQty: 0,
          rejectedQty: 0,
          paid: 0,
          outstanding: 0,
        });
      }
      return map.get(key);
    };

    orders.forEach((po) => {
      const items = (po.items || []).filter((i) => itemMatches(i.product));
      if (hasProductFilter && items.length === 0) return;
      const row = getRow(po.supplier);
      row.orders += 1;
      items.forEach((i) => {
        row.orderedQty += i.quantity || 0;
        row.purchaseValue += i.amount || 0;
      });
    });

    receipts.forEach((gr) => {
      const items = (gr.items || []).filter((i) => itemMatches(i.product));
      if (hasProductFilter && items.length === 0) return;
      const row = getRow(gr.supplier);
      items.forEach((i) => {
        row.receivedQty += i.receivedQty || 0;
        row.rejectedQty += i.rejectedQty || 0;
      });
    });

    invoices.forEach((inv) => {
      const items = inv.items || [];
      const anyMatch = !hasProductFilter || items.some((i) => itemMatches(i.product));
      if (!anyMatch) return;
      const row = getRow(inv.supplier);
      row.paid += inv.paidAmount || 0;
      row.outstanding += (inv.amount || 0) - (inv.paidAmount || 0);
    });

    const rows = Array.from(map.values())
      .map((r) => ({
        ...r,
        deliveryRate: r.orderedQty > 0 ? Math.round((r.receivedQty / r.orderedQty) * 100) : 0,
      }))
      .sort((a, b) => b.purchaseValue - a.purchaseValue);

    const totals = rows.reduce(
      (acc, r) => ({
        orders: acc.orders + r.orders,
        orderedQty: acc.orderedQty + r.orderedQty,
        purchaseValue: acc.purchaseValue + r.purchaseValue,
        receivedQty: acc.receivedQty + r.receivedQty,
        rejectedQty: acc.rejectedQty + r.rejectedQty,
        paid: acc.paid + r.paid,
        outstanding: acc.outstanding + r.outstanding,
      }),
      { orders: 0, orderedQty: 0, purchaseValue: 0, receivedQty: 0, rejectedQty: 0, paid: 0, outstanding: 0 }
    );

    res.json({ rows, totals });
  })
);

app.get(
  "/api/reports/purchase-summary/breakdown",
  asyncHandler(async (req, res) => {
    const { groupBy = "supplier", dateFrom, dateTo, supplier, product, category, brand, warehouse, purchaseStatus, paymentStatus } = req.query;

    let productNames = null;
    if (category || brand) {
      const productFilter = {};
      if (category) productFilter.category = category;
      if (brand) productFilter.brand = brand;
      const matchingProducts = await Item.find(productFilter).select("name");
      productNames = matchingProducts.map((p) => p.name);
    }
    const itemMatches = (itemProduct) => {
      if (product) return itemProduct === product;
      if (productNames) return productNames.includes(itemProduct);
      return true;
    };
    const hasProductFilter = Boolean(product || productNames);

    const dateFilter = {};
    if (dateFrom || dateTo) {
      dateFilter.createdAt = {};
      if (dateFrom) dateFilter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        dateFilter.createdAt.$lte = end;
      }
    }

    const poFilter = { ...dateFilter };
    if (supplier) poFilter.supplier = supplier;
    if (purchaseStatus) poFilter.status = purchaseStatus;

    const grFilter = { ...dateFilter };
    if (supplier) grFilter.supplier = supplier;
    if (warehouse) grFilter.warehouse = warehouse;

    const invFilter = { ...dateFilter };
    if (supplier) invFilter.supplier = supplier;
    if (paymentStatus) invFilter.status = paymentStatus;

    const retFilter = { ...dateFilter };
    if (supplier) retFilter.supplier = supplier;

    const [orders, receipts, invoices, returns] = await Promise.all([
      PurchaseOrder.find(poFilter),
      GoodsReceipt.find(grFilter),
      PurchaseInvoice.find(invFilter),
      PurchaseReturn.find(retFilter),
    ]);

    const itemsSummary = (items, key = "product") => {
      if (!items || items.length === 0) return "—";
      return items.map((i) => i[key]).filter(Boolean).join(", ");
    };

    if (groupBy === "month") {
      const monthLabel = (d) => new Date(d).toLocaleString("en-US", { month: "short", year: "numeric" });
      const map = new Map();
      const getRow = (key) => {
        if (!map.has(key)) {
          map.set(key, { month: key, poCount: 0, grnCount: 0, invoiceCount: 0, grossPurchase: 0, returns: 0, paid: 0, payable: 0 });
        }
        return map.get(key);
      };
      orders.forEach((po) => {
        const items = (po.items || []).filter((i) => itemMatches(i.product));
        if (hasProductFilter && items.length === 0) return;
        getRow(monthLabel(po.createdAt)).poCount += 1;
      });
      receipts.forEach((gr) => {
        const items = (gr.items || []).filter((i) => itemMatches(i.product));
        if (hasProductFilter && items.length === 0) return;
        getRow(monthLabel(gr.createdAt)).grnCount += 1;
      });
      invoices.forEach((inv) => {
        const items = inv.items || [];
        const anyMatch = !hasProductFilter || items.some((i) => itemMatches(i.product));
        if (!anyMatch) return;
        const row = getRow(monthLabel(inv.createdAt));
        row.invoiceCount += 1;
        row.grossPurchase += inv.amount || 0;
        row.paid += inv.paidAmount || 0;
        row.payable += (inv.amount || 0) - (inv.paidAmount || 0);
      });
      returns.forEach((r) => {
        const items = (r.items || []).filter((i) => itemMatches(i.product));
        if (hasProductFilter && items.length === 0) return;
        getRow(monthLabel(r.createdAt)).returns += r.amount || 0;
      });
      const rows = Array.from(map.values())
        .map((r) => ({ ...r, netPurchase: r.grossPurchase - r.returns }))
        .sort((a, b) => new Date(a.month) - new Date(b.month));
      return res.json({ rows });
    }

    if (groupBy === "supplier") {
      const map = new Map();
      const getRow = (key) => {
        if (!map.has(key)) {
          map.set(key, { supplier: key, pos: 0, grns: 0, productSet: new Set(), purchaseQty: 0, grossPurchase: 0, returns: 0, paid: 0 });
        }
        return map.get(key);
      };
      orders.forEach((po) => {
        const items = (po.items || []).filter((i) => itemMatches(i.product));
        if (hasProductFilter && items.length === 0) return;
        const row = getRow(po.supplier);
        row.pos += 1;
        items.forEach((i) => {
          row.purchaseQty += i.quantity || 0;
          if (i.product) row.productSet.add(i.product);
        });
      });
      receipts.forEach((gr) => {
        const items = (gr.items || []).filter((i) => itemMatches(i.product));
        if (hasProductFilter && items.length === 0) return;
        getRow(gr.supplier).grns += 1;
      });
      invoices.forEach((inv) => {
        const items = inv.items || [];
        const anyMatch = !hasProductFilter || items.some((i) => itemMatches(i.product));
        if (!anyMatch) return;
        const row = getRow(inv.supplier);
        row.grossPurchase += inv.amount || 0;
        row.paid += inv.paidAmount || 0;
      });
      returns.forEach((r) => {
        const items = (r.items || []).filter((i) => itemMatches(i.product));
        if (hasProductFilter && items.length === 0) return;
        getRow(r.supplier).returns += r.amount || 0;
      });
      const rows = Array.from(map.values())
        .map((r) => ({
          supplier: r.supplier,
          pos: r.pos,
          grns: r.grns,
          products: r.productSet.size,
          purchaseQty: r.purchaseQty,
          grossPurchase: r.grossPurchase,
          returns: r.returns,
          netPurchase: r.grossPurchase - r.returns,
          paid: r.paid,
          payable: r.grossPurchase - r.paid,
        }))
        .sort((a, b) => b.grossPurchase - a.grossPurchase);
      return res.json({ rows });
    }

    if (groupBy === "product" || groupBy === "category" || groupBy === "brand") {
      const itemDocs = await Item.find();
      const productMap = new Map(itemDocs.map((p) => [p.name, p]));

      const map = new Map();
      const getRow = (key) => {
        if (!map.has(key)) {
          map.set(key, { product: key, qty: 0, purchaseValue: 0, returnQty: 0, returnValue: 0 });
        }
        return map.get(key);
      };
      orders.forEach((po) => {
        (po.items || []).forEach((i) => {
          if (!i.product || !itemMatches(i.product)) return;
          getRow(i.product).qty += i.quantity || 0;
        });
      });
      invoices.forEach((inv) => {
        (inv.items || []).forEach((i) => {
          if (!i.product || !itemMatches(i.product)) return;
          getRow(i.product).purchaseValue += i.amount || 0;
        });
      });
      returns.forEach((r) => {
        (r.items || []).forEach((i) => {
          if (!i.product || !itemMatches(i.product)) return;
          const row = getRow(i.product);
          row.returnQty += i.returnQty || 0;
          row.returnValue += (i.returnQty || 0) * (i.unitPrice || 0);
        });
      });

      const productRows = Array.from(map.values()).map((r) => {
        const p = productMap.get(r.product);
        return {
          productCode: (p && p.itemCode) || "—",
          product: r.product,
          category: (p && p.category) || "—",
          brand: (p && p.brand) || "—",
          unit: (p && p.unit) || "Nos",
          qty: r.qty,
          purchaseValue: r.purchaseValue,
          returnQty: r.returnQty,
          returnValue: r.returnValue,
          netPurchase: r.purchaseValue - r.returnValue,
        };
      });

      if (groupBy === "product") {
        productRows.sort((a, b) => b.purchaseValue - a.purchaseValue);
        return res.json({ rows: productRows });
      }

      const key = groupBy; // "category" | "brand"
      const rollup = new Map();
      productRows.forEach((r) => {
        const groupKey = r[key];
        if (!rollup.has(groupKey)) {
          rollup.set(groupKey, { [key]: groupKey, qty: 0, grossPurchase: 0, returns: 0 });
        }
        const row = rollup.get(groupKey);
        row.qty += r.qty;
        row.grossPurchase += r.purchaseValue;
        row.returns += r.returnValue;
      });

      const rows = await Promise.all(
        Array.from(rollup.values()).map(async (r) => ({
          [key]: r[key],
          products: await Item.countDocuments({ [key]: r[key] }),
          qty: r.qty,
          grossPurchase: r.grossPurchase,
          returns: r.returns,
          netPurchase: r.grossPurchase - r.returns,
        }))
      );
      rows.sort((a, b) => b.grossPurchase - a.grossPurchase);
      return res.json({ rows });
    }

    if (groupBy === "po") {
      const receivedByPo = new Map();
      receipts.forEach((gr) => {
        (gr.items || []).forEach((i) => {
          if (hasProductFilter && !itemMatches(i.product)) return;
          receivedByPo.set(gr.poNumber, (receivedByPo.get(gr.poNumber) || 0) + (i.receivedQty || 0));
        });
      });
      const rows = orders
        .map((po) => {
          const items = (po.items || []).filter((i) => itemMatches(i.product));
          if (hasProductFilter && items.length === 0) return null;
          const orderQty = items.reduce((a, i) => a + (i.quantity || 0), 0);
          const received = receivedByPo.get(po.id) || 0;
          return {
            poNo: po.id,
            date: po.orderDate || po.date,
            supplier: po.supplier,
            products: itemsSummary(items),
            orderQty,
            orderValue: po.amount,
            received,
            pending: Math.max(orderQty - received, 0),
            status: po.status,
            createdAt: po.createdAt,
          };
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.json({ rows });
    }

    if (groupBy === "gr") {
      const rows = [];
      receipts.forEach((gr) => {
        (gr.items || []).forEach((i) => {
          if (!i.product || !itemMatches(i.product)) return;
          rows.push({
            grnNo: gr.id,
            date: gr.date,
            poNo: gr.poNumber,
            supplier: gr.supplier,
            product: i.product,
            receivedQty: i.receivedQty || 0,
            accepted: (i.receivedQty || 0) - (i.rejectedQty || 0),
            rejected: i.rejectedQty || 0,
            warehouse: gr.warehouse,
            status: gr.status,
            createdAt: gr.createdAt,
          });
        });
      });
      rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.json({ rows });
    }

    if (groupBy === "invoice") {
      const rows = invoices
        .filter((inv) => !hasProductFilter || (inv.items || []).some((i) => itemMatches(i.product)))
        .map((inv) => ({
          invoiceNo: inv.id,
          date: inv.date,
          supplier: inv.supplier,
          poNo: inv.poNumber,
          grnNo: inv.grNumber,
          invoiceValue: inv.amount,
          paid: inv.paidAmount,
          payable: (inv.amount || 0) - (inv.paidAmount || 0),
          dueDate: inv.dueDate,
          status: inv.status,
          createdAt: inv.createdAt,
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.json({ rows });
    }

    if (groupBy === "return") {
      const rows = returns
        .filter((r) => !hasProductFilter || (r.items || []).some((i) => itemMatches(i.product)))
        .map((r) => ({
          returnNo: r.id,
          date: r.date,
          supplier: r.supplier,
          invoiceNumber: r.invoiceNumber,
          product: itemsSummary(r.items),
          returnQty: (r.items || []).reduce((a, i) => a + (i.returnQty || 0), 0),
          returnValue: r.amount,
          reason: r.reason,
          creditNote: r.creditNote,
          status: r.status,
          createdAt: r.createdAt,
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.json({ rows });
    }

    if (groupBy === "payables") {
      const FIXED_TODAY = new Date(2026, 7, 10);
      const weekAhead = new Date(FIXED_TODAY);
      weekAhead.setDate(weekAhead.getDate() + 7);

      const map = new Map();
      const getRow = (key) => {
        if (!map.has(key)) {
          map.set(key, { supplier: key, invoiceValue: 0, paid: 0, overdue: 0, dueThisWeek: 0 });
        }
        return map.get(key);
      };
      invoices.forEach((inv) => {
        const anyMatch = !hasProductFilter || (inv.items || []).some((i) => itemMatches(i.product));
        if (!anyMatch) return;
        const row = getRow(inv.supplier);
        row.invoiceValue += inv.amount || 0;
        row.paid += inv.paidAmount || 0;
        const balance = (inv.amount || 0) - (inv.paidAmount || 0);
        if (balance > 0) {
          const due = parseDateLabel(inv.dueDate);
          if (due) {
            if (due < FIXED_TODAY) row.overdue += balance;
            else if (due <= weekAhead) row.dueThisWeek += balance;
          }
        }
      });
      const rows = Array.from(map.values())
        .map((r) => {
          const outstanding = r.invoiceValue - r.paid;
          let status = "Paid";
          if (r.overdue > 0) status = "Overdue";
          else if (outstanding > 0) status = "Partial";
          return { ...r, outstanding, status };
        })
        .sort((a, b) => b.outstanding - a.outstanding);
      return res.json({ rows });
    }

    res.status(400).json({ message: "Invalid groupBy value." });
  })
);

// ---------- Reports: Inventory Valuation ----------
app.get(
  "/api/reports/inventory-valuation/filters",
  asyncHandler(async (req, res) => {
    const [warehouses, categories, brands, products, batches] = await Promise.all([
      Item.distinct("warehouse"),
      Category.find().sort({ name: 1 }).select("name"),
      Brand.find().sort({ name: 1 }).select("name"),
      Item.find().sort({ name: 1 }).select("name"),
      Item.distinct("batchNo"),
    ]);
    res.json({
      warehouses: warehouses.filter(Boolean).sort(),
      categories: categories.map((c) => c.name),
      brands: brands.map((b) => b.name),
      products: products.map((p) => p.name),
      batches: batches.filter(Boolean).sort(),
      units: ["Nos", "Pcs", "Box", "Kg", "Litre", "Set", "Roll", "Sheet"],
    });
  })
);

async function loadInventoryValuationRows(query) {
  const { asOnDate, warehouse, category, brand, product, stockStatus, batch, unit } = query;
  const itemFilter = {};
  if (warehouse) itemFilter.warehouse = warehouse;
  if (batch) itemFilter.batchNo = batch;
  if (unit) itemFilter.unit = unit;
  if (asOnDate) {
    const end = new Date(asOnDate);
    end.setHours(23, 59, 59, 999);
    itemFilter.createdAt = { $lte: end };
  }
  const items = await Item.find(itemFilter);

  let rows = items.map((i) => {
    const avgCost = i.purchasePrice || 0;
    const reorderLevel = i.minStockLevel || 50;
    const qty = i.qty || 0;
    let status = "Available";
    if (qty <= 0) status = "Out of Stock";
    else if (qty <= reorderLevel) status = "Low Stock";
    return {
      productCode: i.itemCode || "—",
      product: i.name,
      category: i.category || "—",
      brand: i.brand || "—",
      warehouse: i.warehouse || "Main Warehouse",
      batch: i.batchNo || "—",
      qty,
      unit: i.unit || "Nos",
      avgCost,
      stockValue: qty * avgCost,
      reserved: i.reserved || 0,
      damaged: i.damaged || 0,
      status,
    };
  });

  if (category) rows = rows.filter((r) => r.category === category);
  if (brand) rows = rows.filter((r) => r.brand === brand);
  if (product) rows = rows.filter((r) => r.product === product);
  if (stockStatus) rows = rows.filter((r) => r.status === stockStatus);

  return rows;
}

app.get(
  "/api/reports/inventory-valuation/summary",
  asyncHandler(async (req, res) => {
    const rows = await loadInventoryValuationRows(req.query);
    const totalProducts = new Set(rows.map((r) => r.product)).size;
    const totalStockQty = rows.reduce((a, r) => a + r.qty, 0);
    const reservedStock = rows.reduce((a, r) => a + r.reserved, 0);
    const damagedStock = rows.reduce((a, r) => a + r.damaged, 0);
    const availableStock = Math.max(totalStockQty - reservedStock - damagedStock, 0);
    const totalStockValue = rows.reduce((a, r) => a + r.stockValue, 0);
    const averageStockValue = totalProducts > 0 ? totalStockValue / totalProducts : 0;
    const warehouses = new Set(rows.map((r) => r.warehouse)).size;

    const { asOnDate, warehouse, category, brand, product } = req.query;
    const txnFilter = {};
    if (asOnDate) {
      const end = new Date(asOnDate);
      end.setHours(23, 59, 59, 999);
      txnFilter.createdAt = { $lte: end };
    }
    if (warehouse) txnFilter.warehouse = warehouse;
    const productMap = new Map((await Item.find()).map((p) => [p.name, p]));
    const txns = await StockTransaction.find(txnFilter);
    let stockInValue = 0;
    let stockOutValue = 0;
    let adjustmentValue = 0;
    txns.forEach((t) => {
      const p = productMap.get(t.product);
      if (category && (!p || p.category !== category)) return;
      if (brand && (!p || p.brand !== brand)) return;
      if (product && t.product !== product) return;
      const cost = (p && p.purchasePrice) || 0;
      const value = (t.quantity || 0) * cost;
      if (t.type === "In") stockInValue += value;
      else if (t.type === "Out") stockOutValue += value;
      else if (t.type === "Adjustment") adjustmentValue += value;
    });
    const currentStockValue = totalStockValue;
    const openingStockValue = currentStockValue - stockInValue + stockOutValue - adjustmentValue;

    res.json({
      kpis: { totalProducts, totalStockQty, availableStock, reservedStock, damagedStock, totalStockValue, averageStockValue, warehouses },
      stockValueCalc: { openingStockValue, stockInValue, stockOutValue, adjustmentValue, currentStockValue },
    });
  })
);

app.get(
  "/api/reports/inventory-valuation/breakdown",
  asyncHandler(async (req, res) => {
    const { groupBy = "overview" } = req.query;
    const rows = await loadInventoryValuationRows(req.query);

    if (groupBy === "overview") {
      return res.json({ rows });
    }

    if (groupBy === "batch") {
      const sorted = [...rows].sort((a, b) => (a.batch || "").localeCompare(b.batch || ""));
      return res.json({ rows: sorted });
    }

    if (groupBy === "product") {
      const map = new Map();
      rows.forEach((r) => {
        if (!map.has(r.product)) {
          map.set(r.product, { productCode: r.productCode, product: r.product, category: r.category, brand: r.brand, unit: r.unit, qty: 0, stockValue: 0 });
        }
        const row = map.get(r.product);
        row.qty += r.qty;
        row.stockValue += r.stockValue;
      });
      const out = Array.from(map.values()).sort((a, b) => b.stockValue - a.stockValue);
      return res.json({ rows: out });
    }

    if (groupBy === "category" || groupBy === "brand") {
      const key = groupBy;
      const map = new Map();
      rows.forEach((r) => {
        const k = r[key];
        if (!map.has(k)) map.set(k, { [key]: k, productSet: new Set(), qty: 0, stockValue: 0 });
        const row = map.get(k);
        row.qty += r.qty;
        row.stockValue += r.stockValue;
        row.productSet.add(r.product);
      });
      const out = Array.from(map.values())
        .map((r) => ({ [key]: r[key], products: r.productSet.size, qty: r.qty, stockValue: r.stockValue }))
        .sort((a, b) => b.stockValue - a.stockValue);
      return res.json({ rows: out });
    }

    if (groupBy === "warehouse") {
      const map = new Map();
      rows.forEach((r) => {
        if (!map.has(r.warehouse)) {
          map.set(r.warehouse, { warehouse: r.warehouse, productSet: new Set(), qty: 0, reserved: 0, damaged: 0, stockValue: 0 });
        }
        const row = map.get(r.warehouse);
        row.productSet.add(r.product);
        row.qty += r.qty;
        row.reserved += r.reserved;
        row.damaged += r.damaged;
        row.stockValue += r.stockValue;
      });
      const out = Array.from(map.values())
        .map((r) => ({
          warehouse: r.warehouse,
          products: r.productSet.size,
          quantity: r.qty,
          available: Math.max(r.qty - r.reserved - r.damaged, 0),
          reserved: r.reserved,
          damaged: r.damaged,
          stockValue: r.stockValue,
        }))
        .sort((a, b) => b.stockValue - a.stockValue);
      return res.json({ rows: out });
    }

    if (groupBy === "movement") {
      const { asOnDate, warehouse, category, brand, product } = req.query;
      const txnFilter = {};
      if (asOnDate) {
        const end = new Date(asOnDate);
        end.setHours(23, 59, 59, 999);
        txnFilter.createdAt = { $lte: end };
      }
      if (warehouse) txnFilter.warehouse = warehouse;
      const productMap = new Map((await Item.find()).map((p) => [p.name, p]));
      let txns = await StockTransaction.find(txnFilter).sort({ createdAt: -1 }).limit(200);
      txns = txns.filter((t) => {
        const p = productMap.get(t.product);
        if (category && (!p || p.category !== category)) return false;
        if (brand && (!p || p.brand !== brand)) return false;
        if (product && t.product !== product) return false;
        return true;
      });
      const out = txns.map((t) => {
        const p = productMap.get(t.product);
        const cost = (p && p.unitPrice) || 0;
        return {
          date: t.date,
          type: t.type,
          product: t.product,
          warehouse: t.warehouse,
          qty: t.quantity,
          unit: t.unit || "Nos",
          value: (t.quantity || 0) * cost,
        };
      });
      return res.json({ rows: out });
    }

    res.status(400).json({ message: "Invalid groupBy value." });
  })
);

// ---------- Reports: Low Stock Alert ----------
app.get(
  "/api/reports/low-stock/filters",
  asyncHandler(async (req, res) => {
    const [warehouses, categories, brands, products, suppliers] = await Promise.all([
      Item.distinct("warehouse"),
      Category.find().sort({ name: 1 }).select("name"),
      Brand.find().sort({ name: 1 }).select("name"),
      Item.find().sort({ name: 1 }).select("name"),
      Supplier.find().sort({ name: 1 }).select("name"),
    ]);
    res.json({
      warehouses: warehouses.filter(Boolean).sort(),
      categories: categories.map((c) => c.name),
      brands: brands.map((b) => b.name),
      products: products.map((p) => p.name),
      suppliers: suppliers.map((s) => s.name),
      criticalities: ["Critical", "High", "Medium", "Out of Stock"],
    });
  })
);

app.get(
  "/api/reports/low-stock",
  asyncHandler(async (req, res) => {
    const { warehouse, category, brand, product, stockStatus, supplier, criticality, asOnDate } = req.query;
    const itemFilter = {};
    if (warehouse) itemFilter.warehouse = warehouse;
    if (asOnDate) {
      const end = new Date(asOnDate);
      end.setHours(23, 59, 59, 999);
      itemFilter.createdAt = { $lte: end };
    }
    const [items, receipts] = await Promise.all([
      Item.find(itemFilter),
      GoodsReceipt.find().sort({ createdAt: -1 }),
    ]);

    const supplierByProduct = new Map();
    receipts.forEach((gr) => {
      (gr.items || []).forEach((i) => {
        if (i.product && !supplierByProduct.has(i.product)) {
          supplierByProduct.set(i.product, gr.supplier);
        }
      });
    });

    let rows = items
      .map((i) => {
        const avgCost = i.purchasePrice || 0;
        const reorderLevel = i.minStockLevel || 50;
        const minLevel = Math.round(reorderLevel * 0.6);
        const qty = i.qty || 0;
        let status = "Normal";
        if (qty <= 0) status = "Out of Stock";
        else if (qty < minLevel) status = "Critical";
        else if (qty < reorderLevel * 0.5) status = "High";
        else if (qty < reorderLevel) status = "Medium";
        const shortage = Math.max(reorderLevel - qty, 0);
        return {
          productCode: i.itemCode || "—",
          product: i.name,
          category: i.category || "—",
          brand: i.brand || "—",
          warehouse: i.warehouse || "Main Warehouse",
          currentStock: qty,
          minLevel,
          reorderLevel,
          shortage,
          supplier: supplierByProduct.get(i.name) || "—",
          status,
          reorderValue: shortage * avgCost,
        };
      })
      .filter((r) => r.status !== "Normal");

    if (category) rows = rows.filter((r) => r.category === category);
    if (brand) rows = rows.filter((r) => r.brand === brand);
    if (product) rows = rows.filter((r) => r.product === product);
    if (supplier) rows = rows.filter((r) => r.supplier === supplier);
    if (criticality) rows = rows.filter((r) => r.status === criticality);
    if (stockStatus) rows = rows.filter((r) => r.status === stockStatus);

    rows.sort((a, b) => b.shortage - a.shortage);

    const kpis = {
      totalLowStock: rows.length,
      critical: rows.filter((r) => r.status === "Critical").length,
      belowReorderLevel: rows.filter((r) => r.status === "High" || r.status === "Medium").length,
      outOfStock: rows.filter((r) => r.status === "Out of Stock").length,
      reorderRequired: rows.length,
      estimatedReorderValue: rows.reduce((a, r) => a + r.reorderValue, 0),
    };

    res.json({ rows, kpis });
  })
);

// ---------- Global Search ----------
app.get(
  "/api/search",
  asyncHandler(async (req, res) => {
    const q = (req.query.q || "").trim();
    if (q.length < 2) return res.json({ results: [] });
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    // Search must not become a way round the menus: only look in the areas
    // this caller's plan, add-ons and role actually let them open.
    const allowed = await moduleViewAccess(req, [
      "customers",
      "suppliers",
      "products",
      "sales:orders",
      "purchase:orders",
      "sales:invoices",
      "purchase:invoices",
    ]);
    const only = (key, query) => (allowed[key] ? query : Promise.resolve([]));

    const [customers, suppliers, items, salesOrders, purchaseOrders, salesInvoices, purchaseInvoices] = await Promise.all([
      only("customers", Customer.find({ $or: [{ name: regex }, { id: regex }, { email: regex }, { phone: regex }] }).limit(5)),
      only("suppliers", Supplier.find({ $or: [{ name: regex }, { id: regex }, { email: regex }, { phone: regex }] }).limit(5)),
      only("products", Item.find({ $or: [{ name: regex }, { itemCode: regex }] }).limit(5)),
      only("sales:orders", SalesOrder.find({ $or: [{ orderNo: regex }, { customer: regex }] }).limit(5)),
      only("purchase:orders", PurchaseOrder.find({ $or: [{ id: regex }, { supplier: regex }] }).limit(5)),
      only("sales:invoices", Invoice.find({ $or: [{ id: regex }, { customer: regex }] }).limit(5)),
      only("purchase:invoices", PurchaseInvoice.find({ $or: [{ id: regex }, { supplier: regex }] }).limit(5)),
    ]);

    const results = [
      ...customers.map((c) => ({ type: "Customer", label: c.name, sub: `${c.id} · ${c.phone || c.email || ""}`.replace(/ · $/, ""), path: "/customers" })),
      ...suppliers.map((s) => ({ type: "Supplier", label: s.name, sub: `${s.id} · ${s.phone || s.email || ""}`.replace(/ · $/, ""), path: "/suppliers" })),
      ...items.map((p) => ({ type: "Item", label: p.name, sub: p.itemCode, path: "/products/items" })),
      ...salesOrders.map((o) => ({ type: "Sales Order", label: o.orderNo, sub: o.customer, path: "/sales/orders" })),
      ...purchaseOrders.map((o) => ({ type: "Purchase Order", label: o.id, sub: o.supplier, path: "/purchase/orders" })),
      ...salesInvoices.map((i) => ({ type: "Sales Invoice", label: i.id, sub: i.customer, path: "/sales/invoices" })),
      ...purchaseInvoices.map((i) => ({ type: "Purchase Invoice", label: i.id, sub: i.supplier, path: "/purchase/invoices" })),
    ];

    res.json({ results });
  })
);

// ---------- Settings ----------
// Nothing secret leaves the server through the settings endpoint. The two
// password fields are write-only: the UI sends a new value or omits the key,
// and never receives the current one back.
function sanitizeSettings(doc) {
  const obj = doc.toJSON ? doc.toJSON() : { ...doc };
  delete obj.password;
  delete obj.adminPasswordHash;
  delete obj.smtpPassword;
  delete obj.waAccessToken;
  // So the WhatsApp settings screen can say "a token is saved" without being
  // told what it is.
  obj.waAccessTokenSet = Boolean(doc.waAccessToken);
  // So the Email settings screen can say "a password is saved" without
  // being told what it is.
  obj.smtpPasswordSet = Boolean(doc.smtpPassword);
  return obj;
}

// The invoice themes this client's plan unlocks, plus the theme and accent
// actually in force. Drives both the Invoice Theme settings screen and the
// picker on the print page, so neither has to know the tier rules.
app.get(
  "/api/invoice-themes",
  asyncHandler(async (req, res) => {
    const plan = await planForRequest(req);
    // No plan assigned (TechB's own admin panel, or a client not yet on a
    // plan) sees everything — same "unconfigured means unrestricted" rule
    // the menu gate uses.
    const tier = plan ? normaliseTier(plan.invoiceThemeTier) : "premium";
    // Tiers, labels and availability come from the Invoice Templates screen,
    // not straight from the code catalogue — a template moved between tiers
    // or withdrawn has to be reflected in what this client can pick.
    const registry = await getPlatformRegistry();
    const catalogue = resolveTemplates(registry.invoiceTemplates);
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});
    res.json({
      tier,
      planName: (plan && plan.name) || "",
      themes: catalogue,
      allowed: themeKeysForTier(tier, catalogue),
      canPickAccent: canPickAccent(tier),
      theme: resolveTheme(settings.invoiceTheme, tier, catalogue),
      accent: resolveAccent(settings.invoiceAccent, tier),
    });
  })
);

app.get(
  "/api/settings",
  asyncHandler(async (req, res) => {
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});
    // Company settings (logo/signature/seal base64) change rarely but are
    // pulled on nearly every page. A short private cache lets the browser
    // skip the round trip between navigations; a save updates the client
    // cache directly (see frontend api/client.js) so it never looks stale.
    res.set("Cache-Control", "private, max-age=60");
    res.json(sanitizeSettings(settings));
  })
);

app.put(
  "/api/settings",
  asyncHandler(async (req, res) => {
    const updates = { ...(req.body || {}) };
    const beforeSettings = await Settings.findOne();
    // A theme above this client's tier is refused outright rather than
    // quietly downgraded — otherwise the settings screen would appear to
    // save a premium theme and then print a basic one.
    //
    // Every settings screen (Company, Email, Tax, ...) shares this one
    // document and PUTs the whole loaded object back, so invoiceTheme/
    // invoiceAccent ride along on every save even when the user only
    // touched something unrelated like Company Name. Checking merely
    // `!== undefined` made ANY save 403 for a Basic-tier client, since
    // invoiceAccent is always present (its schema default is ""). Only
    // enforce the gate when the value is actually changing.
    const themeChanging = updates.invoiceTheme !== undefined && updates.invoiceTheme !== beforeSettings?.invoiceTheme;
    const accentChanging = updates.invoiceAccent !== undefined && updates.invoiceAccent !== beforeSettings?.invoiceAccent;
    if (themeChanging || accentChanging) {
      const plan = await planForRequest(req);
      const tier = plan ? normaliseTier(plan.invoiceThemeTier) : "premium";
      const registry = await getPlatformRegistry();
      const allowed = themeKeysForTier(tier, resolveTemplates(registry.invoiceTemplates));
      if (themeChanging && !allowed.includes(updates.invoiceTheme)) {
        return res.status(403).json({
          code: "PLAN_UPGRADE_REQUIRED",
          message: `The "${updates.invoiceTheme}" invoice theme is not included in the ${(plan && plan.name) || "current"} plan.`,
          theme: updates.invoiceTheme,
          tier,
        });
      }
      if (accentChanging && !canPickAccent(tier)) {
        return res.status(403).json({
          code: "PLAN_UPGRADE_REQUIRED",
          message: `Choosing an invoice colour is not included in the ${(plan && plan.name) || "current"} plan.`,
          tier,
        });
      }
    }
    if (updates.phone !== undefined) updates.phone = sanitizePhone(updates.phone);
    if (updates.username !== undefined && !updates.username.trim()) delete updates.username;
    // The built-in admin's password moved to /api/auth/change-password,
    // which verifies the current one first. Company Settings can no longer
    // set it, so a stolen session cannot silently change the password.
    delete updates.password;
    delete updates.adminPasswordHash;
    const settings = await Settings.findOneAndUpdate({}, { $set: updates }, { new: true, upsert: true });
    res.json(sanitizeSettings(settings));
    const passwordChanged = false;
    audit(req, {
      action: passwordChanged ? "Password Changed" : "Company Settings Changed",
      module: "Settings",
      entityType: "Settings",
      description: passwordChanged ? "Admin password changed" : "Company settings updated",
      before: passwordChanged ? undefined : beforeSettings,
      after: passwordChanged ? undefined : settings,
    });
  })
);

// ---------- WhatsApp (Meta Cloud API) ----------
const whatsapp = require("./services/whatsapp");

// Which menu a document type belongs to, so a user can only send documents
// from areas they may open.
const WHATSAPP_DOC_MODULES = {
  invoice: "sales",
  "delivery-challan": "sales",
  quotation: "sales",
  "sales-order": "sales",
  "purchase-order": "purchase",
};
const WHATSAPP_DOC_LABELS = {
  invoice: "Invoice",
  "delivery-challan": "Delivery Challan",
  quotation: "Quotation",
  "sales-order": "Sales Order",
  "purchase-order": "Purchase Order",
};

// Checks the saved credentials against Meta without sending anything.
app.post(
  "/api/whatsapp/test",
  asyncHandler(async (req, res) => {
    const role = (req.headers["x-user-role"] || "").trim();
    if (role && !isAdminRole(role)) return res.status(403).json({ message: "Only an administrator can test the WhatsApp connection." });
    const settings = (await Settings.findOne().lean()) || {};
    const result = await whatsapp.verifyConnection(settings);
    if (!result.ok) return res.status(400).json({ message: result.error });
    res.json(result);
  })
);

// Body: { to, documentType, documentId, partyName, amount, filename, pdfBase64 }
app.post(
  "/api/whatsapp/send-document",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const docType = String(body.documentType || "");
    const moduleKey = WHATSAPP_DOC_MODULES[docType];
    if (!moduleKey) return res.status(400).json({ message: "This kind of document can't be sent on WhatsApp." });

    const access = await moduleViewAccess(req, [moduleKey]);
    if (!access[moduleKey]) return res.status(403).json({ message: "You don't have access to send this document." });

    const settings = (await Settings.findOne().lean()) || {};
    if (!whatsapp.waConfigured(settings)) {
      return res.status(400).json({ message: "WhatsApp isn't set up. Ask an administrator to enable it in Settings → WhatsApp Settings." });
    }
    const phone = whatsapp.normalizePhone(body.to);
    if (!phone) return res.status(400).json({ message: "Enter a valid WhatsApp number with country code, e.g. 919876543210." });

    const b64 = String(body.pdfBase64 || "").replace(/^data:application\/pdf;base64,/, "");
    const pdf = Buffer.from(b64, "base64");
    if (pdf.length < 100 || pdf.slice(0, 4).toString() !== "%PDF") {
      return res.status(400).json({ message: "The document could not be prepared. Please try again." });
    }

    const label = WHATSAPP_DOC_LABELS[docType];
    const number = String(body.documentId || "").slice(0, 60);
    const filename = String(body.filename || `${docType}-${number}.pdf`).replace(/[^\w.\- ]+/g, "-").slice(0, 100);
    const amountText = body.amount != null && body.amount !== "" ? `₹${Number(body.amount).toLocaleString("en-IN")}` : "the amount due";

    const result = await whatsapp.sendDocument(settings, {
      to: phone,
      pdf,
      filename,
      params: [body.partyName || "Customer", `${label} ${number}`.trim(), amountText, settings.companyName || "our company"],
    });
    if (!result.ok) {
      audit(req, { action: "WhatsApp Failed", module: moduleForPath("/api/" + moduleKey), description: `${label} ${number} to ${whatsapp.maskPhone(phone)}: ${result.error}`, status: "Failed" });
      return res.status(502).json({ message: result.error });
    }
    audit(req, { action: "WhatsApp Sent", module: moduleForPath("/api/" + moduleKey), description: `${label} ${number} sent to ${whatsapp.maskPhone(phone)}` });
    res.json({ success: true, to: whatsapp.maskPhone(phone), messageId: result.messageId });
  })
);

// ---------- Backup & Restore ----------
// Fields that must never leave the server, even inside the client's own
// backup file: a backup gets emailed, dropped in shared drives and kept for
// years, so it must not carry anything that unlocks an account or a mailbox.
const BACKUP_SECRET_FIELDS = [
  "password",
  "passwordHash",
  "adminPasswordHash",
  "smtpPassword",
  "waAccessToken",
  "inviteTokenHash",
  "inviteExpiresAt",
  "invitePurpose",
];

function stripBackupSecrets(doc) {
  if (!doc) return doc;
  const copy = { ...doc };
  BACKUP_SECRET_FIELDS.forEach((f) => delete copy[f]);
  return copy;
}

app.get(
  "/api/backup/export",
  asyncHandler(async (req, res) => {
    const m = currentModels();
    // Every collection the app stores for this client, in one pass. .lean()
    // returns plain objects (no Mongoose overhead), which matters for a
    // client with years of records.
    const sources = {
      customers: Customer,
      customerGroups: CustomerGroup,
      suppliers: Supplier,
      supplierGroups: SupplierGroup,
      categories: Category,
      brands: Brand,
      warehouses: Warehouse,
      products: Product,
      items: Item,
      purchaseOrders: PurchaseOrder,
      goodsReceipts: GoodsReceipt,
      purchaseInvoices: PurchaseInvoice,
      purchaseReturns: PurchaseReturn,
      inventory: InventoryItem,
      stockTransactions: StockTransaction,
      salesOrders: SalesOrder,
      enquiries: Enquiry,
      quotations: Quotation,
      deliveryChallans: DeliveryChallan,
      invoices: Invoice,
      salesReturns: SalesReturn,
      maintenance: MaintenanceTask,
      boms: m.Bom,
      workCenters: m.WorkCenter,
      machines: m.Machine,
      workOrders: m.WorkOrder,
      jobCards: m.JobCard,
      materialIssues: m.MaterialIssue,
      productionReceipts: m.ProductionReceipt,
      users: User,
      roles: Role,
      ledgerEntries: LedgerEntry,
    };
    const names = Object.keys(sources);
    const [lists, settings] = await Promise.all([
      Promise.all(names.map((n) => sources[n].find({}, { _id: 0, __v: 0 }).lean())),
      Settings.findOne({}, { _id: 0, __v: 0 }).lean(),
    ]);

    const data = {};
    const counts = {};
    names.forEach((n, i) => {
      data[n] = n === "users" ? lists[i].map(stripBackupSecrets) : lists[i];
      counts[n] = lists[i].length;
    });

    const backup = {
      format: "siperp-backup",
      version: 2,
      exportedAt: new Date().toISOString(),
      company: (settings && settings.companyName) || "",
      // What is deliberately NOT in this file: sign-in secrets (users must
      // set a password again after a restore), and the activity log.
      note: "Passwords, password hashes and mail-server passwords are excluded on purpose.",
      counts,
      ...data,
      settings: stripBackupSecrets(settings),
    };

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    res.setHeader("Content-Disposition", `attachment; filename="siperp-backup-${stamp}.json"`);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.send(JSON.stringify(backup));
    audit(req, { action: "Export", module: "Settings", description: "Full data backup exported" });
  })
);

// ---------- AI assistant (Tier 1): NL search, reminders, invoice notes ----------
// Runs after the tenant middleware, so its model access is scoped per client.
// Each AI call spends the platform's Anthropic credit, so one client cannot
// use it without limit. Reading the on/off status is free and unlimited.
const aiLimit = requestLimit({
  keyFor: (req) => String(req.headers["x-tenant"] || "default"),
  max: 60,
  windowMs: 10 * 60 * 1000,
  message: "The AI assistant is being used a lot right now. Please wait a few minutes and try again.",
});
app.use("/api/ai", (req, res, next) => (req.method === "POST" ? aiLimit(req, res, next) : next()));
registerAiRoutes(app);

// ---------- Subscription status (always reachable — see the exempt list) ----------
function subscriptionStatusPayload(req) {
  const s = req.subscription || { state: "none" };
  return {
    state: s.state,
    planName: s.planName || "",
    subscriptionEnd: s.subscriptionEnd || null,
    daysRemaining: s.daysRemaining === undefined ? null : s.daysRemaining,
    companyName: s.companyName || "",
    message: isBlocked(s) ? blockedMessage(s) : "",
  };
}

app.get("/api/subscription/status", (req, res) => {
  res.json(subscriptionStatusPayload(req));
});

// The client-facing "My Subscription" page: everything status doesn't carry
// (price, term, renewal date, what the plan includes) so nothing new is
// computed here — it's the same tenant snapshot and Plan doc every other
// gate already reads, just handed back in one place a client can look at.
app.get(
  "/api/subscription/details",
  asyncHandler(async (req, res) => {
    const s = req.subscription || { state: "none" };
    const t = req._tenant || {};
    const plan = await planForRequest(req);
    // Add-ons and core modules grant menus the plan itself does not, so the
    // "what am I paying for" page has to account for them or it will tell a
    // client they lack a menu they can plainly see in their own sidebar.
    const registry = await getPlatformRegistry();
    const { core } = moduleRegistryIndex(registry.modules);
    const heldAddOns = (registry.addOns || []).filter((a) => (t.addOns || []).includes(a.code));
    const extraMenus = [...addOnModulesFor(t, registry.addOns), ...core];
    // Billing fields are read from the Tenant row, not the live Plan doc —
    // they're a snapshot of what this client actually agreed to (see the
    // comment on models/Tenant.js). The Plan doc only supplies what it
    // *unlocks* (menus, invoice themes), which is meant to always reflect
    // the plan as currently configured.
    const tier = plan ? normaliseTier(plan.invoiceThemeTier) : "premium";
    // Same resolved catalogue the picker uses, so "3 of 10 templates" here
    // never disagrees with what the Invoice Theme screen actually offers.
    const templateCatalogue = resolveTemplates(registry.invoiceTemplates);
    const unlockedThemes = themeKeysForTier(tier, templateCatalogue);
    res.json({
      state: s.state,
      companyName: s.companyName || "",
      message: isBlocked(s) ? blockedMessage(s) : "",

      planName: t.planName || s.planName || "",
      planCode: t.planCode || "",
      price: t.price || 0,
      currency: (plan && plan.currency) || "INR",
      termMonths: t.termMonths || 12,
      discountPercent: t.discountPercent || 0,
      amountPayable: t.amountPayable || 0,
      billingCycle: t.billingCycle || (plan && plan.billingCycle) || "Monthly",
      subscriptionStart: t.subscriptionStart || null,
      subscriptionEnd: t.subscriptionEnd || null,
      daysRemaining: s.daysRemaining === undefined ? null : s.daysRemaining,
      graceDays: t.graceDays || 0,

      maxUsers: (plan && plan.maxUsers) || 0,
      description: (plan && plan.description) || "",
      features: (plan && plan.features) || [],

      // Add-ons bought on top of the plan, so the page can show them as
      // separate line items rather than folding them into the plan price.
      addOns: heldAddOns.map((a) => ({
        code: a.code,
        name: a.name,
        description: a.description || "",
        price: a.price || 0,
        billingCycle: a.billingCycle || "Monthly",
        maxUsersBonus: a.maxUsersBonus || 0,
      })),

      // Empty `modules` on the plan means no restriction — every menu is
      // included. planMenuSummary() already encodes that (every row comes
      // back "full"), so the page never needs its own copy of that rule.
      menus: planMenuSummary(plan, extraMenus),

      invoiceThemes: {
        tier,
        canPickAccent: canPickAccent(tier),
        unlockedCount: unlockedThemes.length,
        totalCount: templateCatalogue.length,
        unlocked: templateCatalogue.filter((th) => unlockedThemes.includes(th.key)),
      },
    });
  })
);

// ---------- Self-service plan upgrade (client-initiated, paid via Razorpay) ----------
//
// Deliberately UPGRADE-only: a client may only pay their way onto a plan
// priced higher (per month) than what they're on. Downgrading, discounts and
// custom pricing stay admin-only, in Manage Clients — this is a checkout
// flow, not a general plan editor.
//
// Policy this implements (stated here because it's a decision with money
// attached, not just code): paying for an upgrade REPLACES the current plan
// and starts a brand new term from today — subscriptionStart = now,
// subscriptionEnd = now + termMonths, no proration of whatever time was left
// on the old plan, and no discount (discountPercent is an admin-negotiated
// field; self-checkout always pays the plan's list price). If that's not the
// policy you want, this is the one place to change it.

// Same clamped month-addition ClientForm.jsx uses (31 Jan + 1mo -> 28/29 Feb,
// not into March) — kept in sync by hand since one lives in the browser and
// one on the server.
function addMonthsClamped(date, months) {
  const day = date.getDate();
  const end = new Date(date.getFullYear(), date.getMonth() + Number(months), 1);
  const lastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  end.setDate(Math.min(day, lastDay));
  return end;
}

// What a client may buy: every active plan, with enough info to render the
// picker and know which ones actually count as an upgrade. Always reachable
// (not menu/plan gated) for the same reason /api/subscription/details is —
// picking a plan can't depend on already having one.
app.get(
  "/api/subscription/upgrade-options",
  asyncHandler(async (req, res) => {
    let t = req._tenant || {};
    if (!t.subdomain) {
      const Tenant = getTenantRegistryModel();
      t = (await Tenant.findOne({ databaseName: DEFAULT_DB_NAME }).lean()) || {};
    }
    const currentPrice = Number(t.price) || 0;
    const plans = await getPlanModel().find({ status: "active" }).sort({ price: 1 }).lean();
    res.json({
      configured: await razorpay.isConfigured(),
      currentPlanCode: t.planCode || "",
      currentPrice,
      termMonths: TERM_MONTHS,
      plans: plans.map((p) => ({
        code: p.code,
        name: p.name,
        price: p.price,
        currency: p.currency || "INR",
        description: p.description || "",
        features: p.features || [],
        maxUsers: p.maxUsers || 0,
        isCurrent: p.code === t.planCode,
        isUpgrade: p.price > currentPrice,
      })),
    });
  })
);

app.post(
  "/api/subscription/upgrade/order",
  asyncHandler(async (req, res) => {
    // Changing the plan commits the business to a payment.
    // Allow any authenticated user session or administrator.
    const userRole = (req.headers["x-user-role"] || (req._session && req._session.role) || "").trim();
    if (!req._session && !isAdminRole(userRole)) {
      return res.status(403).json({ message: "Please log in to upgrade or top up your plan." });
    }
    let t = req._tenant || {};
    if (!t.subdomain) {
      const Tenant = getTenantRegistryModel();
      t = (await Tenant.findOne({ databaseName: DEFAULT_DB_NAME }).lean()) || {};
    }
    if (!t.subdomain) {
      return res.status(400).json({ message: "No client account found for this request." });
    }
    const planCode = String((req.body && req.body.planCode) || "").trim();
    const termMonths = Number(req.body && req.body.termMonths);
    if (!TERM_MONTHS.includes(termMonths)) {
      return res.status(400).json({ message: `Term must be one of ${TERM_MONTHS.join(", ")} months.` });
    }
    const plan = await getPlanModel().findOne({ code: planCode, status: "active" }).lean();
    if (!plan) return res.status(404).json({ message: "That plan is not available." });
    if ((plan.currency || "INR") !== "INR") {
      // Razorpay's amount unit depends on currency (paise vs cents, etc.) —
      // every plan today is INR, so this is a real limit, not a TODO.
      return res.status(400).json({ message: "Online checkout currently supports INR plans only." });
    }
    const currentPrice = Number(t.price) || 0;
    const isRenewal = Boolean(t.planCode && plan.code === t.planCode);
    if (t.planCode && !isRenewal && plan.price < currentPrice) {
      return res.status(400).json({
        message: "To downgrade your plan, please contact TechB Software Solutions.",
      });
    }

    const amountPayable = Math.round(plan.price * termMonths); // list price, no discount
    const SubscriptionOrder = getSubscriptionOrderModel();
    const order = await SubscriptionOrder.create({
      tenantSubdomain: t.subdomain,
      companyName: t.companyName || "",
      planCode: plan.code,
      planName: plan.name,
      price: plan.price,
      termMonths,
      amountPayable,
      currency: "INR",
      status: "created",
    });

    let gatewayOrder;
    try {
      gatewayOrder = await razorpay.createOrder({
        amount: amountPayable * 100, // paise
        currency: "INR",
        receipt: String(order._id),
        notes: {
          tenantSubdomain: t.subdomain,
          planCode: plan.code,
          termMonths: String(termMonths),
          action: isRenewal ? "renewal" : "upgrade",
        },
      });
    } catch (err) {
      order.status = "failed";
      order.errorMessage = err.message || "Razorpay order creation failed.";
      await order.save();
      const status = err.status || 502;
      return res.status(status).json({ code: "PAYMENTS_NOT_CONFIGURED", message: order.errorMessage });
    }

    order.gatewayOrderId = gatewayOrder.id;
    await order.save();

    res.json({
      localOrderId: String(order._id),
      razorpayOrderId: gatewayOrder.id,
      amount: amountPayable,
      currency: "INR",
      keyId: await razorpay.getPublicKeyId(),
      companyName: t.companyName || "",
      planName: plan.name,
      termMonths,
      isRenewal,
    });
  })
);

app.post(
  "/api/subscription/upgrade/verify",
  asyncHandler(async (req, res) => {
    const { localOrderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!localOrderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing payment confirmation details." });
    }

    const userRole = (req.headers["x-user-role"] || (req._session && req._session.role) || "").trim();
    if (!req._session && !isAdminRole(userRole)) {
      return res.status(403).json({ message: "Please log in to confirm a plan payment." });
    }

    const SubscriptionOrder = getSubscriptionOrderModel();
    const order = await SubscriptionOrder.findById(localOrderId);
    if (!order) return res.status(404).json({ message: "Order not found." });
    // An order can only be confirmed by the client it was raised for.
    const activeSubdomain = (req._tenant && req._tenant.subdomain) || "crm";
    if (order.tenantSubdomain !== activeSubdomain) {
      return res.status(404).json({ message: "Order not found." });
    }
    if (order.status === "paid") {
      // Already confirmed (e.g. a retried callback) — answer the same way
      // without charging or updating anything a second time.
      return res.json({ success: true, planName: order.planName });
    }
    if (order.gatewayOrderId !== razorpay_order_id) {
      return res.status(400).json({ message: "This confirmation doesn't match the order it was created for." });
    }

    const valid = await razorpay.verifyPaymentSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });
    if (!valid) {
      order.status = "failed";
      order.errorMessage = "Signature verification failed.";
      await order.save();
      return res.status(400).json({ message: "Payment could not be verified. No charge has been applied to your account." });
    }

    order.status = "paid";
    order.gatewayPaymentId = razorpay_payment_id;
    order.gatewaySignature = razorpay_signature;
    await order.save();

    const Tenant = getTenantRegistryModel();
    const before = await Tenant.findOne({ subdomain: order.tenantSubdomain }).lean();
    const now = new Date();
    // If renewing the current active plan, extend from current subscriptionEnd, otherwise start from now
    const isRenewal = before && before.planCode === order.planCode && before.subscriptionEnd && new Date(before.subscriptionEnd) > now;
    const startDate = isRenewal ? new Date(before.subscriptionEnd) : now;
    const subscriptionEnd = addMonthsClamped(startDate, order.termMonths);

    const tenantUpdates = {
      planCode: order.planCode,
      planName: order.planName,
      price: order.price,
      termMonths: order.termMonths,
      discountPercent: 0,
      amountPayable: order.amountPayable,
      billingCycle: "Monthly",
      subscriptionStart: before && before.subscriptionStart && isRenewal ? before.subscriptionStart : now,
      subscriptionEnd,
    };
    const tenant = await Tenant.findOneAndUpdate(
      { subdomain: order.tenantSubdomain },
      { $set: tenantUpdates },
      { new: true }
    );
    invalidateRegistryCache(order.tenantSubdomain);
    invalidatePlanCache();

    audit(req, {
      action: isRenewal ? "Plan Renewed / Topped Up" : "Plan Upgraded",
      module: "Settings",
      entityType: "Subscription",
      entityId: order.tenantSubdomain,
      description: `Self-service ${isRenewal ? "renewal/top-up" : "upgrade"} of ${order.planName} (${order.termMonths} mo) — ₹${order.amountPayable}, paid via Razorpay.`,
      before,
      after: tenant,
    });

    res.json({ success: true, planName: order.planName, subscriptionEnd: tenant.subscriptionEnd, isRenewal: Boolean(isRenewal) });
  })
);

// ---------- Reminders ----------
// Computed live from the tenant's own data — nothing stored, nothing to
// schedule. Powers both the topbar bell and the Reminders screen.
app.get(
  "/api/reminders",
  asyncHandler(async (req, res) => {
    const settings = (await Settings.findOne().lean()) || {};
    const dueSoonDays = Number(settings.reminderDueSoonDays) || 7;
    // Which notifications the platform has switched on, and any announcement
    // aimed at this client. Both come from the same cached registry the rest
    // of the app reads, so the bell costs no extra round trip.
    const registry = await getPlatformRegistry();
    const rules = notificationRules(registry.notificationTypes, dueSoonDays);
    const extraItems = announcementItems(registry.announcements, req._tenant);
    res.json(await buildReminders(currentModels(), { dueSoonDays, rules, extraItems }));
  })
);

app.get(
  "/api/permissions/catalogue",
  asyncHandler(async (req, res) => {
    const registry = await getPlatformRegistry();
    res.json({
      // Flat, parents only — what the Roles matrix draws its rows from. Roles
      // stay menu-level, and a grant on a parent covers its sub-pages.
      //
      // `actions` per module comes from the Global Permissions registry, so
      // the matrix draws a checkbox only where the action is actually on
      // offer — no more four cells for a menu that only ever reads.
      modules: MODULES.map(({ key, label }) => ({
        key,
        label,
        actions: actionsForModule(registry.permissions, key),
      })),
      // The same menus with their sub-pages, for the plan's menu-access picker.
      menuTree: MODULES.map(({ key, label, children }) => ({
        key,
        label,
        children: (children || []).map((c) => ({ key: c.key, label: c.label })),
      })),
      // Every action the platform knows about, and the one that is never
      // withheld — the matrix shows that column locked rather than missing.
      actions: ACTIONS,
      alwaysAllowed: ALWAYS_ALLOWED_ACTION,
    });
  })
);

// How customers may pay, as configured in Payment Methods. Drives the
// invoice form's dropdown and tells it which methods need a reference
// recorded alongside them.
app.get(
  "/api/payment-methods",
  asyncHandler(async (req, res) => {
    const registry = await getPlatformRegistry();
    res.json({ methods: resolvePaymentMethods(registry.paymentMethods) });
  })
);

function themePayload(registry, req) {
  const theme = themeForTenant(registry.themes, req._tenant);
  return {
    code: theme.code,
    name: theme.name,
    sidebar: theme.sidebar,
    sidebarActive: theme.sidebarActive,
    sidebarText: theme.sidebarText,
    primary: theme.primary,
    radius: theme.radius,
    modes: theme.modes,
    defaultMode: theme.defaultMode,
  };
}

// The colours this client's app is painted with, from Theme Management.
// Answered for anyone who can reach the app at all — it has to be, because
// the login screen is painted with it too, before there is a user to check.
// It carries no client data, only the brand.
app.get(
  "/api/theme",
  asyncHandler(async (req, res) => {
    const registry = await getPlatformRegistry();
    // Brand colours change rarely: let the browser reuse them (and refresh in
    // the background) instead of asking on every page load. Vary keeps one
    // client's answer from being reused for another on the shared API host.
    res.set("Cache-Control", "private, max-age=60, stale-while-revalidate=600");
    res.set("Vary", "X-Tenant, Authorization");
    res.json(themePayload(registry, req));
  })
);

// The sidebar's labels, icons, order and visibility, as configured in Menu
// Management. Presentation only — what a user may actually REACH is decided
// by /api/me/permissions and enforced route by route, so a menu hidden here
// is a tidier sidebar, never a security boundary.
app.get(
  "/api/menu",
  asyncHandler(async (req, res) => {
    const registry = await getPlatformRegistry();
    res.set("Cache-Control", "private, max-age=60, stale-while-revalidate=600");
    res.set("Vary", "X-Tenant, Authorization");
    res.json({ menu: resolveMenu(registry.menus) });
  })
);

// What the signed-in user may see and do — shared by /api/me/permissions and
// /api/bootstrap so the two can never disagree.
async function buildMyPermissions(req) {
  {
    const roleName = (req.headers["x-user-role"] || "").trim();
    const admin = isAdminRole(roleName);
    const plan = await planForRequest(req);
    const registry = await getPlatformRegistry();
    const { disabled, core } = moduleRegistryIndex(registry.modules);
    const roles = await rolesForRequest(req);
    const roleDoc = roles.find((r) => String(r.name).toLowerCase() === roleName.toLowerCase());
    // No roles configured behaves the same here as in the middleware: the
    // UI must not start hiding menus before anyone has set permissions up.
    const unconfigured = roles.length === 0;
    return {
      role: roleName,
      isAdmin: admin,
      unconfigured,
      permissions: admin || unconfigured ? allPermissions() : (roleDoc && roleDoc.permissions) || [],
      // Empty array means the plan places no restriction.
      planModules: (plan && Array.isArray(plan.modules) && plan.modules) || [],
      planName: (plan && plan.name) || "",
      // The client's own menu override, applied on top of the plan. Empty
      // means no client-level restriction. The sidebar intersects the two.
      clientModules: (req._tenant && Array.isArray(req._tenant.modules) && req._tenant.modules) || [],
      // Menus granted by add-ons bought on top of the plan. These are UNIONED
      // with the plan before the client override narrows it — the one way a
      // client reaches past what their plan includes.
      addOnModules: addOnModulesFor(req._tenant, registry.addOns),
      // Always-on menus, and menus withdrawn platform-wide. Both are keyed on
      // top-level modules and cover their sub-pages.
      coreModules: [...core],
      disabledModules: [...disabled],
    };
  }
}

app.get(
  "/api/me/permissions",
  asyncHandler(async (req, res) => res.json(await buildMyPermissions(req)))
);

// The small, always-needed startup data in ONE request: theme, menu,
// permissions and subscription status. The app used to fetch these as four
// separate calls (each paying its own network round trip and its own login
// check); the frontend now asks once and unpacks the answers by URL.
app.get(
  "/api/bootstrap",
  asyncHandler(async (req, res) => {
    const registry = await getPlatformRegistry();
    const [permissions] = await Promise.all([buildMyPermissions(req)]);
    res.set("Cache-Control", "no-cache");
    res.json({
      "/api/theme": themePayload(registry, req),
      "/api/menu": { menu: resolveMenu(registry.menus) },
      "/api/me/permissions": permissions,
      "/api/subscription/status": subscriptionStatusPayload(req),
    });
  })
);

// ---------- Health ----------
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// ---------- Error handler ----------
app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  let status = err.status || err.statusCode || 500;
  let message =
    err.type === "entity.too.large"
      ? "That file is too large. Please upload an image under 8MB."
      : err.message || "Internal server error";

  // A duplicate key or a failed validation is the caller's problem, and its
  // wording is meant to be read.
  if (err && err.code === 11000) {
    status = 409;
    message = "That record already exists.";
  } else if (err && err.name === "ValidationError") {
    status = 400;
  } else if (status >= 500 && /^(Mongo|Mongoose|CastError|TypeError|ReferenceError|RangeError|SyntaxError)/.test(err.name || "")) {
    // Database and programming errors carry internals (collection names,
    // file paths, stack fragments). They are logged above; the browser gets
    // a plain sentence instead.
    message = "Something went wrong on our side. Please try again.";
  }
  res.status(status).json({ message });
});

// A forgotten .catch() in a background task should be logged, not take the
// whole API down for every client.
process.on("unhandledRejection", (reason) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled promise rejection:", reason);
});

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(` http://localhost:${PORT}`);
      // Diagnostic build marker — if this line does NOT show up in your
      // terminal on startup, the process you're running is not loading this
      // file, no matter what "npm run dev" appears to do. Safe to delete
      // once the invoice address/phone issue is confirmed fixed.
      console.log(" [build-marker] connected to database successfully");
    });
  })
  .catch((err) => {
    console.error("✗ Failed to connect to MongoDB:", err.message);
    // Never log the password that is embedded in the connection string.
    console.error(`  Make sure MongoDB is running and reachable at: ${String(MONGODB_URI).replace(/\/\/[^@/]*@/, "//***@")}`);
    console.error("  See backend/.env — set MONGODB_URI to your local MongoDB or a MongoDB Atlas connection string.");
    process.exit(1);
  });
