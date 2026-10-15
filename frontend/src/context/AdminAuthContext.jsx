import { createContext, useCallback, useContext, useEffect, useState } from "react";
import adminApi, {
  ADMIN_AUTH_FAILED_EVENT,
  clearAdminAuth,
  readAdminAuth,
  writeAdminAuth,
} from "../api/adminClient";

// Auth for the platform control plane, entirely separate from the client
// app's AuthContext — a super admin signing in or out has no effect on a
// signed-in client user in the same browser, and vice versa.
const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [auth, setAuth] = useState(readAdminAuth);
  // The stored token may have been revoked or expired server-side, so it is
  // re-checked on mount rather than trusted.
  const [checking, setChecking] = useState(Boolean(readAdminAuth()));

  const login = useCallback(async (email, password) => {
    const result = await adminApi.post("/api/admin/auth/login", { email, password });
    const payload = { token: result.token, admin: result.admin, expiresAt: result.expiresAt };
    writeAdminAuth(payload);
    setAuth(payload);
    return result;
  }, []);

  // Merges a patch (e.g. a new name from the Account Settings modal) into the
  // stored admin object, so the topbar reflects it immediately without a
  // reload.
  const updateAdmin = useCallback((patch) => {
    setAuth((prev) => {
      if (!prev) return prev;
      const next = { ...prev, admin: { ...prev.admin, ...patch } };
      writeAdminAuth(next);
      return next;
    });
  }, []);

  const logout = useCallback(async () => {
    // Best-effort: tell the server to drop the session row so the token is
    // dead even if a copy of it survives somewhere.
    try {
      await adminApi.post("/api/admin/auth/logout");
    } catch  {
      // a already-invalid session is fine to ignore
    }
    clearAdminAuth();
    setAuth(null);
  }, []);

  useEffect(() => {
    if (!auth?.token) {
      setChecking(false);
      return undefined;
    }
    let cancelled = false;
    adminApi
      .get("/api/admin/auth/me")
      .then((r) => {
        // Pick up a name or role changed since this token was issued.
        if (!cancelled) setAuth((prev) => (prev ? { ...prev, admin: r.admin } : prev));
      })
      .catch(() => {
        // adminClient already cleared storage and fired the event on a 401.
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
    // Runs once for the token this provider mounted with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onFailed = () => setAuth(null);
    window.addEventListener(ADMIN_AUTH_FAILED_EVENT, onFailed);
    return () => window.removeEventListener(ADMIN_AUTH_FAILED_EVENT, onFailed);
  }, []);

  return (
    <AdminAuthContext.Provider
      value={{ admin: auth?.admin || null, isAuthenticated: Boolean(auth?.token), checking, login, logout, updateAdmin }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
