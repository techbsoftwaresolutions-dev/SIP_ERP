// Builds the SIPERP site into ./dist as plain static files.
//
//   node build.mjs
//
// Upload the CONTENTS of dist/ to public_html on Hostinger (see README.md).
// There is no framework or runtime: dist/ is just HTML, CSS and one small JS file.

import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderPage, SITE } from "./src/layout.mjs";
import { pages } from "./src/pages.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, "dist");

// Empty dist/ rather than deleting the folder itself, so a preview server or a
// terminal sitting inside it does not make the build fail.
mkdirSync(dist, { recursive: true });
for (const entry of readdirSync(dist)) rmSync(join(dist, entry), { recursive: true, force: true });
cpSync(join(root, "src", "static"), dist, { recursive: true });

for (const page of pages) {
  const dir = page.path === "/" ? dist : join(dist, page.path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), renderPage(page));
}

// A friendly 404 for Apache/LiteSpeed (referenced from .htaccess).
writeFileSync(
  join(dist, "404.html"),
  renderPage({
    path: "/404.html",
    title: "Page not found | SIPERP",
    description: "That page could not be found.",
    noindex: true,
    body: `<section class="page-hero"><div class="container"><h1>Page not found</h1><p>The page you were looking for is not here. Try the <a href="/">home page</a> or <a href="/contact/">contact us</a>.</p></div></section>`,
  })
);

const today = new Date().toISOString().slice(0, 10);
const priority = (p) => (p === "/" ? "1.0" : p === "/book-demo/" || p === "/pricing/" ? "0.9" : p === "/privacy-policy/" || p === "/terms-and-conditions/" ? "0.3" : "0.8");
writeFileSync(
  join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
    .filter((p) => !p.noindex)
    .map((p) => `  <url><loc>${SITE.url}${p.path}</loc><lastmod>${today}</lastmod><priority>${priority(p.path)}</priority></url>`)
    .join("\n")}\n</urlset>\n`
);
// The header search box reads this: one entry per page, plus the main topics,
// each pointing at the page that covers it.
const topics = [
  ["Sales, quotations and invoices", "/features/", "enquiry quotation sales order delivery challan invoice gst return"],
  ["Purchase orders and goods receipt", "/features/", "purchase order grn goods receipt supplier invoice return payable"],
  ["Inventory and stock", "/features/", "stock warehouse transfer adjustment item inventory"],
  ["Manufacturing", "/features/", "bom bill of material work order job card production machine work centre"],
  ["Maintenance", "/features/", "service due service history machine maintenance reminder"],
  ["Customers and suppliers (CRM)", "/features/", "crm customer supplier ledger outstanding gst"],
  ["Reports and dashboard", "/features/", "report dashboard analytics export csv"],
  ["Roles, permissions and audit log", "/features/", "security role permission audit log access users"],
  ["Pricing plans", "/pricing/", "price plan basic professional enterprise cost subscription gst"],
  ["Book a demo", "/book-demo/", "demo trial walkthrough contact sales"],
  ["Terms and conditions", "/terms-and-conditions/", "terms conditions agreement subscription refund liability legal"],
  ["Privacy policy", "/privacy-policy/", "privacy data security cookies personal information"],
  ["Log in to SIPERP", SITE.login, "login sign in account"],
];
const pageLabel = { "/": "Home", "/features/": "Features", "/industries/": "Industries", "/pricing/": "Pricing", "/book-demo/": "Book a Demo", "/about/": "About SIPERP", "/contact/": "Contact", "/privacy-policy/": "Privacy Policy", "/terms-and-conditions/": "Terms & Conditions" };
writeFileSync(
  join(dist, "search-index.json"),
  JSON.stringify([
    ...pages.map((p) => ({ title: pageLabel[p.path] || p.title, url: p.path, text: p.description, keywords: "" })),
    ...topics.map(([title, url, keywords]) => ({ title, url, text: "", keywords })),
  ])
);
writeFileSync(join(dist, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE.url}/sitemap.xml\n`);

if (!existsSync(join(dist, "index.html"))) throw new Error("Build failed: no index.html");
console.log(`Built ${pages.length} pages into ${dist}`);
