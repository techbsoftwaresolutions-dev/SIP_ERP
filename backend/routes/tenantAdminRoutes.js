// Dynamic client (tenant) management — lets "Manage Clients" on the
// frontend create/edit/remove rows in the master tenant registry without
// ever touching code or redeploying. Every route here is gated by the
// X-Master-Key header (must match MASTER_ADMIN_KEY in .env) — these routes
// can reroute ANY client's data to a different database, so they're kept
// separate from, and more locked-down than, the regular per-tenant API.
const express = require("express");
const crypto = require("crypto");
const {
  getTenantRegistryModel,
  getPlanModel,
  getModuleModel,
  getAddOnModel,
  getGlobalRoleModel,
  getGlobalPermissionModel,
  getMenuItemModel,
  getThemeModel,
  getInvoiceTemplateModel,
  getPaymentMethodModel,
  getApprovalRuleModel,
  getNotificationTypeModel,
  getAnnouncementModel,
  getAdminAuditLogModel,
  getDemoRequestModel,
  bindModelsForDb,
  getPlatformRegistry,
  invalidatePlatformRegistry,
  invalidateRegistryCache,
  DEFAULT_DB_NAME,
} = require("../tenancy/tenantModels");

const { resolveSession, tokenFromRequest } = require("../auth/superAdminAuth");
const clientAuth = require("../auth/clientAuth");

