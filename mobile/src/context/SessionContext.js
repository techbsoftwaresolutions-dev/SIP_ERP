import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api, { clearSettingsCache, onSubscriptionBlocked } from "../api/client";
import { useAuth } from "./AuthContext";

// Everything the signed-in app needs at startup, from ONE /api/bootstrap
// call: permissions (+ plan/add-on/client module gates), the Menu
// Management overrides, the brand theme, and the subscription state.
// Ported from the web app's PermissionsContext + SubscriptionContext so the
// mobile menus hide exactly what the web sidebar hides.

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
  const path = String(endpoint || "").split("?")[0];
  for (const [re, key] of ENDPOINT_RULES) if (re.test(path)) return key;
  return null;
}

export function parentMenu(key) {
  const i = String(key || "").indexOf(":");
  return i > 0 ? key.slice(0, i) : null;
}

const EMPTY_PERMS = {
  permissions: [],
  isAdmin: false,
  unconfigured: true,
  planModules: [],
  clientModules: [],
  addOnModules: [],
  coreModules: [],
  disabledModules: [],
};

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [perms, setPerms] = useState(EMPTY_PERMS);
  const [menu, setMenu] = useState([]);
  const [theme, setTheme] = useState(null);
  const [subscription, setSubscription] = useState({ state: "none" });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const all = await api.get("/api/bootstrap");
      setPerms({ ...EMPTY_PERMS, ...(all["/api/me/permissions"] || {}) });
      setMenu((all["/api/menu"] && all["/api/menu"].menu) || []);
      setTheme(all["/api/theme"] || null);
      setSubscription(all["/api/subscription/status"] || { state: "none" });
    } catch (err) {
      if (err && err.code === "SUBSCRIPTION_INACTIVE") {
        setSubscription({ ...(err.body || {}), state: (err.body && err.body.state) || "expired" });
      } else {
        // Never lock the app because the check failed — the API still
        // enforces every permission itself.
        setPerms({ ...EMPTY_PERMS, isAdmin: true });
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load, user?.role]);

  useEffect(
    () =>
      onSubscriptionBlocked((body) =>
        setSubscription({ ...(body || {}), state: (body && body.state) || "expired" })
      ),
    []
  );

  const recheck = useCallback(async () => {
    clearSettingsCache();
    setLoading(true);
    await load();
  }, [load]);

  const value = useMemo(() => {
    const set = new Set(perms.permissions || []);
    const allowAll = perms.isAdmin || perms.unconfigured;
    const planList = perms.planModules || [];
    const clientList = perms.clientModules || [];
    const addOnList = perms.addOnModules || [];
    const coreSet = new Set(perms.coreModules || []);
    const disabledSet = new Set(perms.disabledModules || []);
    const flagged = (s, key) => s.has(key) || s.has(parentMenu(key));

    const listAllows = (list, moduleKey) => {
      if (list.length === 0 || !moduleKey) return true;
      const s = new Set(list);
      if (s.has(moduleKey)) return true;
      const parent = parentMenu(moduleKey);
      if (parent) return s.has(parent);
      return list.some((k) => parentMenu(k) === moduleKey);
    };

    const planAllows = (moduleKey) => {
      if (!moduleKey) return true;
      if (flagged(disabledSet, moduleKey)) return false;
      if (flagged(coreSet, moduleKey)) return true;
      const bought = listAllows(planList, moduleKey) || (addOnList.length > 0 && listAllows(addOnList, moduleKey));
      return bought && listAllows(clientList, moduleKey);
    };

    const roleAllows = (moduleKey, action) => {
      if (set.has(`${moduleKey}.${action}`)) return true;
      const parent = parentMenu(moduleKey);
      return parent ? set.has(`${parent}.${action}`) : false;
    };

    const can = (moduleKey, action = "view") => {
      if (!moduleKey) return true;
      if (!planAllows(moduleKey)) return false;
      if (allowAll) return true;
      return roleAllows(moduleKey, action);
    };
    const canEndpoint = (endpoint, action = "view") => can(moduleForEndpoint(endpoint), action);

    const menuConfig = new Map((menu || []).map((m) => [m.key, m]));
    const blocked = subscription.state === "expired" || subscription.state === "suspended";
    const primary = (theme && theme.primary) || null;

    return {
      ...perms,
      loading,
      can,
      canEndpoint,
      allowAll,
      planAllows,
      menuConfig,
      theme,
      primary,
      subscription,
      blocked,
      recheck,
    };
  }, [perms, menu, theme, subscription, loading, recheck]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

// Same names the web pages use, so ported screens read naturally.
export const usePermissions = useSession;
