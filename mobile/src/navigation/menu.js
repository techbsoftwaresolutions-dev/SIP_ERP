// The app's navigation tree — a copy of NAV in
// frontend/src/components/layout/Sidebar.jsx (same keys, modules, roles and
// routes), so Menu Management overrides, plan/add-on gates and role
// permissions hide exactly the same entries on mobile as on the web.
export const STOCK_MOVE_ROLES = ["Administrator", "Inventory Manager"];

export const NAV = [
  { key: "dashboard", label: "Dashboard", icon: "home", to: "/dashboard", module: "dashboard" },
  { key: "ai-assistant", label: "AI Assistant", icon: "sparkles", to: "/ai/assistant", roles: ["Administrator"], module: "ai-assistant" },
  { key: "reminders", label: "Reminders", icon: "bell", to: "/reminders", module: "reminders" },
  {
    label: "Customers",
    icon: "users",
    module: "customers",
    children: [
      { key: "customers:list", label: "Customer List", icon: "users", to: "/customers" },
      { key: "customers:groups", label: "Customer Groups", icon: "users", to: "/customers/groups" },
      { key: "customers:ledger", label: "Customer Ledger", icon: "file", to: "/customers/ledger" },
      { key: "customers:outstanding", label: "Outstanding Receivables", icon: "banknote", to: "/customers/outstanding" },
    ],
  },
  {
    label: "Suppliers",
    icon: "truck",
    module: "suppliers",
    children: [
      { key: "suppliers:list", label: "Supplier List", icon: "truck", to: "/suppliers" },
      { key: "suppliers:groups", label: "Supplier Groups", icon: "truck", to: "/suppliers/groups" },
      { key: "suppliers:ledger", label: "Supplier Ledger", icon: "file", to: "/suppliers/ledger" },
      { key: "suppliers:outstanding", label: "Outstanding Payables", icon: "banknote", to: "/suppliers/outstanding" },
    ],
  },
  {
    label: "Products",
    icon: "package",
    module: "products",
    children: [
      { key: "products:items", label: "Items", icon: "tag", to: "/products/items" },
      { key: "products:categories", label: "Categories", icon: "package", to: "/products/categories" },
      { key: "products:brands", label: "Brands", icon: "store", to: "/products/brands" },
    ],
  },
  {
    label: "Purchase",
    icon: "cart",
    module: "purchase",
    children: [
      { label: "Purchase Orders", icon: "file", to: "/purchase/orders", module: "purchase:orders" },
      { label: "Goods Receipt", icon: "download", to: "/purchase/goods-receipt", module: "purchase:goods-receipt" },
      { label: "Purchase Invoice", icon: "banknote", to: "/purchase/invoices", module: "purchase:invoices" },
      { label: "Purchase Return", icon: "arrowLeft", to: "/purchase/returns", module: "purchase:returns" },
    ],
  },
  {
    label: "Inventory",
    icon: "chart",
    module: "inventory",
    children: [
      { label: "Stock Overview", icon: "eye", to: "/inventory", module: "inventory:stock" },
      { label: "Stock In", icon: "download", to: "/inventory/stock-in", module: "inventory:stock-in", roles: STOCK_MOVE_ROLES },
      { label: "Stock Out", icon: "upload", to: "/inventory/stock-out", module: "inventory:stock-out", roles: STOCK_MOVE_ROLES },
      { key: "inventory:stock-transfer", label: "Stock Transfer", icon: "arrowLeft", to: "/inventory/stock-transfer" },
      { key: "inventory:stock-adjustment", label: "Stock Adjustment", icon: "wrench", to: "/inventory/stock-adjustment" },
    ],
  },
  {
    label: "Manufacturing",
    icon: "wrench",
    module: "manufacturing",
    children: [
      { label: "Bill of Materials", icon: "package", to: "/manufacturing/boms", module: "manufacturing:boms" },
      { label: "Work Orders", icon: "file", to: "/manufacturing/work-orders", module: "manufacturing:work-orders" },
      { label: "Job Cards", icon: "tag", to: "/manufacturing/job-cards", module: "manufacturing:job-cards" },
      { label: "Material Issue", icon: "upload", to: "/manufacturing/material-issues", module: "manufacturing:material-issues" },
      { label: "Production Receipt", icon: "download", to: "/manufacturing/production-receipts", module: "manufacturing:production-receipts" },
      { label: "Work Centers", icon: "store", to: "/manufacturing/work-centers", module: "manufacturing:work-centers" },
      { label: "Machines", icon: "settings", to: "/manufacturing/machines", module: "manufacturing:machines" },
    ],
  },
  {
    key: "maintenance",
    label: "Maintenance",
    icon: "wrench",
    children: [
      { key: "maintenance:due", label: "Service Due", icon: "calendar", to: "/maintenance/due" },
      { key: "maintenance:history", label: "Service History", icon: "file", to: "/maintenance/history" },
    ],
  },
  {
    label: "Sales",
    icon: "coins",
    module: "sales",
    children: [
      // mainAdminOnly on the web (TechB's own host). A tenant signing in on
      // mobile is never on that host, so the gate is kept as-is.
      { label: "Enquiries", icon: "mail", to: "/sales/enquiries", module: "sales:enquiries", mainAdminOnly: true },
      { key: "sales:quotations", label: "Quotations", icon: "file", to: "/sales/quotations" },
      { label: "Sales Orders", icon: "cart", to: "/sales/orders", module: "sales:orders" },
      { label: "Delivery Challan", icon: "truck", to: "/sales/delivery-challan", module: "sales:delivery-challan" },
      { label: "Invoices", icon: "banknote", to: "/sales/invoices", module: "sales:invoices" },
      { label: "Sales Return", icon: "arrowLeft", to: "/sales/returns", module: "sales:returns" },
    ],
  },
  {
    label: "Reports",
    icon: "trending",
    module: "reports",
    children: [
      { label: "Sales Reports", icon: "coins", to: "/reports/sales", module: "reports:sales" },
      { label: "Purchase Reports", icon: "cart", to: "/reports/purchase", module: "reports:purchase" },
      { label: "Inventory Reports", icon: "chart", to: "/reports/inventory", module: "reports:inventory" },
      { key: "reports:financial", label: "Financial Reports", icon: "banknote", to: "/reports/financial" },
      { key: "reports:other", label: "Other Reports", icon: "file", to: "/reports/other" },
    ],
  },
  {
    label: "Users & Roles",
    icon: "user",
    module: "users",
    children: [
      { label: "Users", icon: "user", to: "/users", module: "users:users" },
      { label: "Roles & Permissions", icon: "settings", to: "/users/roles", module: "users:roles" },
      { label: "Audit Logs", icon: "file", to: "/users/audit-logs", module: "users:audit-logs", roles: ["Administrator"] },
    ],
  },
  { label: "Settings", icon: "settings", module: "settings", to: "/settings" },
];

