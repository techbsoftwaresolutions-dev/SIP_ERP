// The domain clients' workspaces live under (e.g. "acme.<domain>"), worked out
// from the address the app is opened on, so no domain is hardcoded and the same
// build works on any domain. Set VITE_APP_DOMAIN at build time to override it,
// for instance when the admin panel is served from a different domain than the
// clients' workspaces.
export function appDomain() {
  const configured = import.meta.env.VITE_APP_DOMAIN;
  if (configured) return String(configured).replace(/^\.+/, "");
  const parts = window.location.hostname.split(".");
  return parts.length > 2 ? parts.slice(1).join(".") : window.location.hostname;
}

// "acme" -> "acme.<domain>"
export function clientAddress(subdomain) {
  return `${subdomain}.${appDomain()}`;
}