// Sets the password of a client's built-in admin account (the one that signs
// in with the Company Settings credentials) directly in THAT client's database.
// Stored hashed, and the legacy plain-text field is cleared, so the old
// default can never be used to get in.
async function setClientAdminPassword(databaseName, password) {
  const { Settings } = bindModelsForDb(databaseName);
  await Settings.findOneAndUpdate(
    {},
    { $set: { adminPasswordHash: clientAuth.hashPassword(password), password: "" } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}
const {
  ACTIONS,
  MODULES,
  ALL_MENU_KEYS,
  allPermissions,
  moduleSeedRows,
  globalRoleSeedRows,
  permissionSeedRows,
  ALWAYS_ALLOWED_ACTION,
  actionsForModule,
} = require("../auth/permissions");
const {
  TIERS,
  THEMES,
  normaliseTier,
  templateSeedRows,
  resolveTemplates,
} = require("../catalogues/invoiceThemes");
const { paymentSeedRows } = require("../catalogues/paymentCatalogue");
const {
  DOCUMENT_TYPES,
  CONDITIONS,
  APPLIES_TO,
  isValidDocumentType,
} = require("../services/approvalEngine");
const { adminAuditMiddleware } = require("../middleware/adminAudit");
const {
  SEVERITIES,
  AUDIENCES,
  resolveNotificationTypes,
} = require("../catalogues/notificationCatalogue");
const { MENU_ICONS, resolveMenu } = require("../catalogues/menuCatalogue");
const { MODES, STARTER_THEMES, normalizeThemeBody, reconcileModes } = require("../catalogues/themeCatalogue");

const BILLING_CYCLES = ["Monthly", "Quarterly", "Yearly"];

// Subscription terms a client can buy, in months. Plan prices are a monthly
// rate, so the term is simply a multiplier.
const TERM_MONTHS = [1, 3, 6, 12, 24, 36];
const DEFAULT_TERM_MONTHS = 12;

// Inserted the first time the Plans collection is read and found empty, so the
// Manage Plans screen isn't a blank slate. Fully editable/deletable afterwards.
const STARTER_PLANS = [
  {
    code: "basic",
    name: "Basic",
    price: 499,
    billingCycle: "Monthly",
    description: "Essentials for a small team getting started.",
    features: ["Sales & Purchase", "Inventory", "Up to 5 users"],
    maxUsers: 5,
  },
  {
    code: "professional",
    name: "Professional",
    price: 1499,
    billingCycle: "Monthly",
    description: "For growing businesses that need reporting and more seats.",
    features: ["Everything in Basic", "Reports", "Audit logs", "Up to 20 users"],
    maxUsers: 20,
  },
  {
    code: "enterprise",
    name: "Enterprise",
    price: 2999,
    billingCycle: "Monthly",
    description: "Full platform with AI features and unlimited seats.",
    features: ["Everything in Professional", "AI Assistant", "Priority support", "Unlimited users"],
    maxUsers: 0,
  },
];

const RESERVED_SUBDOMAINS = new Set(["api", "www", "admin", "master", "localhost"]);
const SUBDOMAIN_PATTERN = /^[a-z][a-z0-9-]{1,30}$/;

// Coerces a plan payload from the admin form into schema-shaped values.
// `features` accepts either a real array or the newline/comma-separated text
// the Manage Plans form sends (AddRecordForm has no repeater input).
function normalizePlanBody(body) {
  const out = {};
  if (body.description !== undefined) out.description = String(body.description || "");
  if (body.price !== undefined) out.price = Number(body.price) || 0;
  if (body.currency !== undefined) out.currency = String(body.currency || "INR");
  if (body.billingCycle !== undefined) {
    out.billingCycle = BILLING_CYCLES.includes(body.billingCycle) ? body.billingCycle : "Monthly";
  }
  if (body.maxUsers !== undefined) out.maxUsers = Number(body.maxUsers) || 0;
  if (body.modules !== undefined) {
    // Only keys that exist in the catalogue, so a typo cannot silently
    // lock a menu out. Order follows the catalogue for stable diffs.
    const picked = new Set(Array.isArray(body.modules) ? body.modules.map(String) : []);
    out.modules = ALL_MENU_KEYS.filter((k) => picked.has(k));
  }
  if (body.invoiceThemeTier !== undefined) {
    out.invoiceThemeTier = normaliseTier(body.invoiceThemeTier);
  }
  if (body.status !== undefined) out.status = body.status === "archived" ? "archived" : "active";
  if (body.features !== undefined) {
    out.features = Array.isArray(body.features)
      ? body.features.map((f) => String(f).trim()).filter(Boolean)
      : String(body.features || "")
          .split(/[\n,]/)
          .map((f) => f.trim())
          .filter(Boolean);
  }
  return out;
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// Two ways in, because these routes are mid-migration:
//   1. a signed-in super admin (the control plane at /admin) — preferred, and
//      the only one that records WHO made a change;
//   2. the X-Master-Key header — the original gate, still accepted so any
//      existing tooling or bookmarked flow keeps working.
// Either is sufficient; neither is required if the other is present.
// Compared in constant time, so response timing cannot be used to guess the
// key one character at a time.
function keyMatches(supplied, configured) {
  const a = Buffer.from(String(supplied || ""));
  const b = Buffer.from(String(configured || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireMasterKey(req, res, next) {
  const configured = process.env.MASTER_ADMIN_KEY;
  if (configured && keyMatches(req.headers["x-master-key"], configured)) return next();

  resolveSession(tokenFromRequest(req))
    .then((found) => {
      if (found) {
        req.superAdmin = found.admin;
        return next();
      }
      if (!configured) {
        return res
          .status(503)
          .json({ message: "Client management is disabled — sign in at /admin, or set MASTER_ADMIN_KEY in .env." });
      }
      return res.status(401).json({ message: "Sign in to the admin panel, or supply a valid master key." });
    })
    .catch(next);
}

function slugify(name) {
  return (name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function registerTenantAdminRoutes(app) {
  const router = express.Router();
  router.use(requireMasterKey);
  router.use(adminAuditMiddleware);

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const Tenant = getTenantRegistryModel();
      const tenants = await Tenant.find({}).sort({ createdAt: 1 });
      res.json({ tenants, defaultDatabase: DEFAULT_DB_NAME });
    })
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const { companyName, subdomain: rawSubdomain, databaseName: rawDbName, adminPassword } = req.body || {};
      if (!companyName) return res.status(400).json({ message: "Company name is required." });
      // A new client must never start on a default password anyone could guess,
      // so the super admin sets the first one here.
      const pwProblem = clientAuth.passwordProblem(adminPassword);
      if (pwProblem) return res.status(400).json({ message: `Initial admin password: ${pwProblem}` });

      const subdomain = slugify(rawSubdomain || companyName);
      if (!SUBDOMAIN_PATTERN.test(subdomain)) {
        return res.status(400).json({ message: "Subdomain must be 2-31 lowercase letters, numbers or hyphens, starting with a letter." });
      }
      if (RESERVED_SUBDOMAINS.has(subdomain)) {
        return res.status(400).json({ message: `"${subdomain}" is reserved and can't be used as a client subdomain.` });
      }

      const Tenant = getTenantRegistryModel();
      const existing = await Tenant.findOne({ subdomain });
      if (existing) return res.status(409).json({ message: `A client with subdomain "${subdomain}" already exists.` });

      const databaseName = slugify(rawDbName || `${subdomain}_crm`).replace(/-/g, "_");
      const dbTaken = await Tenant.findOne({ databaseName });
      if (dbTaken) return res.status(409).json({ message: `Database "${databaseName}" is already used by another client.` });

      const tenant = await Tenant.create({ subdomain, databaseName, companyName, status: "active" });
      try {
        await setClientAdminPassword(databaseName, adminPassword);
      } catch (err) {
        // No half-made client left behind with a default password.
        await Tenant.deleteOne({ subdomain });
        throw err;
      }
      invalidateRegistryCache(subdomain);
      res.status(201).json(tenant);
    })
  );

  router.put(
    "/:subdomain",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const { companyName, status } = body;
      const updates = {};

      // ---- Reset the client admin's password ----
      // For a client who has lost it, or one still on a weak first password.
      // Blank means "leave it alone". Anyone signed in as that admin is signed
      // out, so an old session cannot outlive the reset.
      if (body.adminPassword !== undefined && String(body.adminPassword).length) {
        const problem = clientAuth.passwordProblem(body.adminPassword);
        if (problem) return res.status(400).json({ message: `Admin password: ${problem}` });
        const target = await getTenantRegistryModel().findOne({ subdomain: req.params.subdomain });
        if (!target) return res.status(404).json({ message: "Client not found." });
        await setClientAdminPassword(target.databaseName, body.adminPassword);
        // The built-in admin has no user id, so this ends exactly its sessions —
        // and drops them from the in-memory session cache, which a plain
        // database delete would leave valid for up to 30 seconds.
        await clientAuth.destroySessionsForUser(req.params.subdomain, "");
      }
      if (companyName !== undefined) updates.companyName = companyName;
      if (status !== undefined) updates.status = status;

      // ---- Per-client menu override ----
      // Same validation as the plan picker: only keys that exist in the
      // catalogue survive, so a typo can't silently lock a menu out. An empty
      // array means "no client-level restriction" and hands the decision back
      // to the plan.
      if (body.modules !== undefined) {
        const picked = new Set(Array.isArray(body.modules) ? body.modules.map(String) : []);
        updates.modules = ALL_MENU_KEYS.filter((k) => picked.has(k));
      }

      // ---- Add-ons bought on top of the plan ----
      // Only codes that actually exist survive, so a stale code left over
      // from a deleted add-on cannot sit on a client row granting nothing
      // and confusing whoever reads it next.
      if (body.addOns !== undefined) {
        const picked = new Set(Array.isArray(body.addOns) ? body.addOns.map(String) : []);
        const known = await getAddOnModel().find({ code: { $in: [...picked] } }, { code: 1 }).lean();
        updates.addOns = known.map((a) => a.code);
      }

      // ---- Theme ----
      // Blank means "whatever is marked default", which is how every client
      // behaves until one is chosen for them. An unknown code is refused
      // rather than stored, or the client would silently fall back and the
      // admin screen would keep showing a theme that does not exist.
      if (body.themeCode !== undefined) {
        const code = String(body.themeCode || "").trim();
        if (!code) {
          updates.themeCode = "";
        } else {
          const theme = await getThemeModel().findOne({ code }).lean();
          if (!theme) return res.status(400).json({ message: `No theme with code "${code}".` });
          updates.themeCode = theme.code;
        }
      }
      // Deliberately not allowing subdomain/databaseName to be changed here —
      // repointing a live client's database by editing a text field is the
      // single easiest way to accidentally cross-wire two clients' data.
      // Retire the row and create a fresh one instead if that's really needed.

      // ---- Subscription ----
      // Assigning a plan snapshots its monthly price onto the tenant, so a
      // later price change on the Plan doesn't rewrite what this client was sold.
      if (body.planCode !== undefined) {
        const code = String(body.planCode || "").trim();
        if (!code) {
          Object.assign(updates, { planCode: "", planName: "", price: 0 });
        } else {
          const plan = await getPlanModel().findOne({ code }).lean();
          if (!plan) return res.status(400).json({ message: `No plan with code "${code}".` });
          Object.assign(updates, { planCode: plan.code, planName: plan.name, price: plan.price });
        }
      }
      if (body.termMonths !== undefined) {
        const n = Number(body.termMonths);
        if (!TERM_MONTHS.includes(n)) {
          return res.status(400).json({ message: `Term must be one of ${TERM_MONTHS.join(", ")} months.` });
        }
        updates.termMonths = n;
      }
      if (body.discountPercent !== undefined) {
        const n = Number(body.discountPercent);
        if (Number.isNaN(n) || n < 0 || n > 100) {
          return res.status(400).json({ message: "Discount must be between 0 and 100 percent." });
        }
        updates.discountPercent = n;
      }
      for (const key of ["subscriptionStart", "subscriptionEnd"]) {
        if (body[key] === undefined) continue;
        if (!body[key]) {
          updates[key] = null; // clearing the end date means "no expiry"
          continue;
        }
        const d = new Date(body[key]);
        if (Number.isNaN(d.getTime())) return res.status(400).json({ message: `"${body[key]}" is not a valid date.` });
        updates[key] = d;
      }
      if (body.graceDays !== undefined) {
        const n = Number(body.graceDays);
        if (Number.isNaN(n) || n < 0) return res.status(400).json({ message: "Grace days must be 0 or more." });
        updates.graceDays = n;
      }

      const Tenant = getTenantRegistryModel();

      // Recompute what this client owes whenever price, term or discount moves.
      // Stored rather than derived at read time so billing history survives a
      // later plan reprice.
      const current = (await Tenant.findOne({ subdomain: req.params.subdomain }).lean()) || {};
      const merged = { ...current, ...updates };
      // NOTE: `current` came from .lean(), which does NOT apply schema
      // defaults — a tenant row saved before these fields existed has no
      // termMonths at all. Falling back to 0 there silently zeroed the
      // amount (price x 0), so default to the same value the schema uses.
      const rate = Number(merged.price) || 0;
      const months = Number(merged.termMonths) || DEFAULT_TERM_MONTHS;
      const discount = Number(merged.discountPercent) || 0;
      updates.amountPayable = Math.round(rate * months * (1 - discount / 100));
      const tenant = await Tenant.findOneAndUpdate({ subdomain: req.params.subdomain }, { $set: updates }, { new: true });
      if (!tenant) return res.status(404).json({ message: "Client not found." });
      invalidateRegistryCache(req.params.subdomain);
      res.json(tenant);
    })
  );

  router.delete(
    "/:subdomain",
    asyncHandler(async (req, res) => {
      // Removes only the registry row (the routing entry) — never touches or
      // drops the client's actual database. Their data stays intact; their
      // subdomain just falls back to the default database until re-added.
      const Tenant = getTenantRegistryModel();
      const deleted = await Tenant.findOneAndDelete({ subdomain: req.params.subdomain });
      if (!deleted) return res.status(404).json({ message: "Client not found." });
      invalidateRegistryCache(req.params.subdomain);
      res.json({ success: true });
    })
  );

  // ---------- Subscription plans ----------
  const planRouter = express.Router();
  planRouter.use(requireMasterKey);
  planRouter.use(adminAuditMiddleware);

  planRouter.get(
    "/",
    asyncHandler(async (req, res) => {
      const Plan = getPlanModel();
      let plans = await Plan.find({}).sort({ price: 1 });
      // First run: seed a starter set so the screen isn't a blank slate.
      // Editable and deletable like any other plan afterwards.
      if (plans.length === 0) {
        await Plan.insertMany(STARTER_PLANS);
        plans = await Plan.find({}).sort({ price: 1 });
      }
      res.json({ plans });
    })
  );

  planRouter.post(
    "/",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      if (!body.name) return res.status(400).json({ message: "Plan name is required." });
      const code = slugify(body.code || body.name);
      if (!code) return res.status(400).json({ message: "Could not derive a plan code from that name." });

      const Plan = getPlanModel();
      if (await Plan.findOne({ code })) {
        return res.status(409).json({ message: `A plan with code "${code}" already exists.` });
      }
      const plan = await Plan.create({ ...normalizePlanBody(body), code, name: body.name });
      res.status(201).json(plan);
    })
  );

  planRouter.put(
    "/:code",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const updates = normalizePlanBody(body);
      if (body.name) updates.name = body.name;
      // `code` is the key clients are assigned by — changing it would orphan
      // every tenant pointing at it, so it stays fixed once created.
      const plan = await getPlanModel().findOneAndUpdate(
        { code: req.params.code },
        { $set: updates },
        { new: true }
      );
      if (!plan) return res.status(404).json({ message: "Plan not found." });
      res.json(plan);
    })
  );

  planRouter.delete(
    "/:code",
    asyncHandler(async (req, res) => {
      // Refuse while any client is still on this plan — otherwise their
      // subscription would point at a plan that no longer exists.
      const Tenant = getTenantRegistryModel();
      const inUse = await Tenant.find({ planCode: req.params.code }, { companyName: 1, subdomain: 1 }).lean();
      if (inUse.length) {
        const names = inUse.map((t) => t.companyName || t.subdomain).join(", ");
        return res.status(409).json({ message: `Can't delete this plan — still assigned to: ${names}.` });
      }
      const deleted = await getPlanModel().findOneAndDelete({ code: req.params.code });
      if (!deleted) return res.status(404).json({ message: "Plan not found." });
      res.json({ success: true });
    })
  );

  // ---------- Module registry ----------
  // There is deliberately no POST or DELETE here. Which modules EXIST is
  // decided by MODULES in permissions.js, because those entries carry the
  // URL rules the middleware matches on — inventing a module row with no
  // code behind it would produce a menu that gates nothing. This screen
  // edits what an existing module COSTS and whether it is on sale.
  const moduleRouter = express.Router();
  moduleRouter.use(requireMasterKey);
  moduleRouter.use(adminAuditMiddleware);

  moduleRouter.get(
    "/",
    asyncHandler(async (req, res) => {
      const Module = getModuleModel();
      // Seed on first read, and back-fill anything added to the code
      // catalogue since — so a module shipped in a later release shows up
      // here on its own instead of being invisible until someone notices.
      const seed = moduleSeedRows();
      const existing = await Module.find({}, { key: 1 }).lean();
      const have = new Set(existing.map((m) => m.key));
      const missing = seed.filter((r) => !have.has(r.key));
      if (missing.length) await Module.insertMany(missing);
      // The reverse: a module taken out of the code catalogue (a feature
      // retired) must not linger here as a row that gates nothing. The rows
      // mirror the code, so anything the code no longer lists is an orphan.
      if (seed.length) await Module.deleteMany({ key: { $nin: seed.map((r) => r.key) } });
      const modules = await Module.find({}).sort({ order: 1, key: 1 }).lean();

      // Show the name the sidebar actually uses. Renaming lives in Menu
      // Management, so a module renamed there must not still read by its
      // shipped name here — one name for one thing, wherever you look.
      const storedMenu = await getMenuItemModel().find({}).lean();
      const menuByKey = new Map(resolveMenu(storedMenu).map((m) => [m.key, m]));
      res.json({
        modules: modules.map((m) => {
          const menu = menuByKey.get(m.key);
          return { ...m, label: (menu && menu.label) || m.label || m.key };
        }),
      });
    })
  );

  moduleRouter.put(
    "/:key",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const updates = {};
      if (body.label !== undefined) updates.label = String(body.label || "");
      if (body.description !== undefined) updates.description = String(body.description || "");
      if (body.status !== undefined) updates.status = body.status === "disabled" ? "disabled" : "active";
      if (body.core !== undefined) updates.core = Boolean(body.core);
      if (body.addOnOnly !== undefined) updates.addOnOnly = Boolean(body.addOnOnly);
      if (body.order !== undefined) updates.order = Number(body.order) || 0;
      // `key` is what every plan, add-on and client override points at, so
      // it is fixed for the life of the row — it mirrors a code constant.
      const found = await getModuleModel().findOneAndUpdate(
        { key: req.params.key },
        { $set: updates },
        { new: true }
      );
      if (!found) return res.status(404).json({ message: "Module not found." });
      invalidatePlatformRegistry();
      res.json(found);
    })
  );

  // ---------- Add-ons ----------
  const addOnRouter = express.Router();
  addOnRouter.use(requireMasterKey);
  addOnRouter.use(adminAuditMiddleware);

  function normalizeAddOnBody(body) {
    const out = {};
    if (body.description !== undefined) out.description = String(body.description || "");
    if (body.price !== undefined) out.price = Number(body.price) || 0;
    if (body.currency !== undefined) out.currency = String(body.currency || "INR");
    if (body.billingCycle !== undefined) {
      out.billingCycle = BILLING_CYCLES.includes(body.billingCycle) ? body.billingCycle : "Monthly";
    }
    if (body.maxUsersBonus !== undefined) out.maxUsersBonus = Number(body.maxUsersBonus) || 0;
    if (body.status !== undefined) out.status = body.status === "archived" ? "archived" : "active";
    if (body.modules !== undefined) {
      // Same whitelist as the plan picker: a typo cannot invent a menu key.
      const picked = new Set(Array.isArray(body.modules) ? body.modules.map(String) : []);
      out.modules = ALL_MENU_KEYS.filter((k) => picked.has(k));
    }
    return out;
  }

  addOnRouter.get(
    "/",
    asyncHandler(async (req, res) => {
      // No starter set here on purpose — what is worth selling separately is
      // a commercial decision, and inventing three fake products would be
      // worse than an empty screen that says so.
      const addOns = await getAddOnModel().find({}).sort({ price: 1, name: 1 });
      res.json({ addOns });
    })
  );

  addOnRouter.post(
    "/",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      if (!body.name) return res.status(400).json({ message: "Add-on name is required." });
      const code = slugify(body.code || body.name);
      if (!code) return res.status(400).json({ message: "Could not derive an add-on code from that name." });
      const AddOn = getAddOnModel();
      if (await AddOn.findOne({ code })) {
        return res.status(409).json({ message: `An add-on with code "${code}" already exists.` });
      }
      const created = await AddOn.create({ ...normalizeAddOnBody(body), code, name: body.name });
      invalidatePlatformRegistry();
      res.status(201).json(created);
    })
  );

  addOnRouter.put(
    "/:code",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const updates = normalizeAddOnBody(body);
      if (body.name) updates.name = body.name;
      // `code` is what a client row points at — fixed, like a plan code.
      const found = await getAddOnModel().findOneAndUpdate(
        { code: req.params.code },
        { $set: updates },
        { new: true }
      );
      if (!found) return res.status(404).json({ message: "Add-on not found." });
      invalidatePlatformRegistry();
      res.json(found);
    })
  );

  addOnRouter.delete(
    "/:code",
    asyncHandler(async (req, res) => {
      // Refuse while a client still holds it, exactly as plans do: deleting
      // it out from under them would silently switch off menus they pay for.
      const inUse = await getTenantRegistryModel()
        .find({ addOns: req.params.code }, { companyName: 1, subdomain: 1 })
        .lean();
      if (inUse.length) {
        const names = inUse.map((t) => t.companyName || t.subdomain).join(", ");
        return res.status(409).json({ message: `Can't delete this add-on — still held by: ${names}.` });
      }
      const deleted = await getAddOnModel().findOneAndDelete({ code: req.params.code });
      if (!deleted) return res.status(404).json({ message: "Add-on not found." });
      invalidatePlatformRegistry();
      res.json({ success: true });
    })
  );

  // ---------- Global roles (role templates) ----------
  //
  // These are templates, not roles anyone signs in with. Each client keeps its
  // own Role collection in its own database; a template is what those are
  // created from, so "Sales Executive" is defined once instead of 200 times.
  const globalRoleRouter = express.Router();
  globalRoleRouter.use(requireMasterKey);
  globalRoleRouter.use(adminAuditMiddleware);

  function normalizeGlobalRoleBody(body) {
    const out = {};
    if (body.description !== undefined) out.description = String(body.description || "");
    if (body.status !== undefined) out.status = body.status === "archived" ? "archived" : "active";
    if (body.permissions !== undefined) {
      // Only strings the catalogue actually generates survive, so a template
      // can never carry a permission no route will ever check.
      const valid = new Set(allPermissions());
      const picked = Array.isArray(body.permissions) ? body.permissions.map(String) : [];
      out.permissions = [...new Set(picked.filter((p) => valid.has(p)))];
    }
    return out;
  }

  globalRoleRouter.get(
    "/",
    asyncHandler(async (req, res) => {
      const GlobalRole = getGlobalRoleModel();
      // Seed on first read so the screen opens with the eight starter roles
      // rather than a blank slate. Editable and deletable afterwards.
      if ((await GlobalRole.estimatedDocumentCount()) === 0) {
        await GlobalRole.insertMany(globalRoleSeedRows());
      }
      const roles = await GlobalRole.find({}).sort({ createdAt: 1 });
      res.json({ roles });
    })
  );

  globalRoleRouter.post(
    "/",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      if (!body.name) return res.status(400).json({ message: "Role name is required." });
      const code = slugify(body.code || body.name);
      if (!code) return res.status(400).json({ message: "Could not derive a role code from that name." });
      const GlobalRole = getGlobalRoleModel();
      if (await GlobalRole.findOne({ code })) {
        return res.status(409).json({ message: `A global role with code "${code}" already exists.` });
      }
      const created = await GlobalRole.create({ ...normalizeGlobalRoleBody(body), code, name: body.name });
      res.status(201).json(created);
    })
  );

  globalRoleRouter.put(
    "/:code",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const GlobalRole = getGlobalRoleModel();
      const existing = await GlobalRole.findOne({ code: req.params.code }).lean();
      if (!existing) return res.status(404).json({ message: "Global role not found." });
      if (existing.protected) {
        return res.status(409).json({
          message: `"${existing.name}" always holds every permission — there is nothing here to change.`,
        });
      }
      const updates = normalizeGlobalRoleBody(body);
      if (body.name) updates.name = body.name;
      // `code` is what an applied template is matched by — fixed once created.
      const found = await GlobalRole.findOneAndUpdate({ code: req.params.code }, { $set: updates }, { new: true });
      res.json(found);
    })
  );

  globalRoleRouter.delete(
    "/:code",
    asyncHandler(async (req, res) => {
      const GlobalRole = getGlobalRoleModel();
      const existing = await GlobalRole.findOne({ code: req.params.code }).lean();
      if (!existing) return res.status(404).json({ message: "Global role not found." });
      if (existing.protected) {
        return res.status(409).json({ message: `"${existing.name}" cannot be deleted.` });
      }
      // Deliberately does NOT touch roles already created in client databases.
      // Those are the client's own records now; deleting the template they came
      // from must not quietly strip access from users assigned to them.
      await GlobalRole.deleteOne({ code: req.params.code });
      res.json({ success: true });
    })
  );

  // Push a template into one or more clients' own Role collections.
  //
  // Matching is by role NAME, because that is what a client's users are
  // assigned by (see X-User-Role). An existing role of the same name is
  // overwritten — that is what applying a template means, and the admin
  // screen says so before it runs.
  globalRoleRouter.post(
    "/:code/apply",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const GlobalRole = getGlobalRoleModel();
      const template = await GlobalRole.findOne({ code: req.params.code }).lean();
      if (!template) return res.status(404).json({ message: "Global role not found." });

      const Tenant = getTenantRegistryModel();
      const wanted = Array.isArray(body.subdomains) ? body.subdomains.map(String) : [];
      if (wanted.length === 0) {
        return res.status(400).json({ message: "Pick at least one client to apply this role to." });
      }
      const tenants = await Tenant.find({ subdomain: { $in: wanted } }).lean();
      if (tenants.length === 0) return res.status(404).json({ message: "None of those clients exist." });

      const applied = [];
      const failed = [];
      for (const t of tenants) {
        try {
          const { Role } = bindModelsForDb(t.databaseName);
          const existing = await Role.findOne({
            name: new RegExp(`^${template.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
          });
          if (existing) {
            existing.description = template.description;
            existing.permissions = template.permissions;
            await existing.save();
            applied.push({ subdomain: t.subdomain, action: "updated" });
          } else {
            // A client Role needs id/seq of its own — they are per-database
            // running numbers, so they are derived here rather than copied.
            const last = await Role.findOne({}).sort({ seq: -1 }).lean();
            const seq = (last && Number(last.seq) ? Number(last.seq) : 0) + 1;
            await Role.create({
              id: `ROLE-${String(seq).padStart(3, "0")}`,
              seq,
              name: template.name,
              description: template.description,
              permissions: template.permissions,
              status: "Active",
            });
            applied.push({ subdomain: t.subdomain, action: "created" });
          }
        } catch (err) {
          // One unreachable client database must not abort the whole push —
          // report it and carry on with the rest.
          failed.push({ subdomain: t.subdomain, message: err.message });
        }
      }
      res.json({ role: template.name, applied, failed });
    })
  );

  // ---------- Global permissions ----------
  //
  // Which actions each module offers, platform-wide. Switching one off removes
  // it from every client's Roles matrix AND refuses it at the gate, for every
  // role including a client's own Administrator.
  const globalPermissionRouter = express.Router();
  globalPermissionRouter.use(requireMasterKey);
  globalPermissionRouter.use(adminAuditMiddleware);

  globalPermissionRouter.get(
    "/",
    asyncHandler(async (req, res) => {
      const GlobalPermission = getGlobalPermissionModel();
      // Seed and back-fill, same as the module registry: a module added to the
      // catalogue later gets a row here without anyone having to notice.
      const seed = permissionSeedRows();
      const existing = await GlobalPermission.find({}, { moduleKey: 1 }).lean();
      const have = new Set(existing.map((p) => p.moduleKey));
      const missing = seed.filter((r) => !have.has(r.moduleKey));
      if (missing.length) await GlobalPermission.insertMany(missing);
      // Drop rows for modules the code no longer has — see the Modules route.
      if (seed.length) await GlobalPermission.deleteMany({ moduleKey: { $nin: seed.map((r) => r.moduleKey) } });

      const permissions = await GlobalPermission.find({}).lean();
      // Ordered and labelled from the code catalogue, so the matrix rows line
      // up with the Modules screen without the frontend joining two lists.
      const byKey = new Map(permissions.map((p) => [p.moduleKey, p]));
      res.json({
        actions: ACTIONS,
        alwaysAllowed: ALWAYS_ALLOWED_ACTION,
        permissions: MODULES.map((m) => {
          const row = byKey.get(m.key);
          return {
            moduleKey: m.key,
            label: m.label,
            actions: (row && row.actions) || [...ACTIONS],
            note: (row && row.note) || "",
          };
        }),
      });
    })
  );

  globalPermissionRouter.put(
    "/:moduleKey",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const updates = {};
      if (body.actions !== undefined) {
        const picked = new Set(Array.isArray(body.actions) ? body.actions.map(String) : []);
        // view is never withheld here — see models/GlobalPermission.js.
        picked.add(ALWAYS_ALLOWED_ACTION);
        updates.actions = ACTIONS.filter((a) => picked.has(a));
      }
      if (body.note !== undefined) updates.note = String(body.note || "");
      const found = await getGlobalPermissionModel().findOneAndUpdate(
        { moduleKey: req.params.moduleKey },
        { $set: updates },
        { new: true, upsert: true }
      );
      invalidatePlatformRegistry();
      res.json(found);
    })
  );

  // ---------- Menu management ----------
  //
  // Presentation only: label, icon, order and whether an item appears in the
  // sidebar at all. Reachability is decided elsewhere and is not negotiable
  // from here — see models/MenuItem.js.
  const menuRouter = express.Router();
  menuRouter.use(requireMasterKey);
  menuRouter.use(adminAuditMiddleware);

  menuRouter.get(
    "/",
    asyncHandler(async (req, res) => {
      // Nothing is seeded: a stored row IS an override, so writing defaults
      // into the collection would turn "never touched" into "deliberately set
      // to the default" and lose the difference the reset button needs.
      const stored = await getMenuItemModel().find({}).lean();
      res.json({ menu: resolveMenu(stored), icons: MENU_ICONS });
    })
  );

  menuRouter.put(
    "/:key",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const known = resolveMenu([]).find((m) => m.key === req.params.key);
      if (!known) return res.status(404).json({ message: "No such menu item." });

      const updates = { parentKey: known.parentKey };
      if (body.label !== undefined) {
        // Blank means "back to the shipped label", which is how the reset
        // button works — it clears the field rather than writing the default.
        updates.label = String(body.label || "").trim();
      }
      if (body.icon !== undefined) {
        const icon = String(body.icon || "").trim();
        if (icon && !MENU_ICONS.includes(icon)) {
          return res.status(400).json({ message: `"${icon}" is not an icon this app can draw.` });
        }
        updates.icon = icon;
      }
      if (body.order !== undefined) updates.order = Number(body.order) || 0;
      if (body.hidden !== undefined) updates.hidden = Boolean(body.hidden);

      await getMenuItemModel().findOneAndUpdate(
        { key: req.params.key },
        { $set: updates },
        { new: true, upsert: true }
      );
      invalidatePlatformRegistry();
      const stored = await getMenuItemModel().find({}).lean();
      res.json({ menu: resolveMenu(stored) });
    })
  );

  menuRouter.delete(
    "/:key",
    asyncHandler(async (req, res) => {
      // Reset: drop the override so the item goes back to shipped defaults.
      await getMenuItemModel().deleteOne({ key: req.params.key });
      invalidatePlatformRegistry();
      const stored = await getMenuItemModel().find({}).lean();
      res.json({ menu: resolveMenu(stored) });
    })
  );

  menuRouter.post(
    "/reset",
    asyncHandler(async (req, res) => {
      await getMenuItemModel().deleteMany({});
      invalidatePlatformRegistry();
      res.json({ menu: resolveMenu([]) });
    })
  );
  // ---------- Themes ----------
  //
  // White-labelling for the application's own chrome. One theme can be shared
  // by any number of clients, and exactly one row is the default the rest fall
  // back to — so there is always something to paint with.
  const themeRouter = express.Router();
  themeRouter.use(requireMasterKey);
  themeRouter.use(adminAuditMiddleware);

  themeRouter.get(
    "/",
    asyncHandler(async (req, res) => {
      const Theme = getThemeModel();
      // Seed on first read so the screen opens with something to look at, and
      // so "Default" exists as a way back to the stock look.
      if ((await Theme.estimatedDocumentCount()) === 0) {
        await Theme.insertMany(STARTER_THEMES);
        invalidatePlatformRegistry();
      }
      const themes = await Theme.find({}).sort({ isDefault: -1, name: 1 }).lean();
      // Which clients are on each theme, so the screen can warn before an edit
      // and refuse a delete that would strand someone.
      const tenants = await getTenantRegistryModel()
        .find({}, { subdomain: 1, companyName: 1, themeCode: 1 })
        .lean();
      res.json({
        themes: themes.map((t) => ({
          ...t,
          usedBy: tenants
            .filter((x) => x.themeCode === t.code || (!x.themeCode && t.isDefault))
            .map((x) => x.companyName || x.subdomain),
        })),
        modes: MODES,
      });
    })
  );

  themeRouter.post(
    "/",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      if (!body.name) return res.status(400).json({ message: "Theme name is required." });
      const code = slugify(body.code || body.name);
      if (!code) return res.status(400).json({ message: "Could not derive a theme code from that name." });

      const { updates, errors } = normalizeThemeBody(body);
      if (errors.length) return res.status(400).json({ message: errors.join(" ") });

      const Theme = getThemeModel();
      if (await Theme.findOne({ code })) {
        return res.status(409).json({ message: `A theme with code "${code}" already exists.` });
      }
      // A new theme is never the default — moving the default is its own
      // deliberate action, so that creating one cannot repaint every client.
      const created = await Theme.create(
        reconcileModes({ ...STARTER_THEMES[0], ...updates, code, name: body.name, isDefault: false })
      );
      invalidatePlatformRegistry();
      res.status(201).json(created);
    })
  );

  themeRouter.put(
    "/:code",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const { updates, errors } = normalizeThemeBody(body);
      if (errors.length) return res.status(400).json({ message: errors.join(" ") });
      if (body.name) updates.name = body.name;

      const Theme = getThemeModel();
      const existing = await Theme.findOne({ code: req.params.code }).lean();
      if (!existing) return res.status(404).json({ message: "Theme not found." });

      // Reconcile against the MERGED document, so editing only `modes` cannot
      // leave defaultMode pointing at a mode that is no longer offered.
      const merged = reconcileModes({ ...existing, ...updates });
      const found = await Theme.findOneAndUpdate(
        { code: req.params.code },
        { $set: { ...updates, modes: merged.modes, defaultMode: merged.defaultMode } },
        { new: true }
      );
      invalidatePlatformRegistry();
      res.json(found);
    })
  );

  // Moving the default is a single action rather than a checkbox on the form:
  // it has to clear the flag everywhere else at the same time, and it repaints
  // every client who has not chosen a theme of their own.
  themeRouter.post(
    "/:code/default",
    asyncHandler(async (req, res) => {
      const Theme = getThemeModel();
      const target = await Theme.findOne({ code: req.params.code }).lean();
      if (!target) return res.status(404).json({ message: "Theme not found." });
      if (target.status === "archived") {
        return res.status(409).json({ message: "An archived theme cannot be the platform default." });
      }
      await Theme.updateMany({ code: { $ne: target.code } }, { $set: { isDefault: false } });
      await Theme.updateOne({ code: target.code }, { $set: { isDefault: true } });
      invalidatePlatformRegistry();
      res.json({ success: true, code: target.code, name: target.name });
    })
  );

  themeRouter.delete(
    "/:code",
    asyncHandler(async (req, res) => {
      const Theme = getThemeModel();
      const existing = await Theme.findOne({ code: req.params.code }).lean();
      if (!existing) return res.status(404).json({ message: "Theme not found." });
      if (existing.isDefault) {
        return res.status(409).json({
          message: "This is the platform default — make another theme the default first.",
        });
      }
      // Refuse while a client is still on it, exactly as plans and add-ons do:
      // deleting it out from under them would repaint their app with no warning.
      const inUse = await getTenantRegistryModel()
        .find({ themeCode: req.params.code }, { companyName: 1, subdomain: 1 })
        .lean();
      if (inUse.length) {
        const names = inUse.map((t) => t.companyName || t.subdomain).join(", ");
        return res.status(409).json({ message: `Can't delete this theme — still used by: ${names}.` });
      }
      await Theme.deleteOne({ code: req.params.code });
      invalidatePlatformRegistry();
      res.json({ success: true });
    })
  );

  // ---------- Invoice templates ----------
  //
  // There is no POST or DELETE here, for the same reason the Modules screen
  // has none: which templates EXIST is decided by THEMES in invoiceThemes.js,
  // because each one is a React layout in frontend/src/print/. Inventing a row
  // would put a template in a client's picker that cannot print. This screen
  // decides which tier unlocks each one, what it is called, and whether it is
  // still on offer.
  const invoiceTemplateRouter = express.Router();
  invoiceTemplateRouter.use(requireMasterKey);
  invoiceTemplateRouter.use(adminAuditMiddleware);

  async function templateState() {
    const Template = getInvoiceTemplateModel();
    // Seed on first read, and back-fill anything added to the code catalogue
    // since — so a template shipped in a later release appears here on its own.
    const seed = templateSeedRows();
    const existing = await Template.find({}, { key: 1 }).lean();
    const have = new Set(existing.map((t) => t.key));
    const missing = seed.filter((r) => !have.has(r.key));
    if (missing.length) {
      await Template.insertMany(missing);
      invalidatePlatformRegistry();
    }
    const stored = await Template.find({}).lean();
    // resolveTemplates drops disabled rows, because everywhere else in the app
    // "the catalogue" means "what a client could actually pick". This screen is
    // the one place that has to see them, so they are merged back in.
    const live = resolveTemplates(stored);
    const liveByKey = new Map(live.map((t) => [t.key, t]));
    const byKey = new Map(stored.map((t) => [t.key, t]));
    const templates = THEMES.map((t, i) => {
      const shown = liveByKey.get(t.key);
      if (shown) return shown;
      const o = byKey.get(t.key) || {};
      return {
        ...t,
        label: o.label || t.label,
        description: o.description || t.description,
        tier: TIERS.includes(o.tier) ? o.tier : t.tier,
        status: "disabled",
        order: o.order === undefined || o.order === null ? (i + 1) * 10 : o.order,
        isDefault: Boolean(o.isDefault),
        defaultLabel: t.label,
        defaultTier: t.tier,
      };
    }).sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
    return templates;
  }

  invoiceTemplateRouter.get(
    "/",
    asyncHandler(async (req, res) => {
      const templates = await templateState();
      // Which plans sit at each tier, so the screen can say what moving a
      // template between tiers actually does commercially.
      const plans = await getPlanModel().find({}, { name: 1, invoiceThemeTier: 1 }).lean();
      res.json({
        templates,
        tiers: TIERS,
        plansByTier: TIERS.reduce((acc, tier) => {
          acc[tier] = plans.filter((p) => normaliseTier(p.invoiceThemeTier) === tier).map((p) => p.name);
          return acc;
        }, {}),
      });
    })
  );

  invoiceTemplateRouter.put(
    "/:key",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      if (!THEMES.some((t) => t.key === req.params.key)) {
        return res.status(404).json({ message: "No such invoice template." });
      }
      const updates = {};
      if (body.label !== undefined) updates.label = String(body.label || "").trim();
      if (body.description !== undefined) updates.description = String(body.description || "").trim();
      if (body.tier !== undefined) {
        const tier = String(body.tier || "");
        if (!TIERS.includes(tier)) {
          return res.status(400).json({ message: `Tier must be one of ${TIERS.join(", ")}.` });
        }
        updates.tier = tier;
      }
      if (body.order !== undefined) updates.order = Number(body.order) || 0;
      if (body.status !== undefined) {
        updates.status = body.status === "disabled" ? "disabled" : "active";
      }

      // Refuse to withdraw the template clients fall back to — that would
      // leave anyone who has not chosen one with nothing to print.
      if (updates.status === "disabled") {
        const current = await getInvoiceTemplateModel().findOne({ key: req.params.key }).lean();
        if (current && current.isDefault) {
          return res.status(409).json({
            message: "This is the fallback template — make another one the default first.",
          });
        }
      }

      await getInvoiceTemplateModel().findOneAndUpdate(
        { key: req.params.key },
        { $set: updates },
        { new: true, upsert: true }
      );
      invalidatePlatformRegistry();
      res.json({ templates: await templateState() });
    })
  );

  // The fallback every client lands on before choosing, and after a template
  // they were using is withdrawn or moved out of their tier.
  invoiceTemplateRouter.post(
    "/:key/default",
    asyncHandler(async (req, res) => {
      const Template = getInvoiceTemplateModel();
      if (!THEMES.some((t) => t.key === req.params.key)) {
        return res.status(404).json({ message: "No such invoice template." });
      }
      const current = await Template.findOne({ key: req.params.key }).lean();
      if (current && current.status === "disabled") {
        return res.status(409).json({ message: "A withdrawn template cannot be the fallback." });
      }
      // It also has to be reachable on the cheapest tier, or clients on Basic
      // would fall back to something they are not entitled to.
      const tier = (current && current.tier) || (THEMES.find((t) => t.key === req.params.key) || {}).tier;
      if (normaliseTier(tier) !== TIERS[0]) {
        return res.status(409).json({
          message: `The fallback has to be a ${TIERS[0]} template, or clients on the cheapest plan could not print.`,
        });
      }
      await Template.updateMany({ key: { $ne: req.params.key } }, { $set: { isDefault: false } });
      await Template.updateOne({ key: req.params.key }, { $set: { isDefault: true } }, { upsert: true });
      invalidatePlatformRegistry();
      res.json({ templates: await templateState() });
    })
  );

  invoiceTemplateRouter.delete(
    "/:key",
    asyncHandler(async (req, res) => {
      // Reset: drop the override so the template goes back to the tier, label
      // and position it ships with.
      await getInvoiceTemplateModel().deleteOne({ key: req.params.key });
      invalidatePlatformRegistry();
      res.json({ templates: await templateState() });
    })
  );

  // ---------- Payment methods ----------
  //
  // Full CRUD, unlike the module and template registries: a payment method is
  // a label recorded on an invoice rather than a code path, so there is no
  // catalogue underneath that a new row could get out of step with.
  const paymentMethodRouter = express.Router();
  paymentMethodRouter.use(requireMasterKey);
  paymentMethodRouter.use(adminAuditMiddleware);

  function normalizePaymentBody(body) {
    const out = {};
    if (body.label !== undefined) out.label = String(body.label || "").trim();
    if (body.description !== undefined) out.description = String(body.description || "").trim();
    if (body.requiresReference !== undefined) out.requiresReference = Boolean(body.requiresReference);
    if (body.referenceLabel !== undefined) out.referenceLabel = String(body.referenceLabel || "").trim();
    if (body.order !== undefined) out.order = Number(body.order) || 0;
    if (body.status !== undefined) out.status = body.status === "disabled" ? "disabled" : "active";
    return out;
  }

  async function paymentState() {
    const PaymentMethod = getPaymentMethodModel();
    if ((await PaymentMethod.estimatedDocumentCount()) === 0) {
      await PaymentMethod.insertMany(paymentSeedRows());
      invalidatePlatformRegistry();
    }
    // Disabled rows are included here — this is the one screen that has to see
    // them, so they can be switched back on.
    return PaymentMethod.find({}).sort({ order: 1, label: 1 }).lean();
  }

  paymentMethodRouter.get(
    "/",
    asyncHandler(async (req, res) => {
      res.json({ methods: await paymentState() });
    })
  );

  paymentMethodRouter.post(
    "/",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      if (!body.label) return res.status(400).json({ message: "A name is required." });
      const code = slugify(body.code || body.label);
      if (!code) return res.status(400).json({ message: "Could not derive a code from that name." });

      const PaymentMethod = getPaymentMethodModel();
      await paymentState(); // seed first, so a custom method cannot beat the built-ins in
      if (await PaymentMethod.findOne({ code })) {
        return res.status(409).json({ message: `A payment method with code "${code}" already exists.` });
      }
      // New methods go to the end of the list rather than the front, so adding
      // one never reshuffles a form people already know.
      const last = await PaymentMethod.findOne({}).sort({ order: -1 }).lean();
      await PaymentMethod.create({
        ...normalizePaymentBody(body),
        code,
        label: body.label,
        order: ((last && last.order) || 0) + 10,
        isDefault: false,
        builtIn: false,
      });
      invalidatePlatformRegistry();
      res.status(201).json({ methods: await paymentState() });
    })
  );

  paymentMethodRouter.put(
    "/:code",
    asyncHandler(async (req, res) => {
      const PaymentMethod = getPaymentMethodModel();
      const existing = await PaymentMethod.findOne({ code: req.params.code }).lean();
      if (!existing) return res.status(404).json({ message: "Payment method not found." });

      const updates = normalizePaymentBody(req.body || {});
      if (updates.label === "") return res.status(400).json({ message: "A name is required." });
      // Switching off the preselected method would leave new invoices starting
      // on nothing, so the default has to be moved first.
      if (updates.status === "disabled" && existing.isDefault) {
        return res.status(409).json({
          message: "This is the method new invoices start on — make another one the default first.",
        });
      }
      await PaymentMethod.updateOne({ code: req.params.code }, { $set: updates });
      invalidatePlatformRegistry();
      res.json({ methods: await paymentState() });
    })
  );

  paymentMethodRouter.post(
    "/:code/default",
    asyncHandler(async (req, res) => {
      const PaymentMethod = getPaymentMethodModel();
      const target = await PaymentMethod.findOne({ code: req.params.code }).lean();
      if (!target) return res.status(404).json({ message: "Payment method not found." });
      if (target.status === "disabled") {
        return res.status(409).json({ message: "A disabled method cannot be the one new invoices start on." });
      }
      await PaymentMethod.updateMany({ code: { $ne: target.code } }, { $set: { isDefault: false } });
      await PaymentMethod.updateOne({ code: target.code }, { $set: { isDefault: true } });
      invalidatePlatformRegistry();
      res.json({ methods: await paymentState() });
    })
  );

  paymentMethodRouter.delete(
    "/:code",
    asyncHandler(async (req, res) => {
      const PaymentMethod = getPaymentMethodModel();
      const existing = await PaymentMethod.findOne({ code: req.params.code }).lean();
      if (!existing) return res.status(404).json({ message: "Payment method not found." });
      if (existing.builtIn) {
        return res.status(409).json({
          message: `"${existing.label}" ships with the platform and can be switched off, but not deleted.`,
        });
      }
      if (existing.isDefault) {
        return res.status(409).json({ message: "Make another method the default first." });
      }
      // Invoices already recorded against it keep the label they were filed
      // under — paymentMode stores the text, not a reference to this row — so
      // deleting one never rewrites anybody's history.
      await PaymentMethod.deleteOne({ code: req.params.code });
      invalidatePlatformRegistry();
      res.json({ methods: await paymentState() });
    })
  );

  // ---------- Approval rules ----------
  //
  // Nothing is seeded. An approval rule stops documents dead until somebody
  // signs them off, so the platform ships with none — approvals exist only
  // where a super admin has deliberately asked for them.
  const approvalRouter = express.Router();
  approvalRouter.use(requireMasterKey);
  approvalRouter.use(adminAuditMiddleware);

  function normalizeApprovalBody(body) {
    const out = {};
    const errors = [];

    if (body.description !== undefined) out.description = String(body.description || "").trim();

    if (body.documentType !== undefined) {
      if (!isValidDocumentType(body.documentType)) {
        errors.push(`"${body.documentType}" is not a document type approvals can govern.`);
      } else {
        out.documentType = body.documentType;
      }
    }

    if (body.condition !== undefined) {
      const found = CONDITIONS.find((c) => c.key === body.condition);
      if (!found) errors.push(`"${body.condition}" is not a condition.`);
      else out.condition = found.key;
    }

    if (body.threshold !== undefined) {
      const n = Number(body.threshold);
      if (Number.isNaN(n) || n < 0) errors.push("The threshold must be a number of 0 or more.");
      else out.threshold = n;
    }

    if (body.approverRoles !== undefined) {
      out.approverRoles = (Array.isArray(body.approverRoles) ? body.approverRoles : [])
        .map((r) => String(r).trim())
        .filter(Boolean);
    }

    if (body.appliesTo !== undefined) {
      if (!APPLIES_TO.includes(body.appliesTo)) errors.push(`"${body.appliesTo}" is not a scope.`);
      else out.appliesTo = body.appliesTo;
    }
    if (body.planCodes !== undefined) {
      out.planCodes = (Array.isArray(body.planCodes) ? body.planCodes : []).map(String).filter(Boolean);
    }
    if (body.subdomains !== undefined) {
      out.subdomains = (Array.isArray(body.subdomains) ? body.subdomains : []).map(String).filter(Boolean);
    }

    if (body.order !== undefined) out.order = Number(body.order) || 0;
    if (body.status !== undefined) out.status = body.status === "disabled" ? "disabled" : "active";

    return { updates: out, errors };
  }

  // A rule scoped to specific plans or clients with nothing listed would match
  // nobody — silently doing nothing is worse than saying so.
  function scopeIsUsable(rule) {
    if (rule.appliesTo === "plans") return (rule.planCodes || []).length > 0;
    if (rule.appliesTo === "clients") return (rule.subdomains || []).length > 0;
    return true;
  }

  approvalRouter.get(
    "/",
    asyncHandler(async (req, res) => {
      const rules = await getApprovalRuleModel().find({}).sort({ order: 1, name: 1 }).lean();
      const [plans, tenants] = await Promise.all([
        getPlanModel().find({}, { code: 1, name: 1 }).lean(),
        getTenantRegistryModel().find({}, { subdomain: 1, companyName: 1 }).lean(),
      ]);
      res.json({
        rules,
        documentTypes: DOCUMENT_TYPES,
        conditions: CONDITIONS,
        appliesTo: APPLIES_TO,
        // So the form can offer real plans and clients rather than free text.
        plans: plans.map((p) => ({ code: p.code, name: p.name })),
        clients: tenants.map((t) => ({ subdomain: t.subdomain, name: t.companyName || t.subdomain })),
      });
    })
  );

  approvalRouter.post(
    "/",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      if (!body.name) return res.status(400).json({ message: "A rule name is required." });
      if (!body.documentType) return res.status(400).json({ message: "Pick which document this governs." });
      const code = slugify(body.code || body.name);
      if (!code) return res.status(400).json({ message: "Could not derive a rule code from that name." });

      const { updates, errors } = normalizeApprovalBody(body);
      if (errors.length) return res.status(400).json({ message: errors.join(" ") });

      const ApprovalRule = getApprovalRuleModel();
      if (await ApprovalRule.findOne({ code })) {
        return res.status(409).json({ message: `A rule with code "${code}" already exists.` });
      }
      const merged = { appliesTo: "all", ...updates, code, name: body.name };
      if (!scopeIsUsable(merged)) {
        return res.status(400).json({ message: "Pick at least one plan or client for this rule to apply to." });
      }
      const last = await ApprovalRule.findOne({}).sort({ order: -1 }).lean();
      const created = await ApprovalRule.create({ ...merged, order: ((last && last.order) || 0) + 10 });
      invalidatePlatformRegistry();
      res.status(201).json(created);
    })
  );

  approvalRouter.put(
    "/:code",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const { updates, errors } = normalizeApprovalBody(body);
      if (errors.length) return res.status(400).json({ message: errors.join(" ") });
      if (body.name) updates.name = String(body.name).trim();

      const ApprovalRule = getApprovalRuleModel();
      const existing = await ApprovalRule.findOne({ code: req.params.code }).lean();
      if (!existing) return res.status(404).json({ message: "Approval rule not found." });

      // Checked against the MERGED rule, so switching scope to "clients"
      // without listing any is caught even though neither field is invalid
      // on its own.
      const merged = { ...existing, ...updates };
      if (!scopeIsUsable(merged)) {
        return res.status(400).json({ message: "Pick at least one plan or client for this rule to apply to." });
      }
      const found = await ApprovalRule.findOneAndUpdate(
        { code: req.params.code },
        { $set: updates },
        { new: true }
      );
      invalidatePlatformRegistry();
      res.json(found);
    })
  );

  approvalRouter.delete(
    "/:code",
    asyncHandler(async (req, res) => {
      const deleted = await getApprovalRuleModel().findOneAndDelete({ code: req.params.code });
      if (!deleted) return res.status(404).json({ message: "Approval rule not found." });
      // Documents already waiting on this rule are NOT auto-approved — they
      // keep their pending state for someone to clear deliberately. Silently
      // releasing a batch of held documents because a rule was tidied away is
      // exactly the kind of surprise an approval step exists to prevent.
      invalidatePlatformRegistry();
      res.json({ success: true });
    })
  );

  // ---------- Notification types ----------
  //
  // Edit-only, like Modules: which notifications EXIST is decided by the
  // reminder builder in reminders.js, because each one is a query over a
  // client's own data. This screen decides which are switched on and how far
  // ahead each looks.
  const notificationRouter = express.Router();
  notificationRouter.use(requireMasterKey);
  notificationRouter.use(adminAuditMiddleware);

  notificationRouter.get(
    "/",
    asyncHandler(async (req, res) => {
      const stored = await getNotificationTypeModel().find({}).lean();
      res.json({ types: resolveNotificationTypes(stored) });
    })
  );

  notificationRouter.put(
    "/:key",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const known = resolveNotificationTypes([]).find((t) => t.key === req.params.key);
      if (!known) return res.status(404).json({ message: "No such notification type." });

      const updates = {};
      if (body.enabled !== undefined) updates.enabled = Boolean(body.enabled);
      if (body.label !== undefined) updates.label = String(body.label || "").trim();
      if (body.leadDays !== undefined) {
        if (body.leadDays === null || body.leadDays === "") {
          // Blank hands the decision back to the client's own setting, which
          // is what "reset" means here.
          updates.leadDays = null;
        } else {
          const n = Number(body.leadDays);
          if (Number.isNaN(n) || n < 0 || n > 365) {
            return res.status(400).json({ message: "Lead time must be between 0 and 365 days." });
          }
          if (!known.supportsLeadDays) {
            return res.status(400).json({
              message: `${known.defaultLabel} is a state, not a date — there is nothing to look ahead to.`,
            });
          }
          updates.leadDays = n;
        }
      }
      await getNotificationTypeModel().findOneAndUpdate(
        { key: req.params.key },
        { $set: updates },
        { new: true, upsert: true }
      );
      invalidatePlatformRegistry();
      const stored = await getNotificationTypeModel().find({}).lean();
      res.json({ types: resolveNotificationTypes(stored) });
    })
  );

  notificationRouter.delete(
    "/:key",
    asyncHandler(async (req, res) => {
      await getNotificationTypeModel().deleteOne({ key: req.params.key });
      invalidatePlatformRegistry();
      const stored = await getNotificationTypeModel().find({}).lean();
      res.json({ types: resolveNotificationTypes(stored) });
    })
  );

  // ---------- Announcements ----------
  //
  // Messages from the platform to its clients, delivered through the same
  // bell the operational reminders use.
  const announcementRouter = express.Router();
  announcementRouter.use(requireMasterKey);
  announcementRouter.use(adminAuditMiddleware);

  function normalizeAnnouncementBody(body) {
    const out = {};
    const errors = [];

    if (body.title !== undefined) {
      const t = String(body.title || "").trim();
      if (!t) errors.push("A title is required.");
      else out.title = t;
    }
    if (body.body !== undefined) out.body = String(body.body || "").trim();

    if (body.link !== undefined) {
      const link = String(body.link || "").trim();
      // Relative paths only. An announcement that could point at an external
      // URL would be a way to send every client's staff somewhere off-site.
      if (link && !link.startsWith("/")) {
        errors.push("A link must be a path inside the app, starting with /.");
      } else {
        out.link = link;
      }
    }

    if (body.severity !== undefined) {
      out.severity = SEVERITIES.includes(body.severity) ? body.severity : "info";
    }
    if (body.audience !== undefined) {
      if (!AUDIENCES.includes(body.audience)) errors.push(`"${body.audience}" is not an audience.`);
      else out.audience = body.audience;
    }
    if (body.planCodes !== undefined) {
      out.planCodes = (Array.isArray(body.planCodes) ? body.planCodes : []).map(String).filter(Boolean);
    }
    if (body.subdomains !== undefined) {
      out.subdomains = (Array.isArray(body.subdomains) ? body.subdomains : []).map(String).filter(Boolean);
    }

    for (const key of ["startsAt", "endsAt"]) {
      if (body[key] === undefined) continue;
      if (!body[key]) {
        out[key] = null;
        continue;
      }
      const d = new Date(body[key]);
      if (Number.isNaN(d.getTime())) errors.push(`"${body[key]}" is not a valid date.`);
      else out[key] = d;
    }

    if (body.status !== undefined) out.status = body.status === "published" ? "published" : "draft";

    return { updates: out, errors };
  }

  function announcementScopeUsable(a) {
    if (a.audience === "plans") return (a.planCodes || []).length > 0;
    if (a.audience === "clients") return (a.subdomains || []).length > 0;
    return true;
  }

  announcementRouter.get(
    "/",
    asyncHandler(async (req, res) => {
      const [announcements, plans, tenants] = await Promise.all([
        getAnnouncementModel().find({}).sort({ createdAt: -1 }).lean(),
        getPlanModel().find({}, { code: 1, name: 1 }).lean(),
        getTenantRegistryModel().find({}, { subdomain: 1, companyName: 1 }).lean(),
      ]);
      res.json({
        announcements,
        severities: SEVERITIES,
        audiences: AUDIENCES,
        plans: plans.map((p) => ({ code: p.code, name: p.name })),
        clients: tenants.map((t) => ({ subdomain: t.subdomain, name: t.companyName || t.subdomain })),
      });
    })
  );

  announcementRouter.post(
    "/",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      if (!body.title) return res.status(400).json({ message: "A title is required." });
      const code = slugify(body.code || body.title);
      if (!code) return res.status(400).json({ message: "Could not derive a code from that title." });

      const { updates, errors } = normalizeAnnouncementBody(body);
      if (errors.length) return res.status(400).json({ message: errors.join(" ") });

      const Announcement = getAnnouncementModel();
      if (await Announcement.findOne({ code })) {
        return res.status(409).json({ message: `An announcement with code "${code}" already exists.` });
      }
      const merged = { audience: "all", status: "draft", ...updates, code, title: body.title };
      if (!announcementScopeUsable(merged)) {
        return res.status(400).json({ message: "Pick at least one plan or client for this announcement." });
      }
      const created = await Announcement.create({
        ...merged,
        createdBy: (req.superAdmin && req.superAdmin.name) || "",
      });
      invalidatePlatformRegistry();
      res.status(201).json(created);
    })
  );

  announcementRouter.put(
    "/:code",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const { updates, errors } = normalizeAnnouncementBody(body);
      if (errors.length) return res.status(400).json({ message: errors.join(" ") });

      const Announcement = getAnnouncementModel();
      const existing = await Announcement.findOne({ code: req.params.code }).lean();
      if (!existing) return res.status(404).json({ message: "Announcement not found." });

      const merged = { ...existing, ...updates };
      if (!announcementScopeUsable(merged)) {
        return res.status(400).json({ message: "Pick at least one plan or client for this announcement." });
      }
      const found = await Announcement.findOneAndUpdate(
        { code: req.params.code },
        { $set: updates },
        { new: true }
      );
      invalidatePlatformRegistry();
      res.json(found);
    })
  );

  announcementRouter.delete(
    "/:code",
    asyncHandler(async (req, res) => {
      const deleted = await getAnnouncementModel().findOneAndDelete({ code: req.params.code });
      if (!deleted) return res.status(404).json({ message: "Announcement not found." });
      invalidatePlatformRegistry();
      res.json({ success: true });
    })
  );

  // ---------- Platform audit trail ----------
  //
  // Read-only, and deliberately so: an audit trail you can edit is not one.
  // There is no delete route either — entries age out only if someone adds a
  // retention policy, which is a decision to take on purpose.
  const auditRouter = express.Router();
  auditRouter.use(requireMasterKey);
  // NOTE: no adminAuditMiddleware here — reading the log is not a change,
  // and logging reads would drown the changes in noise.

  auditRouter.get(
    "/",
    asyncHandler(async (req, res) => {
      const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
      const filter = {};
      if (req.query.area) filter.area = String(req.query.area);
      if (req.query.action) filter.action = String(req.query.action);
      if (req.query.actor) filter.actor = String(req.query.actor);
      const AuditLog = getAdminAuditLogModel();
      const [entries, total] = await Promise.all([
        AuditLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
        AuditLog.countDocuments(filter),
      ]);
      // The filter dropdowns are built from what is actually in the log, so
      // they never offer a value that would return nothing.
      const [areas, actors] = await Promise.all([
        AuditLog.distinct("area"),
        AuditLog.distinct("actor"),
      ]);
      res.json({
        entries: entries.map((e) => ({
          id: String(e._id),
          at: e.createdAt,
          actor: e.actor,
          actorEmail: e.actorEmail,
          area: e.area,
          action: e.action,
          target: e.target,
          method: e.method,
          path: e.path,
          summary: e.summary,
          details: e.details,
          ip: e.ip,
        })),
        total,
        limit,
        areas: areas.filter(Boolean).sort(),
        actors: actors.filter(Boolean).sort(),
        actions: ["create", "update", "delete", "other"],
      });
    })
  );

  // ---------- Demo requests (leads from the public SIPERP website) ----------
  // Read, and move through new -> contacted -> won/lost with a note. There is
  // no delete: a lead list should not lose rows by accident.
  const demoRouter = express.Router();
  demoRouter.use(requireMasterKey);
  demoRouter.use(adminAuditMiddleware);

  demoRouter.get(
    "/",
    asyncHandler(async (req, res) => {
      const filter = {};
      if (["new", "contacted", "won", "lost"].includes(req.query.status)) filter.status = req.query.status;
      const DemoRequest = getDemoRequestModel();
      const [requests, counts] = await Promise.all([
        DemoRequest.find(filter).sort({ createdAt: -1 }).limit(500).lean(),
        DemoRequest.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
      ]);
      res.json({
        requests: requests.map((r) => ({
          id: String(r._id),
          createdAt: r.createdAt,
          name: r.name,
          company: r.company,
          phone: r.phone,
          email: r.email,
          industry: r.industry,
          teamSize: r.teamSize,
          message: r.message,
          kind: r.kind,
          page: r.page,
          status: r.status,
          notes: r.notes,
        })),
        counts: Object.fromEntries(counts.map((c) => [c._id, c.n])),
      });
    })
  );

  demoRouter.put(
    "/:id",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const updates = {};
      if (body.status !== undefined) {
        if (!["new", "contacted", "won", "lost"].includes(body.status)) {
          return res.status(400).json({ message: "Unknown status." });
        }
        updates.status = body.status;
      }
      if (body.notes !== undefined) updates.notes = String(body.notes || "").slice(0, 2000);
      if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(404).json({ message: "Request not found." });
      const updated = await getDemoRequestModel().findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
      if (!updated) return res.status(404).json({ message: "Request not found." });
      res.json({ id: String(updated._id), status: updated.status, notes: updated.notes });
    })
  );

  // The menu catalogue (menus and their sub-pages) for the admin pickers. The
  // client-side /api/permissions/catalogue needs a signed-in client session,
  // which a super admin does not have, so the pickers read this one instead.
  const catalogueRouter = express.Router();
  catalogueRouter.use(requireMasterKey);
  catalogueRouter.get(
    "/",
    asyncHandler(async (req, res) => {
      const registry = await getPlatformRegistry();
      res.json({
        modules: MODULES.map(({ key, label }) => ({
          key,
          label,
          actions: actionsForModule(registry.permissions, key),
        })),
        menuTree: MODULES.map(({ key, label, children }) => ({
          key,
          label,
          children: (children || []).map((c) => ({ key: c.key, label: c.label })),
        })),
        actions: ACTIONS,
        alwaysAllowed: ALWAYS_ALLOWED_ACTION,
      });
    })
  );

  app.use("/api/admin/permission-catalogue", catalogueRouter);
  app.use("/api/admin/demo-requests", demoRouter);
  app.use("/api/admin/plans", planRouter);
  app.use("/api/admin/tenants", router);
  app.use("/api/admin/modules", moduleRouter);
  app.use("/api/admin/add-ons", addOnRouter);
  app.use("/api/admin/global-roles", globalRoleRouter);
  app.use("/api/admin/global-permissions", globalPermissionRouter);
  app.use("/api/admin/menus", menuRouter);
  app.use("/api/admin/themes", themeRouter);
  app.use("/api/admin/invoice-templates", invoiceTemplateRouter);
  app.use("/api/admin/payment-methods", paymentMethodRouter);
  app.use("/api/admin/approval-rules", approvalRouter);
  app.use("/api/admin/notification-types", notificationRouter);
  app.use("/api/admin/announcements", announcementRouter);
  app.use("/api/admin/audit-log", auditRouter);
}

module.exports = { registerTenantAdminRoutes, TERM_MONTHS, DEFAULT_TERM_MONTHS };
