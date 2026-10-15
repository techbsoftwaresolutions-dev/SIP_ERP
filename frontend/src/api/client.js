const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Fired when the server rejects a request as unauthenticated. AuthContext
// listens for it and ends the session; kept as an event so this module stays
// free of React imports and circular dependencies.
export const AUTH_FAILED_EVENT = "siperp:auth-failed";

// Tells the (single, shared) backend which client this page belongs to,
// derived purely from the subdomain the page is loaded from — no
// per-deployment build config needed, so the same frontend build can be
// served on any client's subdomain. Local dev (localhost) sends nothing,
// which the backend treats as its default/current database.
function currentTenant() {
  const host = window.location.hostname;
  const first = host.split(".")[0];
  return first === "localhost" || /^\d+$/.test(first) ? "" : first;
}

// The session token issued at sign-in. It is the ONLY thing that now says
// who is calling: the server derives the user, their role and their tenant
// from it and ignores anything the page claims in a header.
//
// The X-User / X-User-Role headers this used to send are gone. They were
// only ever a hint for the audit log, but the server trusted them, which
// meant anyone could claim to be an administrator of any client.
export function authHeaders() {
  try {
    const raw = localStorage.getItem("siperp_auth");
    const token = raw ? JSON.parse(raw)?.token : "";
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch (_) {
    // Private windows and blocked site data both throw here.
    return {};
  }
}

async function doFetch(path, options = {}) {
  const tenant = currentTenant();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(tenant ? { "X-Tenant": tenant } : {}),
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let body = null;

    try {
      body = await res.json();
      message = (body && body.message) || message;
    } catch (_) {
      // ignore
    }

    // Callers need the status to react to a specific failure (e.g. a 402
    // SUBSCRIPTION_INACTIVE). Existing consumers only read .message, so
    // attaching these extra fields is backwards-compatible. Note the
    // inflightGets map hands one rejected promise to every concurrent
    // caller, so this Error instance is shared — never mutate it downstream.
    const err = new Error(message);
    err.status = res.status;
    err.code = (body && body.code) || "";
    err.body = body;

    // A 401 anywhere in the app means the session is no longer good, so end it
    // and let ProtectedRoute send the user to the login screen. Two paths are
    // deliberately exempt:
    //   /api/auth/*  — a wrong password on the login form is not an expired
    //                  session, and signing out shouldn't trip this either.
    //   /api/admin/* — master-key gated; MasterKeyGate handles its own 401 by
    //                  re-prompting for the key, not by logging anyone out.
    if (res.status === 401 && !/^\/api\/(auth|admin)\b/.test(path)) {
      window.dispatchEvent(new CustomEvent(AUTH_FAILED_EVENT));
    }

    throw err;
  }

  return res.json();
}

// Concurrent identical GETs (two components mounting at once, React 18/19
// StrictMode double-invoking effects, …) share a single network request
// instead of each firing their own. Cleared as soon as it settles, so a
// later call still fetches fresh data.
const inflightGets = new Map();

// The small startup calls every screen needs (brand colours, menu,
// permissions, subscription status) are answered by ONE request: /api/bootstrap.
// Each caller still asks for its own URL and gets its own slice, so no other
// code changes. Any failure (older backend, blocked tenant) falls back to the
// normal per-URL request. Only used while signed in — bootstrap needs a session.
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

  if (BOOTSTRAP_PATHS.has(path) && !options.headers && authHeaders().Authorization) {
    return bootstrap()
      .then((all) => (all && all[path] !== undefined ? all[path] : doFetch(path, options)))
      .catch((err) => {
        // A dead session must still log the user out; anything else just
        // falls back to asking for this one URL directly.
        if (err && err.status === 401) throw err;
        return doFetch(path, options);
      });
  }

  const key = `${currentTenant()}::${path}::${JSON.stringify(options.headers || {})}`;
  const pending = inflightGets.get(key);
  if (pending) return pending;

  const promise = doFetch(path, options).finally(() => inflightGets.delete(key));
  inflightGets.set(key, promise);
  return promise;
}

