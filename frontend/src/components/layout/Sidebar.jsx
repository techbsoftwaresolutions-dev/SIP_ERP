import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import api from "../../api/client";
import Icon from "../ui/Icon";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../context/PermissionsContext";

// Roles allowed to see/use Stock In & Stock Out.
export const STOCK_MOVE_ROLES = ["Administrator", "Inventory Manager"];

// The sidebar's structure and its ROUTES. Labels, icons, order and
// visibility are only the defaults: Menu Management (super admin) can
// override them, and /api/menu serves the result keyed by `key`.
//
// Paths deliberately stay here rather than in the registry — a path only
// means anything next to the route that serves it, and a menu row that
// could repoint an item would be a way to break navigation from an admin
// screen. `key` mirrors backend/menuCatalogue.js; where an item has a
// `module` the two are the same string, so it is not repeated.
const NAV = [
  { key: "dashboard", label: "Dashboard", icon: "home", to: "/dashboard", module: "dashboard" },
  { key: "ai-assistant", label: "AI Assistant", icon: "sparkles", to: "/ai/assistant", roles: ["Administrator"], module: "ai-assistant" },
  { key: "reminders", label: "Reminders", icon: "bell", to: "/reminders", module: "reminders" },
  // "My Subscription" deliberately lives in the profile menu (Topbar.jsx),
  // not here and not under Settings: the Settings group is gated on the
  // `settings` module, so a restrictive plan would hide the one page that
  // tells a client what their plan actually is.
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
      {
        label: "Material Issue",
        icon: "upload",
        to: "/manufacturing/material-issues",
        module: "manufacturing:material-issues",
      },
      {
        label: "Production Receipt",
        icon: "download",
        to: "/manufacturing/production-receipts",
        module: "manufacturing:production-receipts",
      },
      { label: "Work Centers", icon: "store", to: "/manufacturing/work-centers", module: "manufacturing:work-centers" },
      { label: "Machines", icon: "settings", to: "/manufacturing/machines", module: "manufacturing:machines" },
    ],
  },
  {
    key: "maintenance",
    label: "Maintenance",
    icon: "wrench",
    module: "maintenance",
    children: [
      { key: "maintenance:due", label: "Service Due", icon: "calendar", to: "/maintenance/due", module: "maintenance:due" },
      { key: "maintenance:history", label: "Service History", icon: "file", to: "/maintenance/history", module: "maintenance:history" },
    ],
  },
  {
    label: "Sales",
    icon: "coins",
    module: "sales",
    children: [
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
  {
    label: "Settings",
    icon: "settings",
    module: "settings",
    to: "/settings",
  },
];

// "Manage Clients" only makes sense on TechB's own admin panel — every
// other client's frontend is served from its own subdomain and should never
// even show a menu for managing OTHER clients (they're already locked out
// of actually using it by the master key, but there's no reason to display
// it to them at all).
function isMainAdminHost() {
  const first = window.location.hostname.split(".")[0];
  return first === "crm" || first === "localhost";
}

// An item is addressed by its own key, or by its module where the two are
// the same string. Anything the registry has never heard of keeps whatever
// the code gives it.
function keyOf(item) {
  return item.key || item.module || "";
}

// Overlays what Menu Management has configured onto the shipped navigation.
// Structure and routes are never touched — only the label, the icon, the
// order, and whether an item is listed at all.
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
    // A stable sort: items the registry has not reordered keep the order the
    // code lists them in, rather than jumping to the front.
    .map((item, i) => ({ item, i }))
    .sort((a, b) => a.item.__order - b.item.__order || a.i - b.i)
    .map(({ item }) => item);
}

