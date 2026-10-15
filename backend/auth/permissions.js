// Role-based menu + action permissions.
//
// Stored as "<module>.<action>" strings in the existing Role.permissions
// array, so there is no schema migration. The catalogue below is the single
// source of truth: it is served to the UI that draws the checkbox matrix AND
// used by the middleware that enforces it, so the two can never drift.
//
// IMPORTANT — this is not security. Login tokens are not verified by any
// route and the acting role arrives in a client-supplied X-User-Role header,
// so a determined caller can bypass these checks. They exist to keep staff
// out of screens they have no business in, not to defend against an attacker.
// Real enforcement needs verified sessions first.

const ACTIONS = ["view", "create", "edit", "delete"];

// One entry per sidebar menu. `rule` maps API paths onto the module so the
// middleware can work out what a request is touching.
//
// A menu with several sub-pages lists them in `children`, keyed
// "<parent>:<child>". Children are matched BEFORE their parent, so the most
// specific rule wins. A child with no `rule` has no API path of its own — the
// three Settings pages all read the same /api/settings document — so those
// are gated at the menu and route level only and their API calls fall back to
// the parent module.
const MODULES = [
  { key: "dashboard", label: "Dashboard", rule: /^\/api\/dashboard\b/ },
  { key: "reminders", label: "Reminders", rule: /^\/api\/reminders\b/ },
  { key: "ai-assistant", label: "AI Assistant", rule: /^\/api\/ai\b/ },
  { key: "customers", label: "Customers", rule: /^\/api\/(customers|customer-groups)\b/ },
  { key: "suppliers", label: "Suppliers", rule: /^\/api\/(suppliers|supplier-groups)\b/ },
  { key: "products", label: "Products", rule: /^\/api\/(products|categories|brands|items)\b/ },
  {
    key: "purchase",
    label: "Purchase",
    rule: /^\/api\/(purchase-orders|purchase)\b/,
    children: [
      { key: "purchase:orders", label: "Purchase Orders", rule: /^\/api\/purchase-orders\b/ },
      { key: "purchase:goods-receipt", label: "Goods Receipt", rule: /^\/api\/purchase\/goods-receipts\b/ },
      { key: "purchase:invoices", label: "Purchase Invoice", rule: /^\/api\/purchase\/invoices\b/ },
      { key: "purchase:returns", label: "Purchase Return", rule: /^\/api\/purchase\/returns\b/ },
    ],
  },
  {
    key: "inventory",
    label: "Inventory",
    rule: /^\/api\/(inventory|warehouses)\b/,
    children: [
      { key: "inventory:stock-in", label: "Stock In", rule: /^\/api\/inventory\/stock-in\b/ },
      { key: "inventory:stock-out", label: "Stock Out", rule: /^\/api\/inventory\/stock-out\b/ },
      // Listed last so the two specific rules above claim their paths first.
      { key: "inventory:stock", label: "Stock Overview", rule: /^\/api\/(inventory|warehouses)\b/ },
    ],
  },
  {
    key: "manufacturing",
    label: "Manufacturing",
    rule: /^\/api\/manufacturing\b/,
    children: [
      { key: "manufacturing:boms", label: "Bill of Materials", rule: /^\/api\/manufacturing\/boms\b/ },
      { key: "manufacturing:work-orders", label: "Work Orders", rule: /^\/api\/manufacturing\/work-orders\b/ },
      { key: "manufacturing:job-cards", label: "Job Cards", rule: /^\/api\/manufacturing\/job-cards\b/ },
      {
        key: "manufacturing:material-issues",
        label: "Material Issue",
        rule: /^\/api\/manufacturing\/material-issues\b/,
      },
      {
        key: "manufacturing:production-receipts",
        label: "Production Receipt",
        rule: /^\/api\/manufacturing\/production-receipts\b/,
      },
      { key: "manufacturing:work-centers", label: "Work Centers", rule: /^\/api\/manufacturing\/work-centers\b/ },
      { key: "manufacturing:machines", label: "Machines", rule: /^\/api\/manufacturing\/machines\b/ },
    ],
  },
  {
    key: "maintenance",
    label: "Maintenance",
    rule: /^\/api\/maintenance\b/,
    children: [
      { key: "maintenance:due", label: "Service Due" },
      { key: "maintenance:history", label: "Service History" },
    ],
  },
  {
    key: "sales",
    label: "Sales",
    rule: /^\/api\/sales\b/,
    children: [
      { key: "sales:enquiries", label: "Enquiries", rule: /^\/api\/sales\/enquiries\b/ },
      { key: "sales:orders", label: "Sales Orders", rule: /^\/api\/sales\/orders\b/ },
      { key: "sales:delivery-challan", label: "Delivery Challan", rule: /^\/api\/sales\/delivery-challans\b/ },
      { key: "sales:invoices", label: "Invoices", rule: /^\/api\/sales\/invoices\b/ },
      { key: "sales:returns", label: "Sales Return", rule: /^\/api\/sales\/returns\b/ },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    rule: /^\/api\/reports\b/,
    children: [
      { key: "reports:sales", label: "Sales Reports", rule: /^\/api\/reports\/sales-summary\b/ },
      { key: "reports:purchase", label: "Purchase Reports", rule: /^\/api\/reports\/purchase-summary\b/ },
      {
        key: "reports:inventory",
        label: "Inventory Reports",
        rule: /^\/api\/reports\/(inventory-valuation|low-stock)\b/,
      },
    ],
  },
  {
    key: "users",
    label: "Users & Roles",
    rule: /^\/api\/(users|roles|activity-log)\b/,
    children: [
      { key: "users:users", label: "Users", rule: /^\/api\/users\b/ },
      { key: "users:roles", label: "Roles & Permissions", rule: /^\/api\/roles\b/ },
      { key: "users:audit-logs", label: "Audit Logs", rule: /^\/api\/activity-log\b/ },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    rule: /^\/api\/(settings|backup)\b/,
    children: [
      { key: "settings:company", label: "Company Settings" },
      { key: "settings:numbering", label: "Numbering Settings" },
      { key: "settings:invoice-theme", label: "Invoice Theme" },
      { key: "settings:general", label: "General Settings" },
      { key: "settings:email", label: "Email Settings" },
      { key: "settings:whatsapp", label: "WhatsApp Settings" },
      { key: "settings:tax", label: "Tax Settings" },
      { key: "settings:backup", label: "Backup & Restore" },
      { key: "settings:custom-fields", label: "Custom Fields", rule: /^\/api\/custom-fields\b/ },
    ],
  },
];

const ADMIN_ROLE = "Administrator";

// Paths that must stay reachable no matter what a role allows, or the user
// could never sign in, discover their own permissions, or be told their
// subscription lapsed.
const EXEMPT = [
  /^\/api\/auth\b/,
  /^\/api\/health\b/,
  /^\/api\/subscription\/status\b/,
  /^\/api\/me\/permissions\b/,
  /^\/api\/permissions\/catalogue\b/,
  // The sidebar has to be able to draw itself before anything else works, and
  // it carries no data of its own — only labels and icons.
  /^\/api\/menu\b/,
  // Likewise the theme: the login screen is painted with it, before there is
  // a signed-in user to check anything against.
  /^\/api\/theme\b/,
  /^\/api\/admin\b/, // master-key gated separately
];

function isExempt(path) {
  return EXEMPT.some((re) => re.test(path || ""));
}

// "purchase:orders" -> "purchase". A top-level key has no parent.
function parentMenu(key) {
  const i = String(key || "").indexOf(":");
  return i > 0 ? key.slice(0, i) : null;
}

function childKeysOf(parentKey) {
  const m = MODULES.find((x) => x.key === parentKey);
  return m && m.children ? m.children.map((c) => c.key) : [];
}

// Every menu key, parents and children alike.
const ALL_MENU_KEYS = MODULES.flatMap((m) => [m.key, ...(m.children || []).map((c) => c.key)]);

// What the Module registry (models/Module.js) is seeded with the first time
// it is read, and back-filled with whenever a module is added to the
// catalogue above. Only top-level menus get a row — sub-pages are part of
// their parent module commercially, which is how plans already treat them.
//
// Everything is seeded active, not core and not add-on-only, so creating
// these rows changes no client's access by itself.
function moduleSeedRows() {
  return MODULES.map((m, i) => ({
    key: m.key,
    label: m.label,
    order: (i + 1) * 10,
    status: "active",
    core: false,
    addOnOnly: false,
  }));
}

// One row per top-level menu, seeded with EVERY action, so creating the
// Global Permissions registry takes nothing away from anyone. Sub-pages
// inherit their parent's row, exactly as role grants already do.
function permissionSeedRows() {
  return MODULES.map((m) => ({ moduleKey: m.key, actions: [...ACTIONS] }));
}

// Viewing is not this registry's to withhold: a module nobody may view is
// just a module that is switched off, and the Modules kill switch does that
// properly. So view is always granted, and the admin screen shows it locked.
const ALWAYS_ALLOWED_ACTION = "view";

// Which actions a module offers, according to the registry. An absent row
// means "not configured" and allows everything — the same convention plans
// and client overrides already use, so an empty collection changes nothing.
function actionsForModule(permissionDocs, moduleKey) {
  const parent = parentMenu(moduleKey) || moduleKey;
  const row = (permissionDocs || []).find((p) => p.moduleKey === parent);
  if (!row || !Array.isArray(row.actions)) return [...ACTIONS];
  const allowed = new Set(row.actions);
  allowed.add(ALWAYS_ALLOWED_ACTION);
  return ACTIONS.filter((a) => allowed.has(a));
}

// Is this action on offer at all? Applies to every client and every role,
// Administrator included — that is what makes it a platform policy rather
// than a per-client permission.
function globalActionAllowed(permissionDocs, moduleKey, action) {
  if (!moduleKey || !action) return true;
  if (action === ALWAYS_ALLOWED_ACTION) return true;
  return actionsForModule(permissionDocs, moduleKey).includes(action);
}

// Which permission module a request touches, or null when the path isn't
// permission-controlled (in which case it is allowed through). Children are
// tested first so the most specific menu wins.
function moduleKeyForPath(path) {
  const p = path || "";
  for (const m of MODULES) {
    for (const c of m.children || []) {
      if (c.rule && c.rule.test(p)) return c.key;
    }
  }
  for (const m of MODULES) if (m.rule.test(p)) return m.key;
  return null;
}

function actionForMethod(method) {
  switch ((method || "GET").toUpperCase()) {
    case "POST":
      return "create";
    case "PUT":
    case "PATCH":
      return "edit";
    case "DELETE":
      return "delete";
    default:
      return "view";
  }
}

// Every permission string. Roles are still configured at menu level — a
// permission on a parent covers all of its sub-pages — so this stays
// parent-only and the Roles matrix keeps its twelve rows.
function allPermissions() {
  const out = [];
  for (const m of MODULES) for (const a of ACTIONS) out.push(`${m.key}.${a}`);
  return out;
}

function isAdminRole(roleName) {
  return String(roleName || "").trim().toLowerCase() === ADMIN_ROLE.toLowerCase();
}

// A plan with no modules configured unlocks everything. That keeps every
// existing client working until someone deliberately restricts a plan.
//
// Parent and child resolve to each other so both ways of configuring a plan
// behave sensibly:
//   - ticking the parent ("purchase") unlocks all of its sub-pages, which is
//     what every plan saved before sub-menus existed means;
//   - ticking only some children unlocks those, and the parent menu still
//     appears so they are reachable.
function planAllowsModule(planDoc, moduleKey) {
  if (!planDoc) return true; // no plan assigned
  const list = Array.isArray(planDoc.modules) ? planDoc.modules : [];
  if (list.length === 0) return true; // not configured
  if (!moduleKey) return true;
  if (list.includes(moduleKey)) return true;
  const parent = parentMenu(moduleKey);
  if (parent) return list.includes(parent);
  // A parent menu is allowed when any of its children is.
  return childKeysOf(moduleKey).some((c) => list.includes(c));
}

// Same containment rules as planAllowsModule, against a tenant's own
// `modules` override. Empty means the client places no restriction of its own.
function clientAllowsModule(tenantDoc, moduleKey) {
  if (!tenantDoc) return true;
  const list = Array.isArray(tenantDoc.modules) ? tenantDoc.modules : [];
  if (list.length === 0) return true; // no client-level override
  if (!moduleKey) return true;
  if (list.includes(moduleKey)) return true;
  const parent = parentMenu(moduleKey);
  if (parent) return list.includes(parent);
  return childKeysOf(moduleKey).some((c) => list.includes(c));
}

// Does a flat list of menu keys cover this one? Shared by every gate below,
// because they all want the same containment rules: a parent grant covers
// its sub-pages, and a parent menu stays reachable while any one of its
// sub-pages is granted.
function listCovers(list, moduleKey) {
  if (!moduleKey) return false;
  if (list.includes(moduleKey)) return true;
  const parent = parentMenu(moduleKey);
  if (parent) return list.includes(parent);
  return childKeysOf(moduleKey).some((c) => list.includes(c));
}

// Every menu key granted by the add-ons this client has bought. Archived
// add-ons still count for a client already on one — withdrawing a product
// from sale must not silently switch off a menu someone is paying for.
// Removing it from the client is a deliberate act on the client's own row.
function addOnModulesFor(tenantDoc, addOnDocs) {
  const bought = new Set((tenantDoc && tenantDoc.addOns) || []);
  if (bought.size === 0) return [];
  const out = new Set();
  for (const a of addOnDocs || []) {
    if (!bought.has(a.code)) continue;
    for (const k of a.modules || []) out.add(k);
  }
  return [...out];
}

// Add-ons are the ONE thing that widens access past the plan. An add-on
// granting no menus grants nothing — unlike a plan, an empty list here is
// not read as "everything", or an unfinished draft would hand out the app.
function addOnAllowsModule(tenantDoc, addOnDocs, moduleKey) {
  return listCovers(addOnModulesFor(tenantDoc, addOnDocs), moduleKey);
}

// Splits the module registry into the two sets the gates care about. Both
// are keyed on TOP-LEVEL modules, so a flag on "purchase" covers every
// purchase sub-page.
function moduleRegistryIndex(moduleDocs) {
  const disabled = new Set();
  const core = new Set();
  for (const m of moduleDocs || []) {
    if (m.status === "disabled") disabled.add(m.key);
    if (m.core) core.add(m.key);
  }
  return { disabled, core };
}

function inSet(set, moduleKey) {
  if (!moduleKey) return false;
  if (set.has(moduleKey)) return true;
  const parent = parentMenu(moduleKey);
  return parent ? set.has(parent) : false;
}

// What a client can actually reach, in precedence order:
//
//   1. a module disabled platform-wide is gone for everyone, whatever they
//      bought — it is a kill switch, so it outranks every other rule;
//   2. a core module is always reachable, so a client narrowed to two menus
//      still has somewhere to land;
//   3. otherwise they must have BOUGHT it, through the plan or an add-on;
//   4. and the per-client override must not have taken it away again.
//
// Plan and add-ons are a union (add-ons widen); the client override is an
// intersection (it only ever narrows). `registry` is optional throughout, so
// a caller that has not loaded it behaves exactly as before this existed.
function effectiveMenuAllows(planDoc, tenantDoc, moduleKey, registry) {
  if (!moduleKey) return true;
  const reg = registry || {};
  const { disabled, core } = moduleRegistryIndex(reg.modules);
  if (inSet(disabled, moduleKey)) return false;
  if (inSet(core, moduleKey)) return true;
  const bought =
    planAllowsModule(planDoc, moduleKey) || addOnAllowsModule(tenantDoc, reg.addOns, moduleKey);
  return bought && clientAllowsModule(tenantDoc, moduleKey);
}

// Per-menu breakdown of what a client has, for the client-facing "what's on
// my plan" screen (see GET /api/subscription/details in server.js). Not used
// for enforcement — the gates above are the source of truth for that —
// this just describes the same data in a shape a page can render directly.
//
// `extraKeys` are menus granted outside the plan (add-ons, core modules), so
// a client who bought the Manufacturing add-on is not told they don't have
// it. Omitting it gives the plan-only view this had before add-ons existed.
function planMenuSummary(planDoc, extraKeys) {
  const extra = extraKeys || [];
  const granted = (key) => planAllowsModule(planDoc, key) || listCovers(extra, key);
  return MODULES.map((m) => {
    const kids = m.children || [];
    if (!kids.length) {
      return { key: m.key, label: m.label, access: granted(m.key) ? "full" : "none" };
    }
    const children = kids.map((c) => ({
      key: c.key,
      label: c.label,
      allowed: granted(c.key),
    }));
    const allowedCount = children.filter((c) => c.allowed).length;
    const access = allowedCount === 0 ? "none" : allowedCount === children.length ? "full" : "partial";
    return { key: m.key, label: m.label, access, children };
  });
}

// Roles are configured per menu, so a sub-page inherits its parent's grant.
function roleHasPermission(roleDoc, moduleKey, action) {
  if (!roleDoc) return false;
  if (isAdminRole(roleDoc.name)) return true;
  const list = Array.isArray(roleDoc.permissions) ? roleDoc.permissions : [];
  if (list.includes(`${moduleKey}.${action}`)) return true;
  const parent = parentMenu(moduleKey);
  return parent ? list.includes(`${parent}.${action}`) : false;
}

// Starter roles offered behind an explicit "Create default roles" button.
// Deliberately NOT auto-seeded: an empty Roles collection is what tells the
// middleware "not configured yet, allow everything", so silently creating
// roles would switch enforcement on without anyone asking for it.
const DEFAULT_ROLES = [
  {
    name: "Administrator",
    description: "Full access to everything. Always has every permission.",
    permissions: allPermissions(),
  },
  {
    name: "Manager",
    description: "Everything except Users & Roles and Settings.",
    permissions: allPermissions().filter((p) => !p.startsWith("users.") && !p.startsWith("settings.")),
  },
  {
    name: "Accountant",
    description: "Sales, purchase and reports — no shop floor or admin screens.",
    permissions: [
      "dashboard.view", "reminders.view", "reports.view",
      "customers.view", "customers.edit",
      "suppliers.view", "suppliers.edit",
      "sales.view", "sales.create", "sales.edit",
      "purchase.view", "purchase.create", "purchase.edit",
    ],
  },
  {
    name: "Sales Executive",
    description: "Customers and sales only.",
    permissions: [
      "dashboard.view", "reminders.view",
      "customers.view", "customers.create", "customers.edit",
      "products.view",
      "sales.view", "sales.create", "sales.edit",
    ],
  },
  {
    name: "Store Keeper",
    description: "Stock, items, and issuing material to the shop floor.",
    permissions: [
      "dashboard.view", "reminders.view",
      "products.view", "products.create", "products.edit",
      "inventory.view", "inventory.create", "inventory.edit",
      "purchase.view",
      // Issuing raw material and booking finished goods back in are both
      // stores actions, so this role does them without owning production.
      "manufacturing.view", "manufacturing.create", "manufacturing.edit",
    ],
  },
  {
    name: "Production Manager",
    description: "Owns the full manufacturing cycle — BOMs, work orders, work centers and machines.",
    permissions: [
      "dashboard.view", "reminders.view", "reports.view",
      "products.view",
      "inventory.view",
      "manufacturing.view", "manufacturing.create", "manufacturing.edit", "manufacturing.delete",
      "sales.view",
    ],
  },
  {
    name: "Shop Floor Operator",
    description: "Reads work orders and books progress on job cards. Cannot change a BOM.",
    permissions: [
      "dashboard.view", "reminders.view",
      "manufacturing.view", "manufacturing.edit",
      "inventory.view",
    ],
  },
  {
    name: "Viewer",
    description: "Read-only across the app.",
    permissions: MODULES.map((m) => `${m.key}.view`),
  },
];

// What the Global Roles registry is seeded with the first time it is read.
// DEFAULT_ROLES above stays the source, so the eight starter roles become
// editable data instead of a constant nobody can reach — and the client's
// "Create default roles" button reads the registry from then on.
function globalRoleSeedRows() {
  return DEFAULT_ROLES.map((r) => ({
    code: String(r.name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""),
    name: r.name,
    description: r.description,
    permissions: r.permissions,
    // Administrator holds everything by name, so there is nothing here to
    // meaningfully edit — mark it and let the screen say so.
    protected: isAdminRole(r.name),
    status: "active",
  }));
}

module.exports = {
  ACTIONS,
  MODULES,
  ADMIN_ROLE,
  DEFAULT_ROLES,
  ALL_MENU_KEYS,
  isExempt,
  moduleKeyForPath,
  actionForMethod,
  allPermissions,
  isAdminRole,
  roleHasPermission,
  planAllowsModule,
  clientAllowsModule,
  addOnAllowsModule,
  addOnModulesFor,
  moduleRegistryIndex,
  moduleSeedRows,
  globalRoleSeedRows,
  permissionSeedRows,
  actionsForModule,
  globalActionAllowed,
  ALWAYS_ALLOWED_ACTION,
  effectiveMenuAllows,
  planMenuSummary,
  parentMenu,
  childKeysOf,
};
