// Shared page shell for the SIPERP site: <head>, header, footer, icons.
// Everything a page repeats lives here, so changing the phone number, the
// menu or the footer is one edit followed by `node build.mjs`.

import { readFileSync } from "node:fs";

// Addresses, contact details and the app's login URL come from site.config.json
// (one file to edit), so none of them is written into the code. `npm start`
// builds with --dev, which swaps in the "development" block (local app + API).
const cfg = JSON.parse(readFileSync(new URL("../site.config.json", import.meta.url), "utf8"));
const DEV = process.argv.includes("--dev");
const env = DEV ? { ...cfg, ...(cfg.development || {}) } : cfg;
for (const key of ["siteUrl", "loginUrl", "apiUrl", "email", "phone", "phoneRaw", "whatsappNumber", "address", "company", "companyUrl"]) {
  if (!env[key]) throw new Error(`site.config.json is missing "${key}"${DEV ? " (development)" : ""}`);
}

export const SITE = {
  name: "SIPERP",
  dev: DEV,
  url: cfg.siteUrl.replace(/\/$/, ""),
  // The Login button goes straight to the application's own sign-in page. There
  // clients sign in on their own address (e.g. abc.<domain>) and the Super Admin
  // on admin.<domain>; the app handles both.
  login: env.loginUrl,
  // Where the Book a Demo / Contact forms send leads.
  apiUrl: env.apiUrl.replace(/\/$/, ""),
  phone: cfg.phone,
  phoneRaw: cfg.phoneRaw,
  whatsapp: `https://wa.me/${cfg.whatsappNumber}?text=${encodeURIComponent("Hi, I'd like to know more about SIPERP")}`,
  email: cfg.email,
  address: cfg.address,
  company: cfg.company,
  companyUrl: cfg.companyUrl,
};

const NAV = [
  { href: "/", label: "Home" },
  { href: "/features/", label: "Features" },
  { href: "/industries/", label: "Industries" },
  { href: "/pricing/", label: "Pricing" },
  { href: "/about/", label: "About" },
];

// The "Resources" dropdown. Everything in it is a real page or contact route.
const RESOURCES = [
  { href: "/contact/", label: "Contact us" },
  { href: "/book-demo/", label: "Book a demo" },
  { href: "/privacy-policy/", label: "Privacy Policy" },
  { href: SITE.whatsapp, label: "Chat on WhatsApp", external: true },
];

// Simple stroke icons (24x24), so there are no image files to host.
const ICONS = {
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L21 8H6"/>',
  box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3.3 7.5L12 12.5l8.7-5"/><path d="M12 22V12.5"/>',
  factory: '<path d="M2 20V9l6 4V9l6 4V5h4v15z"/><path d="M2 20h20"/><path d="M8 17h2M14 17h2"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
  truck: '<path d="M2 6h11v10H2z"/><path d="M13 9h4l4 4v3h-8z"/><circle cx="6.5" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/>',
  store: '<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12v8h14v-8"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 17.5L12 22l9-4.5"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  pin: '<path d="M12 21s7-5.6 7-11a7 7 0 0 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  tag: '<path d="M3 12V3h9l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  whatsapp: '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>',
};

// Most icons are outlines. Brand logos (WhatsApp) are solid shapes, so they are
// drawn filled instead of stroked.
const FILLED = new Set(["whatsapp"]);

