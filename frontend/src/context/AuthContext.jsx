import { createContext, useContext, useState, useCallback, useEffect } from "react";
import api, { AUTH_FAILED_EVENT, clearSettingsCache, clearSwrCache } from "../api/client";

const AuthContext = createContext(null);

const STORAGE_KEY = "siperp_auth";

// How long a sign-in stays valid. Stored auth older than this is treated as
// signed out, so a browser left open overnight lands back on the login screen
// instead of silently making calls as a stale user.
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

// Set when a session ends by itself (expiry, or the server rejecting it)
// rather than the user clicking Logout — the login screen reads it once to
// explain why they're back there.
const EXPIRED_FLAG = "siperp_session_expired";

export function markSessionExpired() {
  try {
    sessionStorage.setItem(EXPIRED_FLAG, "1");
  } catch  {
    // A private window with storage disabled just loses the message.
  }
}

// Reads the flag and clears it, so the notice shows once and not on every
// later visit to /login.
export function takeSessionExpiredFlag() {
  try {
    const had = sessionStorage.getItem(EXPIRED_FLAG);
    if (had) sessionStorage.removeItem(EXPIRED_FLAG);
    return Boolean(had);
  } catch  {
    return false;
  }
}

function isExpired(payload) {
  // Sessions saved before this field existed have no loginAt — treat them as
  // expired rather than as valid forever.
  if (!payload || typeof payload.loginAt !== "number") return true;
  return Date.now() - payload.loginAt > SESSION_MAX_AGE_MS;
}

function clearStoredAuth() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch  {
    // ignore storage failures
  }
}

function loadStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed) return null;
    if (isExpired(parsed)) {
      clearStoredAuth();
      markSessionExpired();
      return null;
    }
    return parsed;
  } catch  {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(loadStoredAuth);

  const login = useCallback(async (username, password) => {
    const result = await api.post("/api/auth/login", { username, password });
    if (result.success) {
      clearSwrCache();
      const payload = { token: result.token, user: result.user, loginAt: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setAuth(payload);
    }
    return result;
  }, []);

  const googleLogin = useCallback(async (payload) => {
    const result = await api.post("/api/auth/google", payload);
    if (result.success) {
      clearSwrCache();
      const sessionPayload = { token: result.token, user: result.user, loginAt: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionPayload));
      setAuth(sessionPayload);
    }
    return result;
  }, []);

  const register = useCallback(async ({ name, email, password }) => {
    const result = await api.post("/api/auth/register", { name, email, password });
    if (result.success) {
      clearSwrCache();
      const sessionPayload = { token: result.token, user: result.user, loginAt: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionPayload));
      setAuth(sessionPayload);
    }
    return result;
  }, []);

  const logout = useCallback(() => {
    // Best-effort audit-log entry — fire before clearing auth so the request
    // still carries the X-User headers. Not awaited; failure is ignored.
    api.post("/api/auth/logout").catch(() => {});
    clearStoredAuth();
    clearSettingsCache();
    clearSwrCache();
    setAuth(null);
  }, []);

  // Ends the session without the courtesy logout call — used when the session
  // expired or the server rejected it, where that call would just fail too.
  const endSession = useCallback(() => {
    clearStoredAuth();
    clearSettingsCache();
    markSessionExpired();
    setAuth(null);
  }, []);

  // The server rejecting a request as unauthenticated ends the session
  // immediately, wherever in the app it happened. Dropping `auth` is enough:
  // ProtectedRoute sends the user to /login on the next render.
  useEffect(() => {
    // Guarded on `auth` so a stray 401 while already signed out doesn't raise
    // the "session expired" notice on the login screen.
    const onAuthFailed = () => {
      if (auth) endSession();
    };
    window.addEventListener(AUTH_FAILED_EVENT, onAuthFailed);
    return () => window.removeEventListener(AUTH_FAILED_EVENT, onAuthFailed);
  }, [auth, endSession]);

  // A tab left open past the session age shouldn't keep working until someone
  // reloads it, so re-check on a timer and whenever the tab regains focus.
  useEffect(() => {
    if (!auth) return undefined;
    const check = () => {
      if (isExpired(auth)) endSession();
    };
    const timer = setInterval(check, 60 * 1000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [auth, endSession]);

  // Merge fields into the signed-in user (e.g. after "Edit Profile" changes
  // the display name) so the header updates without needing a re-login.
  const updateUser = useCallback((patch) => {
    setAuth((prev) => {
      if (!prev) return prev;
      const next = { ...prev, user: { ...prev.user, ...patch } };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch  {
        // ignore storage failures
      }
      return next;
    });
  }, []);

  // Changing your own password (POST /api/auth/change-password) ends every
  // session for the account, including the one making the change, and
  // reissues a fresh token in the same response so the person doing it isn't
  // logged out of their own browser. This is what stores that fresh token —
  // without it the very next request would 401 on the now-dead old one.
  const updateToken = useCallback((token, expiresAt) => {
    setAuth((prev) => {
      if (!prev) return prev;
      const next = { ...prev, token, expiresAt, loginAt: Date.now() };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch  {
        // ignore storage failures
      }
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: auth?.user || null,
        token: auth?.token || null,
        isAuthenticated: !!auth,
        login,
        register,
        googleLogin,
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
