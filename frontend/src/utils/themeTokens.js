// Turns the four brand colours a theme stores into the CSS custom properties
// the app actually paints with.
//
// The registry keeps deliberately little (see backend/models/Theme.js): a
// sidebar colour, its active pill, the sidebar text, a primary, and a radius.
// Everything else — hover shades, the soft chip backgrounds, the dark-mode
// variants — is derived here, so a brand colour cannot produce an illegible
// combination and nobody has to hand-pick eight shades of one hue.

function parseHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
const toHex = ({ r, g, b }) =>
  `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;

// Moves a colour towards white (amount > 0) or black (amount < 0), by a
// fraction of the distance — so a dark colour lightens visibly and a light one
// does not blow out.
function shift(hex, amount) {
  const c = parseHex(hex);
  if (!c) return hex;
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  return toHex({
    r: c.r + (target - c.r) * t,
    g: c.g + (target - c.g) * t,
    b: c.b + (target - c.b) * t,
  });
}

function rgba(hex, alpha) {
  const c = parseHex(hex);
  if (!c) return hex;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
}

// Perceived brightness (ITU-R BT.601). Used only to decide whether a colour
// needs light or dark text on top of it.
function luminance(hex) {
  const c = parseHex(hex);
  if (!c) return 0;
  return (c.r * 299 + c.g * 587 + c.b * 114) / 1000;
}

export function isLight(hex) {
  return luminance(hex) > 150;
}

// The shipped look, matching :root in index.css. Used until /api/theme
// answers, and as the fallback if it never does.
export const DEFAULT_THEME = {
  code: "default",
  name: "Default",
  sidebar: "#161f2f",
  sidebarActive: "#2563eb",
  sidebarText: "#a3aec1",
  primary: "#2563eb",
  radius: 10,
  modes: ["light", "dark"],
  defaultMode: "light",
};

// The CSS text injected into the page. Two blocks, mirroring how index.css is
// structured: the base tokens, then the handful the dark mode re-tints.
//
// It has to be a stylesheet rather than inline styles on <html>. Inline styles
// beat any selector, so setting --primary inline would also override what
// [data-theme="dark"] does with it, and dark mode would lose its lighter,
// higher-contrast blue. Emitting real rules keeps the cascade intact.
export function themeCss(theme) {
  const t = { ...DEFAULT_THEME, ...(theme || {}) };
  const radius = Number(t.radius);

  return `:root {
  --navy: ${t.sidebar};
  --navy-2: ${shift(t.sidebar, isLight(t.sidebar) ? -0.06 : 0.06)};
  --navy-active: ${t.sidebarActive};
  --navy-active-hover: ${shift(t.sidebarActive, -0.12)};
  --sidebar-text: ${t.sidebarText};
  --sidebar-text-active: ${isLight(t.sidebarActive) ? "#111827" : "#ffffff"};
  --sidebar-hover-bg: ${isLight(t.sidebar) ? "rgba(15, 23, 42, 0.06)" : "rgba(255, 255, 255, 0.07)"};
  --sidebar-line: ${isLight(t.sidebar) ? "rgba(15, 23, 42, 0.10)" : "rgba(255, 255, 255, 0.08)"};
  --sidebar-scroll: ${isLight(t.sidebar) ? "rgba(15, 23, 42, 0.22)" : "rgba(255, 255, 255, 0.18)"};
  --sidebar-scroll-hover: ${isLight(t.sidebar) ? "rgba(15, 23, 42, 0.38)" : "rgba(255, 255, 255, 0.28)"};
  --sidebar-hover-text: ${isLight(t.sidebar) ? shift(t.sidebarText, -0.62) : "#ffffff"};
  --blue: ${t.primary};
  --blue-dark: ${shift(t.primary, -0.15)};
  --blue-bg: ${shift(t.primary, 0.86)};
  --radius: ${Number.isNaN(radius) ? 10 : radius}px;
}
:root[data-theme="dark"] {
  --blue: ${shift(t.primary, 0.22)};
  --blue-dark: ${shift(t.primary, 0.55)};
  --blue-bg: ${rgba(t.primary, 0.18)};
}`;
}

const STYLE_ID = "siperp-theme-tokens";

// Writes the theme into the document. Idempotent: the same <style> element is
// reused, so switching theme repaints rather than stacking rules.
export function applyThemeTokens(theme) {
  if (typeof document === "undefined") return;
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    // Appended last so it wins the tie against index.css's own :root block,
    // which has identical specificity.
    document.head.appendChild(el);
  }
  el.textContent = themeCss(theme);
}
