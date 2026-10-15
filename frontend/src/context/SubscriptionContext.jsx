import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api, { clearSettingsCache, readSwr, writeSwr } from "../api/client";

const SubscriptionContext = createContext(null);

// Which client this browser is serving, and whether their subscription still
// entitles them to use the app. Fetched once per page session (ProtectedRoute
// consults it on every route, so it must not refetch per navigation) from an
// endpoint the backend keeps reachable even while a tenant is blocked.
//
// state: "none" (no tenant row — localhost dev, unknown subdomain; never
// blocked) | "active" | "expired" | "suspended".
export function SubscriptionProvider({ children }) {
  const [info, setInfo] = useState(() => {
    const cached = readSwr("/api/subscription/status");
    return cached ? { ...cached, loading: false } : { state: "none", loading: true };
  });

  const refresh = useCallback(async () => {
    try {
      const data = await api.get("/api/subscription/status");
      writeSwr("/api/subscription/status", data);
      setInfo({ ...data, loading: false });
      return data;
    } catch  {
      // Never lock anyone out because the check itself failed — the backend
      // refuses blocked tenants on every other route anyway, so a failure here
      // degrades to "let them through and let the API do the talking".
      setInfo({ state: "none", loading: false });
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Re-check on demand (e.g. the "Check again" button on the block screen),
  // dropping the settings cache so a freshly-renewed tenant isn't still
  // reading the copy memoized while they were blocked.
  const recheck = useCallback(async () => {
    clearSettingsCache();
    return refresh();
  }, [refresh]);

  const blocked = info.state === "expired" || info.state === "suspended";

  return (
    <SubscriptionContext.Provider value={{ ...info, blocked, refresh: recheck }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext) || { state: "none", blocked: false, loading: false };
}
