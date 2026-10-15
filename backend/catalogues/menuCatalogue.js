// The sidebar's shape, as the platform ships it.
//
// This is deliberately a DESCRIPTOR list, not a copy of the navigation: no
// routes live here. Paths stay in frontend/src/components/Sidebar.jsx, because
// a path only means anything next to the route that serves it, and a menu
// registry that could point an item at a URL with no page behind it would be
// a way to break navigation from an admin screen.
//
// What this carries is IDENTITY and DEFAULT PRESENTATION: a stable key per
// item, the label and icon it ships with, and which group it belongs to. The
// Menu Management screen stores overrides against these keys (models/MenuItem.js),
// and the sidebar applies them by key — so an item the registry has never
// heard of simply renders as it always did.
//
// `module` names the permission module an item is gated by, for reference on
// the admin screen. It is NOT what gates the item at runtime; the sidebar and
// the middleware both do that from MODULES in permissions.js.

const MENU_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: "home", module: "dashboard" },
  { key: "ai-assistant", label: "AI Assistant", icon: "sparkles", module: "ai-assistant" },
  { key: "reminders", label: "Reminders", icon: "bell", module: "reminders" },

  { key: "customers", label: "Customers", icon: "users", module: "customers" },
  { key: "customers:list", label: "Customer List", icon: "users", parent: "customers" },
  { key: "customers:groups", label: "Customer Groups", icon: "users", parent: "customers" },
  { key: "customers:ledger", label: "Customer Ledger", icon: "file", parent: "customers" },
  { key: "customers:outstanding", label: "Outstanding Receivables", icon: "banknote", parent: "customers" },

  { key: "suppliers", label: "Suppliers", icon: "truck", module: "suppliers" },
  { key: "suppliers:list", label: "Supplier List", icon: "truck", parent: "suppliers" },
  { key: "suppliers:groups", label: "Supplier Groups", icon: "truck", parent: "suppliers" },
  { key: "suppliers:ledger", label: "Supplier Ledger", icon: "file", parent: "suppliers" },
  { key: "suppliers:outstanding", label: "Outstanding Payables", icon: "banknote", parent: "suppliers" },

  { key: "products", label: "Products", icon: "package", module: "products" },
  { key: "products:items", label: "Items", icon: "tag", parent: "products" },
  { key: "products:categories", label: "Categories", icon: "package", parent: "products" },
  { key: "products:brands", label: "Brands", icon: "store", parent: "products" },

  { key: "purchase", label: "Purchase", icon: "cart", module: "purchase" },
  { key: "purchase:orders", label: "Purchase Orders", icon: "file", parent: "purchase", module: "purchase:orders" },
  {
    key: "purchase:goods-receipt",
    label: "Goods Receipt",
    icon: "download",
    parent: "purchase",
    module: "purchase:goods-receipt",
  },
  {
    key: "purchase:invoices",
    label: "Purchase Invoice",
    icon: "banknote",
    parent: "purchase",
    module: "purchase:invoices",
  },
  {
    key: "purchase:returns",
    label: "Purchase Return",
    icon: "arrowLeft",
    parent: "purchase",
    module: "purchase:returns",
  },

  { key: "inventory", label: "Inventory", icon: "chart", module: "inventory" },
  { key: "inventory:stock", label: "Stock Overview", icon: "eye", parent: "inventory", module: "inventory:stock" },
  {
    key: "inventory:stock-in",
    label: "Stock In",
    icon: "download",
    parent: "inventory",
    module: "inventory:stock-in",
  },
  {
    key: "inventory:stock-out",
    label: "Stock Out",
    icon: "upload",
    parent: "inventory",
    module: "inventory:stock-out",
  },
  { key: "inventory:stock-transfer", label: "Stock Transfer", icon: "arrowLeft", parent: "inventory" },
  { key: "inventory:stock-adjustment", label: "Stock Adjustment", icon: "wrench", parent: "inventory" },

  { key: "manufacturing", label: "Manufacturing", icon: "wrench", module: "manufacturing" },
  {
    key: "manufacturing:boms",
    label: "Bill of Materials",
    icon: "package",
    parent: "manufacturing",
    module: "manufacturing:boms",
  },
  {
    key: "manufacturing:work-orders",
    label: "Work Orders",
    icon: "file",
    parent: "manufacturing",
    module: "manufacturing:work-orders",
  },
  {
    key: "manufacturing:job-cards",
    label: "Job Cards",
    icon: "tag",
    parent: "manufacturing",
    module: "manufacturing:job-cards",
  },
  {
    key: "manufacturing:material-issues",
    label: "Material Issue",
    icon: "upload",
    parent: "manufacturing",
    module: "manufacturing:material-issues",
  },
  {
    key: "manufacturing:production-receipts",
    label: "Production Receipt",
    icon: "download",
    parent: "manufacturing",
    module: "manufacturing:production-receipts",
  },
  {
    key: "manufacturing:work-centers",
    label: "Work Centers",
    icon: "store",
    parent: "manufacturing",
    module: "manufacturing:work-centers",
  },
  {
    key: "manufacturing:machines",
    label: "Machines",
    icon: "settings",
    parent: "manufacturing",
    module: "manufacturing:machines",
  },

  { key: "maintenance", label: "Maintenance", icon: "wrench", module: "maintenance" },
  { key: "maintenance:due", label: "Service Due", icon: "calendar", parent: "maintenance", module: "maintenance:due" },
  {
    key: "maintenance:history",
    label: "Service History",
    icon: "file",
    parent: "maintenance",
    module: "maintenance:history",
  },

  { key: "sales", label: "Sales", icon: "coins", module: "sales" },
  { key: "sales:enquiries", label: "Enquiries", icon: "mail", parent: "sales", module: "sales:enquiries" },
  { key: "sales:quotations", label: "Quotations", icon: "file", parent: "sales" },
  { key: "sales:orders", label: "Sales Orders", icon: "cart", parent: "sales", module: "sales:orders" },
  {
    key: "sales:delivery-challan",
    label: "Delivery Challan",
    icon: "truck",
    parent: "sales",
    module: "sales:delivery-challan",
  },
  { key: "sales:invoices", label: "Invoices", icon: "banknote", parent: "sales", module: "sales:invoices" },
  { key: "sales:returns", label: "Sales Return", icon: "arrowLeft", parent: "sales", module: "sales:returns" },

  { key: "reports", label: "Reports", icon: "trending", module: "reports" },
  { key: "reports:sales", label: "Sales Reports", icon: "coins", parent: "reports", module: "reports:sales" },
  { key: "reports:purchase", label: "Purchase Reports", icon: "cart", parent: "reports", module: "reports:purchase" },
  {
    key: "reports:inventory",
    label: "Inventory Reports",
    icon: "chart",
    parent: "reports",
    module: "reports:inventory",
  },
  { key: "reports:financial", label: "Financial Reports", icon: "banknote", parent: "reports" },
  { key: "reports:other", label: "Other Reports", icon: "file", parent: "reports" },

  { key: "users", label: "Users & Roles", icon: "user", module: "users" },
  { key: "users:users", label: "Users", icon: "user", parent: "users", module: "users:users" },
  {
    key: "users:roles",
    label: "Roles & Permissions",
    icon: "settings",
    parent: "users",
    module: "users:roles",
  },
  { key: "users:audit-logs", label: "Audit Logs", icon: "file", parent: "users", module: "users:audit-logs" },

  { key: "settings", label: "Settings", icon: "settings", module: "settings" },
  {
    key: "settings:company",
    label: "Company Settings",
    icon: "store",
    parent: "settings",
    module: "settings:company",
  },
  {
    key: "settings:numbering",
    label: "Numbering Settings",
    icon: "tag",
    parent: "settings",
    module: "settings:numbering",
  },
  {
    key: "settings:invoice-theme",
    label: "Invoice Theme",
    icon: "palette",
    parent: "settings",
    module: "settings:invoice-theme",
  },
  {
    key: "settings:general",
    label: "General Settings",
    icon: "settings",
    parent: "settings",
    module: "settings:general",
  },
  { key: "settings:email", label: "Email Settings", icon: "mail", parent: "settings" },
  { key: "settings:whatsapp", label: "WhatsApp Settings", icon: "whatsapp", parent: "settings" },
  { key: "settings:tax", label: "Tax Settings", icon: "banknote", parent: "settings" },
  { key: "settings:backup", label: "Backup & Restore", icon: "download", parent: "settings" },
  { key: "settings:custom-fields", label: "Custom Fields", icon: "edit", parent: "settings" },
];