// /api/settings carries the company logo/signature/seal inline as base64,
// which makes each response several MB. Half a dozen components (Dashboard,
// every print page, Settings pages, More.jsx) each fetch it independently on
// mount, so a single page can trigger 4-5 multi-MB requests at once — that's
// the "settings taking 1.6-3.3s, repeatedly" behavior. This cache makes every
// GET to /api/settings within a page session share one in-flight request and
// one resolved result, so it's fetched at most once until something actually
// changes it. Saving (PUT) updates the cache with the saved result directly.
let settingsCache = null; // resolved settings object, once loaded
let settingsPromise = null; // in-flight request, so concurrent callers share it instead of each firing their own

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

// Drops the memoized settings so the next read hits the network. Needed
// whenever the server's answer could change underneath us — e.g. a tenant's
// subscription flipping from blocked to active mid-session, which would
// otherwise keep resolving from this cache until a full page reload.
export function clearSettingsCache() {
  settingsCache = null;
  settingsPromise = null;
}

// Stale-while-revalidate: the last answer for a URL is kept in sessionStorage
// (per client, wiped on sign-in/out) so a screen can paint instantly from it
// while the fresh copy loads in the background — the app feels immediate on
// every visit after the first.
const SWR_PREFIX = "swr::";
const swrKey = (path) => `${SWR_PREFIX}${currentTenant()}::${path}`;

export function readSwr(path) {
  try {
    const v = sessionStorage.getItem(swrKey(path));
    return v ? JSON.parse(v) : null;
  } catch (_) {
    return null;
  }
}

export function writeSwr(path, data) {
  try {
    sessionStorage.setItem(swrKey(path), JSON.stringify(data));
  } catch (_) {
    // storage full or unavailable — caching is only an optimisation
  }
}

export function clearSwrCache() {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(SWR_PREFIX))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch (_) {
    // ignore
  }
}

// `extraHeaders` is used by the Manage Clients screen to attach the master
// admin key — nothing else in the app needs it.
export const api = {
  get: (path, extraHeaders) =>
    path === "/api/settings" && !extraHeaders
      ? getSettingsCached()
      : request(path, { method: "GET", headers: extraHeaders }),
  // Calls onData(cached, true) right away when a previous answer exists, then
  // onData(fresh, false) once the network responds. Resolves with the fresh data.
  swr: (path, onData) => {
    const cached = readSwr(path);
    if (cached) onData(cached, true);
    return request(path, { method: "GET" }).then((fresh) => {
      writeSwr(path, fresh);
      onData(fresh, false);
      return fresh;
    });
  },
  // Saves a file the API produces (backups, exports). A plain link or
  // window.location cannot do this: it would not carry the sign-in token or
  // the client's subdomain, so the server would refuse it.
  download: async (path, fallbackName = "download") => {
    const tenant = currentTenant();
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { ...(tenant ? { "X-Tenant": tenant } : {}), ...authHeaders() },
    });
    if (!res.ok) {
      let message = "The download failed. Please try again.";
      try {
        message = (await res.json()).message || message;
      } catch (_) {
        // not JSON — keep the generic message
      }
      // Same rule as every other call: a rejected session ends the session.
      if (res.status === 401) window.dispatchEvent(new CustomEvent(AUTH_FAILED_EVENT));
      const err = new Error(message);
      err.status = res.status;
      throw err;
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const name = (/filename="?([^";]+)"?/.exec(disposition) || [])[1] || fallbackName;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return name;
  },
  post: (path, data, extraHeaders) =>
    doFetch(path, {
      method: "POST",
      body: JSON.stringify(data),
      headers: extraHeaders,
    }),
  put: (path, data, extraHeaders) =>
    doFetch(path, {
      method: "PUT",
      body: JSON.stringify(data),
      headers: extraHeaders,
    }).then((result) => {
      // Keep the settings cache correct after a save — next read (this page
      // or the next) gets what was just saved instead of the stale copy.
      if (path === "/api/settings") settingsCache = result;
      return result;
    }),
  delete: (path, extraHeaders) => doFetch(path, { method: "DELETE", headers: extraHeaders }),
};

export default api;