export function ico(name) {
  if (FILLED.has(name)) {
    return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS[name] || ""}</svg>`;
  }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
}

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const logo = `<a class="logo" href="/" aria-label="SIPERP, Smart Industry Platform - home"><img src="/img/logo-full.png" alt="SIPERP: Smart Industry Platform" width="126" height="50"></a>`;

function header(path) {
  const links = NAV.map(
    (n) => `<a href="${n.href}"${path === n.href ? ' aria-current="page"' : ""}>${n.label}</a>`
  ).join("");
  const resourcesActive = RESOURCES.some((r) => !r.external && r.href === path);
  const resources = `<div class="has-menu">
      <button class="menu-toggle${resourcesActive ? " is-current" : ""}" type="button" aria-expanded="false" aria-haspopup="true">Resources ${ico("chevron")}</button>
      <div class="submenu">${RESOURCES.map(
        (r) => `<a href="${r.href}"${r.external ? ' target="_blank" rel="noopener"' : ""}${path === r.href ? ' aria-current="page"' : ""}>${r.label}</a>`
      ).join("")}</div>
    </div>`;
  return `<header class="site-header">
  <div class="container nav">
    ${logo}
    <nav class="nav-links" aria-label="Main">${links}${resources}<a class="mobile-only" href="${SITE.login}" rel="noopener">Login</a></nav>
    <div class="nav-actions">
      <button class="icon-btn search-open" type="button" aria-label="Search the site">${ico("search")}</button>
      <a class="btn btn-ghost btn-sm" href="${SITE.login}" rel="noopener">Login</a>
      <a class="btn btn-primary btn-sm" href="/book-demo/">Book a Demo <span aria-hidden="true">→</span></a>
      <button class="menu-btn" type="button" aria-label="Menu" aria-expanded="false">${ico("menu")}</button>
    </div>
  </div>
</header>`;
}

function footer() {
  return `<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div>
        ${logo}
        <p style="margin-top:14px">Smart Industry Platform. ERP and CRM software for growing Indian businesses: sales, purchase, inventory, manufacturing and reports in one place.</p>
      </div>
      <div>
        <h4>Product</h4>
        <ul>
          <li><a href="/features/">Features</a></li>
          <li><a href="/industries/">Industries</a></li>
          <li><a href="/pricing/">Pricing</a></li>
          <li><a href="/book-demo/">Book a Demo</a></li>
          <li><a href="${SITE.login}" rel="noopener">Login</a></li>
        </ul>
      </div>
      <div>
        <h4>Company</h4>
        <ul>
          <li><a href="/about/">About</a></li>
          <li><a href="/contact/">Contact</a></li>
          <li><a href="/privacy-policy/">Privacy Policy</a></li>
          <li><a href="/terms-and-conditions/">Terms &amp; Conditions</a></li>
          <li><a href="${SITE.companyUrl}" rel="noopener">${SITE.company}</a></li>
        </ul>
      </div>
      <div>
        <h4>Get in touch</h4>
        <ul>
          <li><a href="tel:${SITE.phoneRaw}">${SITE.phone}</a></li>
          <li><a href="mailto:${SITE.email}">${SITE.email}</a></li>
          <li>${SITE.address}</li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>&copy; <span id="year">2026</span> SIPERP. A product by TechB Solutions.</span>
      <span><a href="/privacy-policy/">Privacy Policy</a> &nbsp;|&nbsp; <a href="/terms-and-conditions/">Terms &amp; Conditions</a></span>
    </div>
  </div>
</footer>
<a class="wa-float" href="${SITE.whatsapp}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">${ico("whatsapp")}</a>
<div class="search-overlay" hidden>
  <div class="search-box" role="dialog" aria-modal="true" aria-label="Search the site">
    <div class="search-field">${ico("search")}<input type="search" class="search-input" placeholder="Search features, pricing, industries…" aria-label="Search" autocomplete="off"></div>
    <ul class="search-results" aria-live="polite"></ul>
    <p class="search-hint">Press Esc to close</p>
  </div>
</div>`;
}

// `jsonld` is an optional array of schema.org objects for the page.
const DEFAULT_KEYWORDS =
  "SIPERP, ERP software India, CRM software, GST billing software, GST invoicing, inventory management software, " +
  "manufacturing ERP, sales and purchase software, small business ERP, cloud ERP, Techb Software Solutions";

export function renderPage({ path, title, description, keywords = DEFAULT_KEYWORDS, body, jsonld = [], noindex = false }) {
  const url = SITE.url + path;
  const ld = jsonld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n");
  return `<!DOCTYPE html>
<html lang="en-IN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="keywords" content="${esc(keywords)}">
<meta name="author" content="${esc(SITE.company)}">
<meta name="publisher" content="${esc(SITE.company)}">
<meta name="application-name" content="SIPERP">
<meta name="apple-mobile-web-app-title" content="SIPERP">
<meta name="format-detection" content="telephone=yes">
<meta name="geo.region" content="IN-TN">
<meta name="geo.placename" content="Hosur">
<meta name="robots" content="${noindex ? "noindex, follow" : "index, follow, max-snippet:-1, max-image-preview:large"}">
<meta name="theme-color" content="#2563eb">
<meta name="siperp-api" content="${SITE.apiUrl}/api/public/demo-requests">
<meta name="siperp-phone" content="${SITE.phone}"><link rel="canonical" href="${url}">
<link rel="icon" type="image/png" sizes="64x64" href="/img/favicon.png">
<link rel="icon" type="image/png" sizes="32x32" href="/img/favicon-32.png">
<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="SIPERP">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="en_IN">
<meta property="og:image" content="${SITE.url}/img/og-image.png">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="SIPERP, Smart Industry Platform, a product by TechB Solutions">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${SITE.url}/img/og-image.png">
<link rel="stylesheet" href="/css/style.css">
<link rel="stylesheet" href="/css/home.css">
${ld}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${header(path)}
<main id="main">
${body}
</main>
${footer()}
<script src="/js/main.js" defer></script>
</body>
</html>
`;
}

// The Book a Demo / Contact form. `kind` is stored with the lead.
export function leadForm({ kind, submit = "Book my demo", showMessage = true }) {
  return `<form class="form-card" data-lead="${kind}" novalidate>
  <div class="form-grid">
    <div><label for="${kind}-name">Your name <span class="req">*</span></label><input id="${kind}-name" name="name" autocomplete="name" required maxlength="80"></div>
    <div><label for="${kind}-company">Company</label><input id="${kind}-company" name="company" autocomplete="organization" maxlength="120"></div>
    <div><label for="${kind}-phone">Phone</label><input id="${kind}-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="10-digit mobile number" maxlength="20"></div>
    <div><label for="${kind}-email">Email</label><input id="${kind}-email" name="email" type="email" autocomplete="email" maxlength="120"></div>
    <div><label for="${kind}-industry">Type of business</label>
      <select id="${kind}-industry" name="industry">
        <option value="">Select…</option>
        <option>Manufacturing</option><option>Wholesale &amp; Distribution</option><option>Retail</option>
        <option>Packaging</option><option>Trading</option><option>Services &amp; Maintenance</option><option>Other</option>
      </select></div>
    <div><label for="${kind}-team">Team size</label>
      <select id="${kind}-team" name="teamSize">
        <option value="">Select…</option>
        <option value="1-5">1 – 5 people</option><option value="6-20">6 – 20 people</option><option value="21-50">21 – 50 people</option>
        <option value="51-200">51 – 200 people</option><option value="200+">200+ people</option>
      </select></div>
    ${
      showMessage
        ? `<div class="full"><label for="${kind}-message">What would you like to see?</label><textarea id="${kind}-message" name="message" maxlength="1500" placeholder="For example: GST invoicing, stock tracking, production planning…"></textarea></div>`
        : ""
    }
    <div class="hp" aria-hidden="true"><label>Website <input name="website" tabindex="-1" autocomplete="off"></label></div>
    <div class="full"><button class="btn btn-primary btn-lg" type="submit" style="width:100%">${submit}</button></div>
  </div>
  <div class="form-msg" role="status" aria-live="polite"></div>
  <p class="form-note">Give us a phone number or an email. We only use it to contact you about SIPERP. See our <a href="/privacy-policy/">Privacy Policy</a> and <a href="/terms-and-conditions/">Terms &amp; Conditions</a>.</p>
</form>`;
}

export function ctaBand({ title = "See SIPERP running your kind of business", text = "Book a free demo and we will walk you through the modules that matter to you.", primary = "Book a Demo" } = {}) {
  return `<section class="section"><div class="container"><div class="cta-band">
  <h2>${title}</h2>
  <p>${text}</p>
  <div class="hero-cta">
    <a class="btn btn-light btn-lg" href="/book-demo/">${primary}</a>
    <a class="btn btn-outline-light btn-lg" href="tel:${SITE.phoneRaw}">Call ${SITE.phone}</a>
  </div>
</div></div></section>`;
}

export function faq(items) {
  return `<div class="faq">${items
    .map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`)
    .join("")}</div>`;
}