// Icons the Menu Management screen offers. Kept to what frontend Icon.jsx
// actually draws — offering a name it cannot render would put an empty square
// in a client's sidebar.
const MENU_ICONS = [
  "home", "users", "user", "truck", "package", "cart", "bag", "store",
  "chart", "trending", "coins", "banknote", "wallet", "tag", "file",
  "settings", "wrench", "lock", "calendar", "bell", "image", "palette",
  "mail", "phone", "whatsapp", "share", "sparkles", "eye", "printer",
  "upload", "download", "search", "filter", "arrowLeft", "checkCircle",
  "alertCircle", "alertTriangle",
];

// Default ordering: catalogue position, in tens so an item can be slotted
// between two others without renumbering everything around it.
function menuSeedRows() {
  const perParent = new Map();
  return MENU_ITEMS.map((m) => {
    const group = m.parent || "";
    const n = (perParent.get(group) || 0) + 1;
    perParent.set(group, n);
    return {
      key: m.key,
      label: m.label,
      icon: m.icon,
      parentKey: m.parent || "",
      order: n * 10,
      hidden: false,
    };
  });
}

// Merges the stored overrides onto the shipped catalogue. An item with no row
// falls back to exactly what it ships with, so an empty collection renders the
// sidebar the platform has always rendered.
function resolveMenu(menuDocs) {
  const seeds = menuSeedRows();
  const byKey = new Map((menuDocs || []).map((d) => [d.key, d]));
  return seeds
    .map((seed) => {
      const o = byKey.get(seed.key) || {};
      const source = MENU_ITEMS.find((m) => m.key === seed.key) || {};
      return {
        key: seed.key,
        parentKey: seed.parentKey,
        module: source.module || "",
        label: o.label || seed.label,
        icon: o.icon || seed.icon,
        order: o.order === undefined || o.order === null ? seed.order : o.order,
        hidden: Boolean(o.hidden),
        // What it ships with, so the admin screen can show what "reset" means
        // and mark an item that has been changed.
        defaultLabel: seed.label,
        defaultIcon: seed.icon,
      };
    })
    .sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
}

module.exports = { MENU_ITEMS, MENU_ICONS, menuSeedRows, resolveMenu };
