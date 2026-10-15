import { useCallback } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";

// Web-style paths on top of react-navigation. Every screen is registered
// under its web route pattern ("/sales/invoices/:id/edit"), so code ported
// from the web app keeps its navigate("/sales/invoices/new", { state }) calls
// and useParams()/useLocation() reads unchanged.

let ROUTES = []; // [{ pattern, re, keys }]

export function registerRoutes(patterns) {
  ROUTES = patterns.map((pattern) => {
    const keys = [];
    const re = new RegExp(
      "^" +
        pattern.replace(/\//g, "\\/").replace(/:(\w+)/g, (_, k) => {
          keys.push(k);
          return "([^/]+)";
        }) +
        "\\/?$"
    );
    return { pattern, re, keys };
  });
}

export function matchPath(path) {
  const clean = String(path || "").split("?")[0];
  for (const r of ROUTES) {
    const m = r.re.exec(clean);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => {
        params[k] = decodeURIComponent(m[i + 1]);
      });
      return { name: r.pattern, params };
    }
  }
  return null;
}

// Paths that are bottom tabs rather than pushed screens.
export const TAB_PATHS = {
  "/dashboard": "Dashboard",
  "/customers": "Customers",
  "/sales": "Sales",
  "/products/items": "Products",
  "/more": "More",
};

export function useNavigate() {
  const navigation = useNavigation();
  return useCallback(
    (path, opts = {}) => {
      if (typeof path === "number") {
        if (navigation.canGoBack()) navigation.goBack();
        return;
      }
      if (TAB_PATHS[path]) {
        navigation.navigate("Tabs", { screen: TAB_PATHS[path] });
        return;
      }
      const m = matchPath(path);
      if (!m) {
        console.warn(`No mobile screen for ${path}`);
        return;
      }
      const params = opts.state ? { ...m.params, __state: opts.state } : m.params;
      if (opts.replace) navigation.replace(m.name, params);
      else navigation.push(m.name, params);
    },
    [navigation]
  );
}

export function useParams() {
  const route = useRoute();
  const { __state, ...rest } = route.params || {};
  return rest;
}

export function useLocation() {
  const route = useRoute();
  return { state: (route.params && route.params.__state) || null, pathname: route.name };
}

// A screen opened from a deep link has nothing behind it — fall back to the
// home tabs so "Save" never leaves the user sitting on a filled-in form.
export function useGoBack() {
  const navigation = useNavigation();
  return useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Tabs");
  }, [navigation]);
}
