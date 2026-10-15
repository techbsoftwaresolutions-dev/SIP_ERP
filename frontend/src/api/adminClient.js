// API client for the platform control plane.
//
// Deliberately separate from api/client.js: that one carries the tenant and
// acting-user headers for a client's own data, this one carries a super-admin
// bearer token and no tenant at all. Keeping them apart means a 401 on one
// side can never sign the user out of the other.
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:5000"
    : "");

export const ADMIN_TOKEN_KEY = "siperp_admin_auth";
export const ADMIN_AUTH_FAILED_EVENT = "siperp:admin-auth-failed";

export function readAdminAuth() {
  try {
    const raw = localStorage.getItem(ADMIN_TOKEN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export function writeAdminAuth(payload) {
  try {
    localStorage.setItem(ADMIN_TOKEN_KEY, JSON.stringify(payload));
  } catch (_) {
    // ignore storage failures
  }
}

export function clearAdminAuth() {
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch (_) {
    // ignore storage failures
  }
}

async function request(path, { method = "GET", body } = {}) {
  const auth = readAdminAuth();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let payload = null;
    try {
      payload = await res.json();
    } catch (_) {
      // no JSON body
    }
    const err = new Error((payload && payload.message) || `Request failed (${res.status})`);
    err.status = res.status;
    err.body = payload;

    // The session is gone or was revoked — drop it and let the admin routes
    // bounce to the admin login. The sign-in call itself is exempt, so a
    // wrong password shows an error instead of looking like an expiry.
    if (res.status === 401 && !path.startsWith("/api/admin/auth/login")) {
      clearAdminAuth();
      window.dispatchEvent(new CustomEvent(ADMIN_AUTH_FAILED_EVENT));
    }
    throw err;
  }

  return res.json();
}

export const adminApi = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  put: (path, body) => request(path, { method: "PUT", body }),
  delete: (path) => request(path, { method: "DELETE" }),
};

export default adminApi;
