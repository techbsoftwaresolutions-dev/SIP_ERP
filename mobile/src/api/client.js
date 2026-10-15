import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Same REST API the web app uses. Set API_BASE_URL in mobile/.env (or the EAS
// build profile) to the API origin WITHOUT a trailing /api — every path below
// already starts with /api. On a physical phone "localhost" is the phone
// itself, so point it at your computer's LAN IP while developing.
export const API_BASE_URL = String(
  Constants.expoConfig?.extra?.apiBaseUrl || "http://localhost:5000"
).replace(/\/+$/, "");

// Mirrors the web client (frontend/src/api/client.js) method-for-method, so
// the field-config modules copied from the web app (pages/**/*Fields.js) run
// here unchanged. The one real difference is the tenant: the web app derives
// it from its subdomain, a phone has none, so the user enters their company
// code on the login screen and it is kept here.

export const AUTH_FAILED_EVENT = "siperp:auth-failed";

const STORAGE_KEY = "siperp_auth";
const TENANT_KEY = "siperp_tenant";

// In-memory copies so every request doesn't wait on AsyncStorage.
let session = null; // { token, user, loginAt }
let tenant = "";

const listeners = new Set();
export function onAuthFailed(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emitAuthFailed() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (_) {
      // a listener's failure must not break the request that triggered it
    }
  });
}

export async function loadStoredSession() {
  try {
    const [rawSession, storedTenant] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(TENANT_KEY),
    ]);
    tenant = storedTenant || "";
    session = rawSession ? JSON.parse(rawSession) : null;
  } catch (_) {
    session = null;
  }
  return { session, tenant };
}

export async function saveSession(next) {
  session = next;
  try {
    if (next) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (_) {
    // storage failure only costs "stay signed in"
  }
}

export function getTenant() {
  return tenant;
}

export async function setTenant(code) {
  tenant = String(code || "").trim().toLowerCase();
  try {
    if (tenant) await AsyncStorage.setItem(TENANT_KEY, tenant);
    else await AsyncStorage.removeItem(TENANT_KEY);
  } catch (_) {
    // ignore
  }
}

export function authHeaders() {
  return session && session.token ? { Authorization: `Bearer ${session.token}` } : {};
}

function baseHeaders() {
  return {
    ...(tenant ? { "X-Tenant": tenant } : {}),
    ...authHeaders(),
  };
}

async function doFetch(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...baseHeaders(), ...(options.headers || {}) },
    });
  } catch (_networkErr) {
    const err = new Error(`Could not reach the server. Check your internet connection and try again.`);
    err.status = 0;
    err.code = "NETWORK";
    throw err;
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let body = null;
    try {
      body = await res.json();
      message = (body && body.message) || message;
    } catch (_) {
      // not JSON
    }
    const err = new Error(message);
    err.status = res.status;
    err.code = (body && body.code) || "";
    err.body = body;
    // Same exemptions as the web app: a wrong password is not an expired session.
    if (res.status === 401 && !/^\/api\/(auth|admin)\b/.test(path)) emitAuthFailed();
    if (res.status === 402 && err.code === "SUBSCRIPTION_INACTIVE") subscriptionBlockedListeners.forEach((fn) => fn(body));
    throw err;
  }

  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const subscriptionBlockedListeners = new Set();
export function onSubscriptionBlocked(fn) {
  subscriptionBlockedListeners.add(fn);
  return () => subscriptionBlockedListeners.delete(fn);
}

// Identical concurrent GETs share one request.
const inflightGets = new Map();

// Startup data (theme, menu, permissions, subscription) comes in one call.
const BOOTSTRAP_PATHS = new Set(["/api/theme", "/api/menu", "/api/me/permissions", "/api/subscription/status"]);
let bootstrapPromise = null;
let bootstrapAt = 0;
function bootstrap() {
  if (!bootstrapPromise || Date.now() - bootstrapAt > 3000) {
    bootstrapAt = Date.now();
    bootstrapPromise = doFetch("/api/bootstrap", { method: "GET" }).catch((err) => {
      bootstrapPromise = null;
      throw err;
    });
  }
  return bootstrapPromise;
}

function request(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  if (method !== "GET") return doFetch(path, options);

  if (BOOTSTRAP_PATHS.has(path) && !options.headers && session && session.token) {
    return bootstrap()
      .then((all) => (all && all[path] !== undefined ? all[path] : doFetch(path, options)))
      .catch((err) => {
        if (err && err.status === 401) throw err;
        return doFetch(path, options);
      });
  }

  const key = `${tenant}::${path}`;
  const pending = inflightGets.get(key);
  if (pending) return pending;
  const promise = doFetch(path, options).finally(() => inflightGets.delete(key));
  inflightGets.set(key, promise);
  return promise;
}

// /api/settings carries the logo/signature inline as base64 (several MB) —
// fetch it once per session and share the answer.
let settingsCache = null;
let settingsPromise = null;
function getSettingsCached() {
  if (settingsCache) return Promise.resolve(settingsCache);
  if (!settingsPromise) {
    settingsPromise = request("/api/settings", { method: "GET" })
      .then((data) => {
        settingsCache = data;
        return data;
      })
      .finally(() => {
        settingsPromise = null;
      });
  }
  return settingsPromise;
}
export function clearSettingsCache() {
  settingsCache = null;
  settingsPromise = null;
}

// Stale-while-revalidate, in memory for the life of the app process.
const swrStore = new Map();
const swrKey = (path) => `${tenant}::${path}`;
export function readSwr(path) {
  return swrStore.has(swrKey(path)) ? swrStore.get(swrKey(path)) : null;
}
export function writeSwr(path, data) {
  swrStore.set(swrKey(path), data);
}
export function clearSwrCache() {
  swrStore.clear();
}

export const api = {
  get: (path) => (path === "/api/settings" ? getSettingsCached() : request(path, { method: "GET" })),
  swr: (path, onData) => {
    const cached = readSwr(path);
    if (cached) onData(cached, true);
    return request(path, { method: "GET" }).then((fresh) => {
      writeSwr(path, fresh);
      onData(fresh, false);
      return fresh;
    });
  },
  post: (path, data) => doFetch(path, { method: "POST", body: JSON.stringify(data ?? {}) }),
  put: (path, data) =>
    doFetch(path, { method: "PUT", body: JSON.stringify(data ?? {}) }).then((result) => {
      if (path === "/api/settings") settingsCache = result;
      return result;
    }),
  patch: (path, data) => doFetch(path, { method: "PATCH", body: JSON.stringify(data ?? {}) }),
  delete: (path) => doFetch(path, { method: "DELETE" }),
  // Raw response for file downloads (see utils/files.js).
  raw: (path) =>
    fetch(`${API_BASE_URL}${path}`, { headers: baseHeaders() }).then((res) => {
      if (res.status === 401) emitAuthFailed();
      return res;
    }),
};

export default api;
