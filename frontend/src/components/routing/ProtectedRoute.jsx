import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSubscription } from "../../context/SubscriptionContext";
import { usePermissions } from "../../context/PermissionsContext";
import SubscriptionBlocked from "../layout/SubscriptionBlocked";

// Which menu a route belongs to. Most specific first, so a sub-page claims
// its path before the parent menu does. This wrapper sits around the whole
// Layout, so deriving the menu here gates every child route at once — a menu
// a plan or a role excludes can't be reached by typing its URL either.
//
// /subscription is deliberately absent from this list: a client must always
// be able to see what plan they're on, even one restrictive enough to hide
// Settings entirely, so it stays ungated (menuForPath returns null for it).
const PATH_RULES = [
  [/^\/sales\/invoices\b/, "sales:invoices"],
  [/^\/sales\/delivery-challans?\b/, "sales:delivery-challan"],
  [/^\/sales\/orders\b/, "sales:orders"],
  [/^\/sales\/enquiries\b/, "sales:enquiries"],
  [/^\/sales\/returns\b/, "sales:returns"],
  [/^\/purchase\/orders\b/, "purchase:orders"],
  [/^\/purchase\/goods-receipt\b/, "purchase:goods-receipt"],
  [/^\/purchase\/invoices\b/, "purchase:invoices"],
  [/^\/purchase\/returns\b/, "purchase:returns"],
  [/^\/inventory\/stock-in\b/, "inventory:stock-in"],
  [/^\/inventory\/stock-out\b/, "inventory:stock-out"],
  [/^\/manufacturing\/boms\b/, "manufacturing:boms"],
  [/^\/manufacturing\/work-orders\b/, "manufacturing:work-orders"],
  [/^\/manufacturing\/job-cards\b/, "manufacturing:job-cards"],
  [/^\/manufacturing\/material-issues\b/, "manufacturing:material-issues"],
  [/^\/manufacturing\/production-receipts\b/, "manufacturing:production-receipts"],
  [/^\/manufacturing\/work-centers\b/, "manufacturing:work-centers"],
  [/^\/manufacturing\/machines\b/, "manufacturing:machines"],
  [/^\/reports\/sales\b/, "reports:sales"],
  [/^\/reports\/purchase\b/, "reports:purchase"],
  [/^\/reports\/inventory\b/, "reports:inventory"],
  [/^\/users\/roles\b/, "users:roles"],
  [/^\/users\/(audit-logs|activity-log)\b/, "users:audit-logs"],
  [/^\/settings\/company\b/, "settings:company"],
  [/^\/settings\/numbering\b/, "settings:numbering"],
  [/^\/settings\/invoice-theme\b/, "settings:invoice-theme"],
  [/^\/settings\/general\b/, "settings:general"],
  [/^\/settings\/email\b/, "settings:email"],
  [/^\/settings\/whatsapp\b/, "settings:whatsapp"],
  [/^\/settings\/tax\b/, "settings:tax"],
  [/^\/settings\/backup\b/, "settings:backup"],
  [/^\/settings\/custom-fields\b/, "settings:custom-fields"],
  [/^\/maintenance\/due\b/, "maintenance:due"],
  [/^\/maintenance\/history\b/, "maintenance:history"],
  // Parents last.
  [/^\/dashboard\b/, "dashboard"],
  [/^\/reminders\b/, "reminders"],
  [/^\/ai\b/, "ai-assistant"],
  [/^\/customers\b/, "customers"],
  [/^\/suppliers\b/, "suppliers"],
  [/^\/products\b/, "products"],
  [/^\/purchase\b/, "purchase"],
  [/^\/inventory\b/, "inventory:stock"],
  [/^\/manufacturing\b/, "manufacturing"],
  [/^\/maintenance\b/, "maintenance"],
  [/^\/sales\b/, "sales"],
  [/^\/reports\b/, "reports"],
  [/^\/users\b/, "users:users"],
  [/^\/settings\b/, "settings"],
];

function menuForPath(pathname) {
  for (const [re, key] of PATH_RULES) if (re.test(pathname || "")) return key;
  return null;
}

// Every menu that can be a landing page, with the route that opens it — used
// only to pick somewhere to send a user who may not be where they are.
const MODULE_PATHS = {
  dashboard: "/dashboard",
  reminders: "/reminders",
  customers: "/customers",
  suppliers: "/suppliers",
  products: "/products/items",
  "purchase:orders": "/purchase/orders",
  "purchase:goods-receipt": "/purchase/goods-receipt",
  "purchase:invoices": "/purchase/invoices",
  "purchase:returns": "/purchase/returns",
  "inventory:stock": "/inventory",
  "manufacturing:work-orders": "/manufacturing/work-orders",
  "manufacturing:boms": "/manufacturing/boms",
  "sales:invoices": "/sales/invoices",
  "sales:orders": "/sales/orders",
  "sales:delivery-challan": "/sales/delivery-challan",
  "reports:sales": "/reports/sales",
  "users:users": "/users",
  "settings:company": "/settings/company",
};
const MODULE_ORDER = Object.keys(MODULE_PATHS);

// `roles`, when given, restricts the route to users whose role is in the
// list. `module` overrides the path-derived menu for a route that doesn't
// follow the usual URL shape.
export default function ProtectedRoute({ children, roles, module }) {
  const { isAuthenticated, user } = useAuth();
  const { can, loading: permsLoading } = usePermissions();
  const { blocked, loading } = useSubscription();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  // Subscription gate sits here rather than in Layout so it also covers the
  // standalone print routes, which render outside the app shell. Checked after
  // auth (an unauthenticated visitor still belongs on /login) and before roles.
  if (!loading && blocked) {
    return <SubscriptionBlocked />;
  }

  // Where to send someone who may not be here. Normally the dashboard, but a
  // plan can exclude the Dashboard menu too — redirecting there would then
  // bounce forever, so fall back to the first menu this user can actually
  // open, and to a plain notice if there is none.
  const fallback = MODULE_ORDER.find((m) => can(m, "view"));
  const bounce = fallback ? MODULE_PATHS[fallback] : null;
  const denied =
    bounce && location.pathname !== bounce ? <Navigate to={bounce} replace /> : <NoAccess />;

  if (roles && !roles.includes(user?.role)) {
    return denied;
  }
  // Menu check. Waits for the permission load so a slow response cannot
  // bounce someone off a page they are allowed to see.
  const menu = module || menuForPath(location.pathname);
  if (menu && !permsLoading && !can(menu, "view")) {
    return denied;
  }
  return children;
}

function NoAccess() {
  const { logout } = useAuth();
  return (
    <div className="sub-blocked-page">
      <div className="sub-blocked-card">
        <h1>No menus available</h1>
        <p className="sub-blocked-message">
          This account has no screens it can open. Ask your administrator to grant
          permissions, or contact TechB Software Solutions about your plan.
        </p>
        <div className="sub-blocked-actions">
          <button type="button" className="btn" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
