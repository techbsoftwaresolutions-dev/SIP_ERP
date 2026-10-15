import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api, { readSwr, writeSwr } from "../api/client";
import { useAuth } from "./AuthContext";

const PermissionsContext = createContext(null);

// Mirrors MODULES in backend/permissions.js so a list page can work out which
// menu it belongs to from the endpoint it already has — that way all ~20
// SimpleListPage consumers need no changes at all. Sub-page rules come first,
// exactly as on the server, so the most specific menu wins.
const ENDPOINT_RULES = [
  [/^\/api\/purchase-orders\b/, "purchase:orders"],
  [/^\/api\/purchase\/goods-receipts\b/, "purchase:goods-receipt"],
  [/^\/api\/purchase\/invoices\b/, "purchase:invoices"],
  [/^\/api\/purchase\/returns\b/, "purchase:returns"],
  [/^\/api\/inventory\/stock-in\b/, "inventory:stock-in"],
  [/^\/api\/inventory\/stock-out\b/, "inventory:stock-out"],
  [/^\/api\/manufacturing\/boms\b/, "manufacturing:boms"],
  [/^\/api\/manufacturing\/work-orders\b/, "manufacturing:work-orders"],
  [/^\/api\/manufacturing\/job-cards\b/, "manufacturing:job-cards"],
  [/^\/api\/manufacturing\/material-issues\b/, "manufacturing:material-issues"],
  [/^\/api\/manufacturing\/production-receipts\b/, "manufacturing:production-receipts"],
  [/^\/api\/manufacturing\/work-centers\b/, "manufacturing:work-centers"],
  [/^\/api\/manufacturing\/machines\b/, "manufacturing:machines"],
  [/^\/api\/sales\/enquiries\b/, "sales:enquiries"],
  [/^\/api\/sales\/orders\b/, "sales:orders"],
  [/^\/api\/sales\/delivery-challans\b/, "sales:delivery-challan"],
  [/^\/api\/sales\/invoices\b/, "sales:invoices"],
  [/^\/api\/sales\/returns\b/, "sales:returns"],
  [/^\/api\/reports\/sales-summary\b/, "reports:sales"],
  [/^\/api\/reports\/purchase-summary\b/, "reports:purchase"],
  [/^\/api\/reports\/(inventory-valuation|low-stock)\b/, "reports:inventory"],
  [/^\/api\/users\b/, "users:users"],
  [/^\/api\/roles\b/, "users:roles"],
  [/^\/api\/activity-log\b/, "users:audit-logs"],
  // Parents last.
  [/^\/api\/dashboard\b/, "dashboard"],
  [/^\/api\/reminders\b/, "reminders"],
  [/^\/api\/ai\b/, "ai-assistant"],
  [/^\/api\/(customers|customer-groups)\b/, "customers"],
  [/^\/api\/(suppliers|supplier-groups)\b/, "suppliers"],
  [/^\/api\/(products|categories|brands|items)\b/, "products"],
  [/^\/api\/(purchase-orders|purchase)\b/, "purchase"],
  [/^\/api\/(inventory|warehouses)\b/, "inventory"],
  [/^\/api\/manufacturing\b/, "manufacturing"],
  [/^\/api\/sales\b/, "sales"],
  [/^\/api\/reports\b/, "reports"],
  [/^\/api\/(users|roles|activity-log)\b/, "users"],
  [/^\/api\/(settings|backup)\b/, "settings"],
];

export function moduleForEndpoint(endpoint) {
  for (const [re, key] of ENDPOINT_RULES) if (re.test(endpoint || "")) return key;
  return null;
}

// "purchase:orders" -> "purchase"; a top-level key has no parent.
export function parentMenu(key) {
  const i = String(key || "").indexOf(":");
  return i > 0 ? key.slice(0, i) : null;
}

// Shape of the /api/me/permissions payload before it arrives, and what we
// fall back to if the call fails. Every list empty = no restriction, which
// matches what the server does when nothing is configured.
const EMPTY_STATE = {
  permissions: [],
  isAdmin: false,
  unconfigured: true,
  planModules: [],
  clientModules: [],
  addOnModules: [],
  coreModules: [],
  disabledModules: [],
  loading: true,
};

