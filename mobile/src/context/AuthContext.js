import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AppState } from "react-native";
import api, {
  clearSettingsCache,
  clearSwrCache,
  getTenant,
  loadStoredSession,
  onAuthFailed,
  saveSession,
  setTenant,
} from "../api/client";

const AuthContext = createContext(null);

// Same 12-hour limit as the web app (frontend/src/context/AuthContext.jsx).
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function isExpired(payload) {
  if (!payload || typeof payload.loginAt !== "number") return true;
  return Date.now() - payload.loginAt > SESSION_MAX_AGE_MS;
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(null);
  const [company, setCompany] = useState("");
  const [initializing, setInitializing] = useState(true);
  // Set when the session ended on its own, so the login screen can say why.
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    loadStoredSession().then(({ session, tenant }) => {
      setCompany(tenant);
      if (session && !isExpired(session)) setAuth(session);
      else if (session) {
        saveSession(null);
        setSessionExpired(true);
      }
      setInitializing(false);
    });
  }, []);

  const login = useCallback(async (companyCode, username, password) => {
    // The company code picks which client's database the credentials are
    // checked against; once signed in the server takes the tenant from the
    // session itself.
    await setTenant(companyCode);
    setCompany(getTenant());
    const result = await api.post("/api/auth/login", { username, password });
    if (result && result.success) {
      clearSwrCache();
      clearSettingsCache();
      const payload = { token: result.token, user: result.user, loginAt: Date.now() };
      await saveSession(payload);
      setSessionExpired(false);
      setAuth(payload);
    }
    return result;
  }, []);

  const clear = useCallback(async (expired) => {
    await saveSession(null);
    clearSwrCache();
    clearSettingsCache();
    setSessionExpired(Boolean(expired));
    setAuth(null);
  }, []);

  const logout = useCallback(async () => {
    api.post("/api/auth/logout").catch(() => {});
    await clear(false);
  }, [clear]);

  // Any 401 from the API ends the session. Guarded on `auth` so a stray 401
  // while already signed out doesn't raise the "session expired" notice.
  useEffect(
    () =>
      onAuthFailed(() => {
        if (auth) clear(true);
      }),
    [auth, clear]
  );

  // Re-check the session age whenever the app comes back to the foreground.
  useEffect(() => {
    if (!auth) return undefined;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && isExpired(auth)) clear(true);
    });
    return () => sub.remove();
  }, [auth, clear]);

  const updateUser = useCallback((patch) => {
    setAuth((prev) => {
      if (!prev) return prev;
      const next = { ...prev, user: { ...prev.user, ...patch } };
      saveSession(next);
      return next;
    });
  }, []);

  // Changing your own password reissues the token (see the web AuthContext).
  const updateToken = useCallback((token, expiresAt) => {
    setAuth((prev) => {
      if (!prev) return prev;
      const next = { ...prev, token, expiresAt, loginAt: Date.now() };
      saveSession(next);
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: auth?.user || null,
        token: auth?.token || null,
        isAuthenticated: !!auth,
        initializing,
        company,
        sessionExpired,
        login,
        logout,
        updateUser,
        updateToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