export default function Sidebar({ open = false, onClose }) {
  const location = useLocation();
  const { user } = useAuth();
  const { can } = usePermissions();
  const [logo, setLogo] = useState("");
  // Menu Management's overrides, keyed by menu key. Empty until it arrives,
  // and left empty if the call fails — the sidebar then renders exactly as
  // the code defines it rather than not rendering at all.
  const [menuConfig, setMenuConfig] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const mainAdminHost = isMainAdminHost();
  const nav = applyMenuConfig(NAV, menuConfig)
    // Top-level leaf items may carry their own `roles` / `mainAdminOnly` gate.
    .filter(
      (item) =>
        item.children ||
        ((!item.mainAdminOnly || mainAdminHost) &&
          (!item.roles || item.roles.includes(user?.role)) &&
          can(item.module, "view"))
    )
    .map((item) =>
      item.children
        ? {
            ...item,
            children: item.children.filter(
              (c) =>
                (!c.mainAdminOnly || mainAdminHost) &&
                (!c.roles || c.roles.includes(user?.role)) &&
                // A sub-page the plan or the role excludes disappears on its
                // own, even when the rest of the menu is available.
                can(c.module, "view")
            ),
          }
        : item
    )
    // A group whose module is denied disappears entirely, as does any group
    // left with no visible children.
    .filter((item) => !item.children || (can(item.module, "view") && item.children.length > 0));
  const [openGroups, setOpenGroups] = useState(() => {
    const initial = {};
    nav.forEach((item) => {
      if (item.children && item.children.some((c) => location.pathname.startsWith(c.to))) {
        initial[keyOf(item)] = true;
      }
    });
    return initial;
  });

  useEffect(() => {
    api
      .get("/api/menu")
      .then((r) => setMenuConfig(new Map((r.menu || []).map((m) => [m.key, m]))))
      .catch(() => setMenuConfig(null));
  }, []);

  useEffect(() => {
    const loadLogo = () => {
      api
        .get("/api/settings")
        .then((s) => {
          setLogo((s && s.logo) || "");
          setCompanyName((s && s.companyName) || "");
        })
        .catch(() => { });
    };
    loadLogo();
    window.addEventListener("company-logo-updated", loadLogo);
    return () => window.removeEventListener("company-logo-updated", loadLogo);
  }, [location.pathname]);

  const toggleGroup = (key) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${open ? "mobile-open" : ""}`}>
        <div className="sidebar-brand">
          {/* Only ever the client's own branding: their uploaded logo, else
              their company name. Nothing is shown until one of those is set
              in Settings > Company — no stand-in mark, no placeholder name. */}
          {logo ? (
            <img src={logo} alt={companyName || "Company logo"} className="sidebar-brand-logo-full" />
          ) : companyName ? (
            <span className="sidebar-brand-text-only">{companyName}</span>
          ) : null}
          <button type="button" className="sidebar-close-btn" onClick={onClose} aria-label="Close menu"><Icon name="close" size={16} /></button>
        </div>
        <nav className="sidebar-nav">
          {nav.map((item) =>
            item.children ? (
              <div key={keyOf(item)}>
                {/* A group holding the current page is marked "open", not
                    "active" — the solid blue pill is reserved for the one
                    item you are actually on, so the nav never shows two. */}
                <div
                  className={`nav-item ${item.children.some((c) => location.pathname.startsWith(c.to)) ? "open" : ""}`}
                  onClick={() => toggleGroup(keyOf(item))}
                  role="button"
                  tabIndex={0}
                >
                  <span className="icon"><Icon name={item.icon} size={17} /></span>
                  <span title={item.label}>{item.label}</span>
                  <span className="chevron"><Icon name={openGroups[keyOf(item)] ? "chevronDown" : "chevronRight"} size={12} /></span>
                </div>
                {openGroups[keyOf(item)] && (
                  <div className="nav-group-items">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        end={child.to === "/customers" || child.to === "/suppliers" || child.to === "/inventory"}
                        className={({ isActive }) => `nav-subitem ${isActive ? "active" : ""}`}
                      >
                        <span className="icon"><Icon name={child.icon} size={15} /></span>
                        {/* title so a label the sidebar has to ellipsise is
                            still readable on hover. */}
                        <span title={child.label}>{child.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                <span className="icon"><Icon name={item.icon} size={17} /></span>
                <span>{item.label}</span>
              </NavLink>
            )
          )}
        </nav>
      </aside>
    </>
  );
}