function keyOf(item) {
  return item.key || item.module || "";
}

function applyMenuConfig(items, config) {
  if (!config || config.size === 0) return items;
  return items
    .map((item) => {
      const o = config.get(keyOf(item));
      const next = o ? { ...item, label: o.label || item.label, icon: o.icon || item.icon } : { ...item };
      next.__order = o && typeof o.order === "number" ? o.order : Number.MAX_SAFE_INTEGER;
      next.__hidden = Boolean(o && o.hidden);
      if (item.children) next.children = applyMenuConfig(item.children, config);
      return next;
    })
    .filter((item) => !item.__hidden)
    .map((item, i) => ({ item, i }))
    .sort((a, b) => a.item.__order - b.item.__order || a.i - b.i)
    .map(({ item }) => item);
}

// The same filtering the web Sidebar applies.
export function visibleNav({ can, menuConfig, role }) {
  const mainAdminHost = false;
  const ok = (item) => (!item.mainAdminOnly || mainAdminHost) && (!item.roles || item.roles.includes(role)) && can(item.module, "view");
  return applyMenuConfig(NAV, menuConfig)
    .filter((item) => item.children || ok(item))
    .map((item) => (item.children ? { ...item, children: item.children.filter(ok) } : item))
    .filter((item) => !item.children || (can(item.module, "view") && item.children.length > 0));
}

// Is a given web path reachable for this user? Used by shortcuts (dashboard
// "View all", Sales hub tiles) so they never lead to a hidden page.
export function canReach(path, ctx) {
  for (const item of visibleNav(ctx)) {
    if (item.to === path) return true;
    if (item.children && item.children.some((c) => c.to === path)) return true;
  }
  return false;
}
