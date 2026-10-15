import { Link, useNavigate } from "react-router-dom";
import { useEmbedded } from "./EmbeddedContext";
import Icon from "../ui/Icon";

// Breadcrumb label -> route. A crumb is rendered as a link only when its exact
// label is found here; anything unmapped (dynamic ids, one-off labels, section
// headings with no landing page) stays as plain text. Keep in sync with the
// routes declared in App.jsx.
const CRUMB_PATHS = {
  Dashboard: "/dashboard",
  Admin: "/admin",
  Clients: "/admin/clients",
  Plans: "/admin/plans",
  "Super Admins": "/admin/super-admins",
  Sessions: "/admin/sessions",
  Reminders: "/reminders",
  "AI Assistant": "/ai/assistant",
  Maintenance: "/maintenance/due",
  "Customer Groups": "/customers/groups",
  "Customer Ledger": "/customers/ledger",
  "Outstanding Receivables": "/customers/outstanding",
  "Supplier Groups": "/suppliers/groups",
  "Supplier Ledger": "/suppliers/ledger",
  "Outstanding Payables": "/suppliers/outstanding",
  "Stock Transfer": "/inventory/stock-transfer",
  "Stock Adjustment": "/inventory/stock-adjustment",
  Quotations: "/sales/quotations",
  "Service Due": "/maintenance/due",
  "Service History": "/maintenance/history",
  "Financial Reports": "/reports/financial",
  "Other Reports": "/reports/other",
  "Email Settings": "/settings/email",
  "Tax Settings": "/settings/tax",
  "Backup & Restore": "/settings/backup",
  More: "/more",

  // sections
  Sales: "/sales",
  Purchase: "/purchase/orders",
  Customers: "/customers",
  Suppliers: "/suppliers",
  Inventory: "/inventory",
  Manufacturing: "/manufacturing/work-orders",
  Reports: "/reports/sales",
  Settings: "/settings",
  "Users & Roles": "/users",

  // customers
  "Customer List": "/customers",

  // suppliers
  "Supplier List": "/suppliers",

  // products
  Products: "/products/items",
  Items: "/products/items",
  Categories: "/products/categories",
  Brands: "/products/brands",

  // inventory
  "Stock Overview": "/inventory",
  "Stock In": "/inventory/stock-in",
  "Stock Out": "/inventory/stock-out",

  // manufacturing
  "Bill of Materials": "/manufacturing/boms",
  "Work Orders": "/manufacturing/work-orders",
  "Job Cards": "/manufacturing/job-cards",
  "Material Issue": "/manufacturing/material-issues",
  "Production Receipt": "/manufacturing/production-receipts",
  "Work Centers": "/manufacturing/work-centers",
  Machines: "/manufacturing/machines",

  // sales
  Enquiries: "/sales/enquiries",
  "Sales Orders": "/sales/orders",
  "Delivery Challan": "/sales/delivery-challan",
  Invoices: "/sales/invoices",
  "Sales Return": "/sales/returns",

  // purchase
  "Purchase Orders": "/purchase/orders",
  "Goods Receipt": "/purchase/goods-receipt",
  "Purchase Invoice": "/purchase/invoices",
  "Purchase Return": "/purchase/returns",

  // reports
  "Sales Reports": "/reports/sales",
  "Purchase Reports": "/reports/purchase",
  "Inventory Reports": "/reports/inventory",

  // settings
  "Company Settings": "/settings/company",
  "General Settings": "/settings/general",
  "Numbering Settings": "/settings/numbering",
  "Invoice Theme": "/settings/invoice-theme",

  // users
  Users: "/users",
  "Roles & Permissions": "/users/roles",
  "Audit Logs": "/users/audit-logs",
};

// `icon` (an Icon name) switches to the redesigned header: a blue icon tile, the
// title and its subtitle, with no back arrow or breadcrumb.
export default function PageHeader({ title, subtitle, crumbs = [], actions, icon }) {
  const navigate = useNavigate();
  const embedded = useEmbedded();
  const lastIndex = crumbs.length - 1;

  if (embedded) return null;

  return (
    <div className="page-header">
      <div className={`page-header-title-row${icon ? " has-icon" : ""}`}>
        {icon ? (
          <span className="page-header-icon">
            <Icon name={icon} size={26} />
          </span>
        ) : (
          <button
            type="button"
            className="page-header-back"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            ‹
          </button>
        )}
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="page-header-sub">{subtitle}</p>}
          <div className="breadcrumb" hidden={Boolean(icon)}>
            {crumbs.map((c, i) => {
              const path = i < lastIndex ? CRUMB_PATHS[c] : null;
              return (
                <span key={i}>
                  {i > 0 && " / "}
                  {i === lastIndex ? (
                    <span className="current">{c}</span>
                  ) : path ? (
                    <Link className="crumb-link" to={path}>
                      {c}
                    </Link>
                  ) : (
                    c
                  )}
                </span>
              );
            })}
          </div>
        </div>
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}