export function PermissionsProvider({ children }) {
  const { user } = useAuth();
  const role = user?.role || "";
  const [state, setState] = useState(() => {
    const cached = readSwr("/api/me/permissions");
    return cached ? { ...cached, loading: false } : EMPTY_STATE;
  });

  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/me/permissions")
      .then((d) => {
        writeSwr("/api/me/permissions", d);
        if (!cancelled) setState({ ...d, loading: false });
      })
      .catch(() => {
        // Never hide the whole app because the check failed — the backend
        // enforces independently, so fall back to "allow" and let the API
        // do the talking. Matches the server's unconfigured behaviour.
        if (!cancelled) setState({ ...EMPTY_STATE, isAdmin: true, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [role]);

  const value = useMemo(() => {
    const set = new Set(state.permissions || []);
    // `unconfigured` means no roles exist yet — don't start hiding menus
    // before anyone has set permissions up.
    const allowAll = state.isAdmin || state.unconfigured;
    // The subscription plan decides which menus this client has at all.
    // An empty list means the plan places no restriction.
    const planList = state.planModules || [];
    // The per-client override a super admin set in Manage Clients. Empty
    // means no client-level restriction.
    const clientList = state.clientModules || [];
    // Menus bought as add-ons on top of the plan — the one thing that
    // widens access rather than narrowing it.
    const addOnList = state.addOnModules || [];
    // Always-on menus, and menus withdrawn platform-wide. Both are keyed on
    // top-level modules, so a flag covers every sub-page.
    const coreSet = new Set(state.coreModules || []);
    const disabledSet = new Set(state.disabledModules || []);
    const flagged = (set, key) => set.has(key) || set.has(parentMenu(key));

    // Mirrors planAllowsModule()/clientAllowsModule() on the server: a parent
    // grant covers all of its sub-pages, and a parent menu stays visible
    // while any of its sub-pages is included.
    const listAllows = (list, moduleKey) => {
      if (list.length === 0 || !moduleKey) return true;
      const set2 = new Set(list);
      if (set2.has(moduleKey)) return true;
      const parent = parentMenu(moduleKey);
      if (parent) return set2.has(parent);
      return list.some((k) => parentMenu(k) === moduleKey);
    };

    // Same precedence as effectiveMenuAllows() on the server: a withdrawn
    // module is gone for everyone, a core module is always there, otherwise
    // plan-or-add-on must grant it and the client override must not have
    // taken it away. Kept in step with the server so the sidebar never shows
    // a menu whose pages would 403 the moment you open them.
    const planAllows = (moduleKey) => {
      if (!moduleKey) return true;
      if (flagged(disabledSet, moduleKey)) return false;
      if (flagged(coreSet, moduleKey)) return true;
      // addOnList is empty for most clients, and an empty list read as "no
      // restriction" would grant everything — so it only ever adds.
      const bought =
        listAllows(planList, moduleKey) ||
        (addOnList.length > 0 && listAllows(addOnList, moduleKey));
      return bought && listAllows(clientList, moduleKey);
    };

    // Roles are configured per menu, so a sub-page inherits its parent's grant.
    const roleAllows = (moduleKey, action) => {
      if (set.has(`${moduleKey}.${action}`)) return true;
      const parent = parentMenu(moduleKey);
      return parent ? set.has(`${parent}.${action}`) : false;
    };

    const can = (moduleKey, action = "view") => {
      if (!moduleKey) return true;
      // Plan gate applies even to Administrator — it's a commercial limit,
      // not a staff-permission one.
      if (!planAllows(moduleKey)) return false;
      if (allowAll) return true;
      return roleAllows(moduleKey, action);
    };
    const canEndpoint = (endpoint, action = "view") => can(moduleForEndpoint(endpoint), action);
    return { ...state, can, canEndpoint, allowAll, planAllows };
  }, [state]);

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions() {
  return (
    useContext(PermissionsContext) || {
      permissions: [],
      isAdmin: true,
      unconfigured: true,
      loading: false,
      allowAll: true,
      planAllows: () => true,
      can: () => true,
      canEndpoint: () => true,
    }
  );
}
