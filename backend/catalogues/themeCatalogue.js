// What the Theme registry ships with, and what counts as a valid theme.
//
// "Default" is the app exactly as it looks with no theme configured at all —
// the same values :root carries in frontend/src/index.css. That matters: it
// means seeding this collection changes nothing, and a client can always be
// put back to the stock look by assigning it.

const MODES = ["light", "dark", "sepia"];

// Colour fields, in the order the editor shows them.
const COLOUR_FIELDS = ["sidebar", "sidebarActive", "sidebarText", "primary"];

const STARTER_THEMES = [
  {
    code: "default",
    name: "Default",
    description: "The stock SIPERP look — navy sidebar, blue primary.",
    sidebar: "#161f2f",
    sidebarActive: "#2563eb",
    sidebarText: "#a3aec1",
    primary: "#2563eb",
    radius: 10,
    modes: ["light", "dark", "sepia"],
    defaultMode: "light",
    isDefault: true,
    status: "active",
  },
  {
    code: "graphite",
    name: "Graphite",
    description: "Neutral grey sidebar with a restrained slate primary.",
    sidebar: "#1f2329",
    sidebarActive: "#475569",
    sidebarText: "#9ca3af",
    primary: "#475569",
    radius: 8,
    modes: ["light", "dark", "sepia"],
    defaultMode: "light",
    isDefault: false,
    status: "active",
  },
  {
    code: "forest",
    name: "Forest",
    description: "Deep green sidebar, warmer primary — suits industrial brands.",
    sidebar: "#14281f",
    sidebarActive: "#15803d",
    sidebarText: "#9db3a6",
    primary: "#15803d",
    radius: 12,
    modes: ["light", "dark", "sepia"],
    defaultMode: "light",
    isDefault: false,
    status: "active",
  },
  {
    code: "ocean",
    name: "Ocean",
    description: "Deep navy sidebar with a clear sky-blue accent — clean and corporate.",
    sidebar: "#0b2540",
    sidebarActive: "#0369a1",
    sidebarText: "#a9c1d8",
    primary: "#0369a1",
    radius: 10,
    modes: ["light", "dark", "sepia"],
    defaultMode: "light",
    isDefault: false,
    status: "active",
  },
  {
    code: "indigo",
    name: "Indigo",
    description: "Rich indigo sidebar and primary — confident, modern software feel.",
    sidebar: "#1a1747",
    sidebarActive: "#4338ca",
    sidebarText: "#b0aedd",
    primary: "#4338ca",
    radius: 10,
    modes: ["light", "dark", "sepia"],
    defaultMode: "light",
    isDefault: false,
    status: "active",
  },
  {
    code: "teal",
    name: "Teal",
    description: "Dark teal sidebar with a calm teal primary — fresh and professional.",
    sidebar: "#0c2a2c",
    sidebarActive: "#0f766e",
    sidebarText: "#a6c6c4",
    primary: "#0f766e",
    radius: 10,
    modes: ["light", "dark", "sepia"],
    defaultMode: "light",
    isDefault: false,
    status: "active",
  },
  {
    code: "midnight",
    name: "Midnight",
    description: "Near-black navy with a strong blue and sharp corners — serious and formal.",
    sidebar: "#0a1424",
    sidebarActive: "#1d4ed8",
    sidebarText: "#9fb0cc",
    primary: "#1d4ed8",
    radius: 6,
    modes: ["light", "dark", "sepia"],
    defaultMode: "light",
    isDefault: false,
    status: "active",
  },
  {
    code: "bronze",
    name: "Bronze",
    description: "Warm dark brown with a bronze accent — established, trades and manufacturing.",
    sidebar: "#2a1c10",
    sidebarActive: "#b45309",
    sidebarText: "#d1bba3",
    primary: "#b45309",
    radius: 8,
    modes: ["light", "dark", "sepia"],
    defaultMode: "light",
    isDefault: false,
    status: "active",
  },
  {
    code: "charcoal-gold",
    name: "Charcoal Gold",
    description: "Charcoal sidebar with a muted gold accent — premium and understated.",
    sidebar: "#1b1b1d",
    sidebarActive: "#a16207",
    sidebarText: "#b3aea8",
    primary: "#a16207",
    radius: 6,
    modes: ["light", "dark", "sepia"],
    defaultMode: "light",
    isDefault: false,
    status: "active",
  },
  {
    code: "amethyst",
    name: "Amethyst",
    description: "Deep violet sidebar and primary — distinctive without being loud.",
    sidebar: "#25123d",
    sidebarActive: "#6d28d9",
    sidebarText: "#bfb0dc",
    primary: "#6d28d9",
    radius: 12,
    modes: ["light", "dark", "sepia"],
    defaultMode: "light",
    isDefault: false,
    status: "active",
  },
  {
    code: "sage",
    name: "Sage",
    description: "Soft green-grey sidebar with a natural green primary — gentle and easy on the eyes.",
    sidebar: "#1d2b25",
    sidebarActive: "#3f7d67",
    sidebarText: "#a9c0b5",
    primary: "#2f6f5a",
    radius: 12,
    modes: ["light", "dark", "sepia"],
    defaultMode: "light",
    isDefault: false,
    status: "active",
  },
];

