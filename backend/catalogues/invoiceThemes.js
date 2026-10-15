// Invoice print themes, and which subscription tier unlocks each one.
//
// This file is the single source of truth for the CATALOGUE and the TIER
// rules. The actual layouts live in the frontend (frontend/src/print/), keyed
// by the same `key` values — the server never renders an invoice, it only
// decides which themes a client is entitled to pick.
//
// Tiers are ordered: a plan on "advanced" gets every basic theme as well.
// A plan with no tier set falls back to "basic", so an existing plan keeps
// working and never silently hands out premium themes.

const TIERS = ["basic", "advanced", "premium"];

const THEMES = [
  // ---- Basic: the compliance essentials, no colour choice ----
  {
    key: "simple",
    label: "Simple",
    tier: "basic",
    paper: "a4",
    family: "plain",
    description: "Rules and type only. Photocopies cleanly, uses no colour ink.",
  },
  {
    key: "billbook",
    label: "Classic",
    tier: "basic",
    paper: "a4",
    family: "band",
    description: "The standard GST layout with a header band and bank block.",
  },
  {
    key: "billbook-a5",
    label: "Classic (A5)",
    tier: "basic",
    paper: "a5",
    family: "band",
    description: "Half-page version for counter sales. Same compliance, half the paper.",
  },

  // ---- Advanced: colour, distinctive layouts, HSN tax summary ----
  {
    key: "modern",
    label: "Modern",
    tier: "advanced",
    paper: "a4",
    family: "band",
    description: "Solid accent header, zebra rows, totals in a tinted block.",
  },
  {
    key: "stylish",
    label: "Stylish",
    tier: "advanced",
    paper: "a4",
    family: "rail",
    description: "Vertical accent rail carrying the document title.",
  },
  {
    key: "advanced-gst",
    label: "Advanced GST",
    tier: "advanced",
    paper: "a4",
    family: "grid",
    description: "Fully boxed grid with the HSN-wise tax summary accountants ask for.",
  },
  {
    key: "advanced-gst-a5",
    label: "Advanced GST (A5)",
    tier: "advanced",
    paper: "a5",
    family: "grid",
    description: "The boxed GST grid on half a page.",
  },

  // ---- Premium: presentation pieces ----
  {
    key: "tally",
    label: "Advanced GST (Tally)",
    tier: "premium",
    paper: "a4",
    family: "grid",
    description: "Dense monochrome grid that mirrors a Tally printout line for line.",
  },
  {
    key: "luxury",
    label: "Luxury",
    tier: "premium",
    paper: "a4",
    family: "plate",
    description: "Dark header plate, gold hairline, serif figures.",
  },
  {
    key: "festive",
    label: "Festive",
    tier: "premium",
    paper: "a4",
    family: "band",
    description: "Decorative border for Diwali, Onam and seasonal billing.",
  },
];

const DEFAULT_THEME = "billbook";
const DEFAULT_ACCENT = "#2f4a7d";

// The three formats that existed before themes did, so a tenant carrying one
// of the old values in Settings lands on the closest equivalent instead of
// falling back to the default and appearing to lose their choice.
const LEGACY_ALIASES = {
  default: "billbook",
  portrait: "simple",
  color: "modern",
};

// ---- Registry overlay (models/InvoiceTemplate.js) ----
//
// Everything above is what the platform SHIPS. A super admin can move a
// template between tiers, rename it, reorder the picker or withdraw it
// entirely, and those overrides are stored per key. Resolving merges the two
// so nothing downstream has to know which is which.

// Seeded on first read and back-filled when a template is added to the code
// catalogue. Everything seeds with the tier it already has and active, so
// creating these rows entitles nobody to anything new.
function templateSeedRows() {
  return THEMES.map((t, i) => ({
    key: t.key,
    label: t.label,
    description: t.description,
    tier: t.tier,
    status: "active",
    order: (i + 1) * 10,
    isDefault: t.key === DEFAULT_THEME,
  }));
}

// The catalogue as it actually stands: shipped templates with any overrides
// applied, disabled ones removed, in picker order. An empty registry gives
// back exactly THEMES, which is how every install behaves until the screen
// is opened for the first time.
function resolveTemplates(templateDocs) {
  const byKey = new Map((templateDocs || []).map((d) => [d.key, d]));
  const seeds = templateSeedRows();
  return THEMES.map((t, i) => {
    const o = byKey.get(t.key) || {};
    const seed = seeds[i];
    return {
      ...t,
      label: o.label || t.label,
      description: o.description || t.description,
      tier: TIERS.includes(o.tier) ? o.tier : t.tier,
      status: o.status === "disabled" ? "disabled" : "active",
      order: o.order === undefined || o.order === null ? seed.order : o.order,
      isDefault: Boolean(o.isDefault),
      // What it ships with, so the admin screen can mark what has been
      // changed and say what "reset" would restore.
      defaultLabel: t.label,
      defaultTier: t.tier,
    };
  })
    .filter((t) => t.status !== "disabled")
    .sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
}

// Which template a client falls back to: whichever row is marked default,
// else the shipped default, else the first thing they are entitled to.
// Never returns nothing — a client must always be able to print.
function defaultTemplateFor(catalogue, allowedKeys) {
  const marked = (catalogue || []).find((t) => t.isDefault && allowedKeys.includes(t.key));
  if (marked) return marked.key;
  if (allowedKeys.includes(DEFAULT_THEME)) return DEFAULT_THEME;
  return allowedKeys[0];
}

function normaliseTier(tier) {
  const t = String(tier || "").trim().toLowerCase();
  return TIERS.includes(t) ? t : "basic";
}

// Every theme at or below the given tier. `catalogue` is the resolved list
// (see resolveTemplates); omitting it falls back to what the platform ships,
// so a caller that has not loaded the registry behaves exactly as before.
function themesForTier(tier, catalogue) {
  const max = TIERS.indexOf(normaliseTier(tier));
  return (catalogue || THEMES).filter((t) => TIERS.indexOf(normaliseTier(t.tier)) <= max);
}

function themeKeysForTier(tier, catalogue) {
  return themesForTier(tier, catalogue).map((t) => t.key);
}

// Resolve whatever is stored in Settings to a theme this plan may actually
// use. An unknown key, a legacy format name, or a theme above the plan's
// tier all resolve to the best allowed theme rather than erroring — a
// downgraded client must still be able to print.
function resolveTheme(stored, tier, catalogue) {
  const allowed = themeKeysForTier(tier, catalogue);
  const raw = String(stored || "").trim();
  const key = LEGACY_ALIASES[raw] || raw;
  if (allowed.includes(key)) return key;
  // Covers a template that was withdrawn or moved above this client's tier
  // after they picked it: they land on the default rather than on an error.
  return defaultTemplateFor(catalogue, allowed);
}

// Picking your own accent colour is itself a paid feature — Basic prints in
// the default ink, which is also what myBillBook does.
function canPickAccent(tier) {
  return normaliseTier(tier) !== "basic";
}

const HEX = /^#[0-9a-fA-F]{6}$/;

function resolveAccent(stored, tier) {
  if (!canPickAccent(tier)) return DEFAULT_ACCENT;
  const v = String(stored || "").trim();
  return HEX.test(v) ? v : DEFAULT_ACCENT;
}

module.exports = {
  TIERS,
  THEMES,
  DEFAULT_THEME,
  DEFAULT_ACCENT,
  LEGACY_ALIASES,
  normaliseTier,
  templateSeedRows,
  resolveTemplates,
  defaultTemplateFor,
  themesForTier,
  themeKeysForTier,
  resolveTheme,
  canPickAccent,
  resolveAccent,
};