const HEX = /^#[0-9a-fA-F]{6}$/;

// Coerces a theme payload from the admin form into schema-shaped values, and
// says what is wrong rather than silently correcting it: a colour that fails
// to parse would otherwise land as black across a client's whole sidebar.
function normalizeThemeBody(body) {
  const out = {};
  const errors = [];

  if (body.description !== undefined) out.description = String(body.description || "");

  for (const field of COLOUR_FIELDS) {
    if (body[field] === undefined) continue;
    const value = String(body[field] || "").trim();
    if (!HEX.test(value)) {
      errors.push(`${field} must be a six-digit hex colour like #2563eb.`);
      continue;
    }
    out[field] = value.toLowerCase();
  }

  if (body.radius !== undefined) {
    const n = Number(body.radius);
    // Above about 24px the "cards" stop reading as panels and start reading
    // as pills, and negative values simply break the layout.
    if (Number.isNaN(n) || n < 0 || n > 24) errors.push("Corner radius must be between 0 and 24 px.");
    else out.radius = n;
  }

  if (body.modes !== undefined) {
    const picked = new Set(Array.isArray(body.modes) ? body.modes.map(String) : []);
    const modes = MODES.filter((m) => picked.has(m));
    // A theme offering no mode at all would leave the client with nothing to
    // render, so light is restored rather than saving something unusable.
    out.modes = modes.length ? modes : ["light"];
  }

  if (body.defaultMode !== undefined) {
    const mode = String(body.defaultMode || "light");
    out.defaultMode = MODES.includes(mode) ? mode : "light";
  }

  if (body.status !== undefined) out.status = body.status === "archived" ? "archived" : "active";

  return { updates: out, errors };
}

// Keeps defaultMode inside modes. Called after a merge so it catches the case
// where one of the two was edited and the other was not.
function reconcileModes(theme) {
  const modes = Array.isArray(theme.modes) && theme.modes.length ? theme.modes : ["light"];
  const defaultMode = modes.includes(theme.defaultMode) ? theme.defaultMode : modes[0];
  return { ...theme, modes, defaultMode };
}

// The theme a request should render with: the client's own, else the row
// marked default, else the stock look. Never returns null — the app must
// always have something to paint with.
function themeForTenant(themes, tenantDoc) {
  const list = themes || [];
  const code = tenantDoc && tenantDoc.themeCode;
  const own = code ? list.find((t) => t.code === code) : null;
  const fallback = list.find((t) => t.isDefault) || list.find((t) => t.code === "default");
  return reconcileModes(own || fallback || STARTER_THEMES[0]);
}

module.exports = { MODES, COLOUR_FIELDS, STARTER_THEMES, normalizeThemeBody, reconcileModes, themeForTenant };
