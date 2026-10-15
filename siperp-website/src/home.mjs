// The landing page (Home). Laid out like the approved design: hero with a product
// carousel, core modules, enquiry-to-invoice flow, industries, 3 steps, pricing,
// "why SIPERP" + FAQ, and a closing call to action.
//
// Everything on screen is true of the product today. The product pictures are
// drawn in HTML/SVG (no screenshots to host) and are labelled as sample data.

import { SITE, ico, faq } from "./layout.mjs";

const arrow = '<span class="arr" aria-hidden="true">→</span>';

// ---- the product mock used in the hero (3 slides) and next to the steps ----
const SIDE = [
  ["Dashboard", "chart"],
  ["Sales", "cart"],
  ["Purchase", "truck"],
  ["Inventory", "box"],
  ["Manufacturing", "factory"],
  ["Reports", "file"],
  ["Settings", "gear"],
];

let mockCount = 0;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];

function chrome(active, kpis, body, label) {
  return `<div class="app" role="group" aria-label="${label}">
  <div class="app-side">
    <span class="app-brand"><img src="/img/logo-mark.png" alt=""></span>
    ${SIDE.map(([l, i], n) => `<span class="${n === active ? "on" : ""}">${ico(i)}<em>${l}</em></span>`).join("")}
  </div>
  <div class="app-main">
    <div class="app-top">
      <span class="app-search">${ico("search")}Search anything...</span>
      <span class="app-user"><i></i><b>Admin<small>Administrator</small></b></span>
    </div>
    <div class="app-kpis">
      ${kpis.map(([a, b, c]) => `<div><small>${a}</small><strong>${b}</strong><em>● ${c}</em></div>`).join("")}
    </div>
    ${body}
  </div>
</div>`;
}

function dashboardSlide() {
  const gid = `ag${++mockCount}`; // unique per copy, since the mock appears more than once
  return chrome(
    0,
    [
      ["Total Sales", "₹12,41,200", "12% from last month"],
      ["Total Purchase", "₹8,32,150", "8% from last month"],
      ["Total Stock Value", "₹4,28,900", "6% from last month"],
    ],
    `<div class="app-row">
      <div class="app-chart"><small>Sales Overview</small>
        <svg viewBox="0 0 300 110" preserveAspectRatio="none" aria-hidden="true">
          <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2563eb" stop-opacity=".25"/><stop offset="1" stop-color="#2563eb" stop-opacity="0"/></linearGradient></defs>
          <g stroke="#e5ebf5" stroke-width="1"><path d="M0 20H300M0 50H300M0 80H300"/></g>
          <path d="M0 92 C25 88 40 74 62 78 S100 98 130 72 S175 34 200 52 S245 34 270 20 S290 14 300 10 L300 110 L0 110Z" fill="url(#${gid})"/>
          <path d="M0 92 C25 88 40 74 62 78 S100 98 130 72 S175 34 200 52 S245 34 270 20 S290 14 300 10" fill="none" stroke="#2563eb" stroke-width="2.4" stroke-linecap="round"/>
          <circle cx="200" cy="52" r="4" fill="#fff" stroke="#2563eb" stroke-width="2"/>
        </svg>
        <span class="app-tip">₹12.4L</span>
        <div class="app-axis">${MONTHS.map((m) => `<span>${m}</span>`).join("")}</div>
      </div>
      <div class="app-actions"><small>Quick Actions</small>
        <ul>
          <li>${ico("file")}New Sales Invoice</li>
          <li>${ico("truck")}Purchase Order</li>
          <li>${ico("box")}Stock Adjustment</li>
          <li>${ico("factory")}Production Entry</li>
        </ul>
      </div>
    </div>`,
    "Illustration of the SIPERP dashboard with sample data"
  );
}

function salesSlide() {
  const rows = [
    ["INV-0142", "ABC Traders", "₹1,25,000", "Paid", "ok"],
    ["INV-0141", "Sunrise Pvt Ltd", "₹85,000", "Pending", "wait"],
    ["INV-0140", "Galaxy Retail", "₹2,14,000", "Paid", "ok"],
    ["INV-0139", "Prime Motors", "₹68,000", "Pending", "wait"],
  ];
  return chrome(
    1,
    [
      ["Invoices today", "18", "3 more than yesterday"],
      ["Paid", "₹6,20,000", "11 invoices"],
      ["Pending", "₹3,10,000", "7 invoices"],
    ],
    `<div class="app-table"><small>Recent Sales Invoices</small>
      <table><tbody>${rows
        .map(([n, c, a, s, k]) => `<tr><td>${n}</td><td>${c}</td><td>${a}</td><td><span class="st ${k}">${s}</span></td></tr>`)
        .join("")}</tbody></table>
    </div>`,
    "Illustration of the SIPERP sales invoices screen with sample data"
  );
}

function stockSlide() {
  const bars = [
    ["Main", 88],
    ["Unit 2", 62],
    ["Store", 74],
    ["Dispatch", 40],
    ["Scrap", 18],
  ];
  return chrome(
    3,
    [
      ["Items in stock", "248", "across 5 warehouses"],
      ["Low stock", "6", "need reordering"],
      ["Stock value", "₹4,28,900", "6% from last month"],
    ],
    `<div class="app-row">
      <div class="app-chart"><small>Stock by Warehouse</small>
        <div class="app-bars">${bars.map(([l, h]) => `<span style="height:${h}%"><em>${l}</em></span>`).join("")}</div>
      </div>
      <div class="app-actions"><small>Low Stock</small>
        <ul><li>${ico("box")}M8 Hex Bolt</li><li>${ico("box")}Packing Tape</li><li>${ico("box")}Corrugated Box L</li><li>${ico("box")}Strap 12mm</li></ul>
      </div>
    </div>`,
    "Illustration of the SIPERP stock overview with sample data"
  );
}

function phoneMock() {
  return `<div class="phone" aria-hidden="true">
  <div class="phone-top"><span></span><span></span></div>
  <div class="phone-body">
    <div class="phone-card"><small>Today's Invoices</small><strong>₹2,45,000</strong><em>▲ 12%</em></div>
    <small class="phone-label">Sales</small>
    <div class="phone-bars"><span style="height:30%"></span><span style="height:46%"></span><span style="height:40%"></span><span style="height:68%"></span><span style="height:100%"></span></div>
  </div>
</div>`;
}

const moduleCards = [
  ["cart", "Sales", "Enquiries, quotations, sales orders, delivery challans, invoices and returns, all linked together."],
  ["truck", "Purchase", "Purchase orders, goods receipt, supplier invoices and returns, with outstanding payables."],
  ["box", "Inventory", "Stock in, out, transfers and adjustments across warehouses, with a live stock overview."],
  ["factory", "Manufacturing", "Bills of material, work orders, job cards and production receipt, by work centre and machine."],
  ["users", "CRM & Parties", "Customers and suppliers with ledgers, outstanding balances and GST details that fill in for you."],
  ["chart", "Reports", "Sales, purchase and inventory reports, plus a dashboard that shows where you stand today."],
  ["wrench", "Maintenance", "Track machine service due dates and keep a complete service history."],
  ["shield", "Roles & Security", "Control access menu by menu, and keep an audit trail of who changed what."],
];

const tradeIcons = { Manufacturing: "factory", "Wholesale & Distribution": "truck", Retail: "store", Packaging: "box", Trading: "tag", "Services & Maintenance": "wrench" };
const tradeText = {
  Manufacturing: "Raw materials, production and finished goods with ease.",
  "Wholesale & Distribution": "Handle bulk orders, multiple warehouses and outstanding.",
  Retail: "Items, prices and tax rates in one catalogue, with stock you can trust.",
  Packaging: "Quote, produce and deliver orders in many sizes and specifications.",
  Trading: "Simplify purchase, sales and vendor management.",
  "Services & Maintenance": "Track service work and keep a history customers trust.",
};

export function makeHomePage({ PLANS, planCard, HOME_FAQ, industries, orgLd, softwareLd, faqLd }) {
  return {
    path: "/",
    title: "SIPERP | ERP & CRM Software for Indian Businesses",
    description:
      "SIPERP is cloud ERP and CRM software for Indian businesses. GST invoicing, sales, purchase, inventory and manufacturing in one place. Book a free demo.",
    jsonld: [orgLd, softwareLd, faqLd(HOME_FAQ)],
    body: `
<section class="hero2"><div class="container hero2-grid">
  <div class="hero2-copy">
    <span class="pill">ERP for growing businesses</span>
    <h1>One system to run your <em>sales, purchase, stock</em> and <em>production.</em></h1>
    <p class="lead">SIPERP helps small and medium businesses streamline operations, reduce manual work and make data-driven decisions, all in one powerful, easy-to-use platform.</p>
    <div class="hero-cta">
      <a class="btn btn-primary btn-lg" href="/book-demo/">Book a Free Demo ${arrow}</a>
      <a class="btn btn-white btn-lg" href="/features/"><span class="play" aria-hidden="true">▶</span> Explore Features</a>
    </div>
    <ul class="hero-points"><li>Easy to use</li><li>Secure &amp; reliable</li><li>GST ready</li><li>Phone &amp; WhatsApp support</li></ul>
  </div>
  <div class="hero2-art">
    <div class="blob" aria-hidden="true"></div>
    <div class="hero-slides" aria-roledescription="carousel" aria-label="SIPERP product preview">
      <div class="slide is-active" data-slide>${dashboardSlide()}</div>
      <div class="slide" data-slide>${salesSlide()}</div>
      <div class="slide" data-slide>${stockSlide()}</div>
    </div>
    ${phoneMock()}
    <div class="hero-ctrl">
      <button type="button" class="ctrl-prev" aria-label="Previous slide">‹</button>
      <span class="ctrl-dots"><button type="button" class="on" aria-label="Show slide 1"></button><button type="button" aria-label="Show slide 2"></button><button type="button" aria-label="Show slide 3"></button></span>
      <button type="button" class="ctrl-next" aria-label="Next slide">›</button>
    </div>
    <p class="sample">Illustration with sample data</p>
  </div>
</div></section>

<section class="section"><div class="container">
  <div class="head-row">
    <div class="section-head left" style="margin-bottom:0">
      <span class="eyebrow">Core modules</span>
      <h2>The modules a growing business actually needs</h2>
      <p>Start with sales and billing. Switch on purchase, inventory and manufacturing as you grow. They all share the same data, so you always stay in sync.</p>
    </div>
    <a class="link-arrow" href="/features/">View all features ${arrow}</a>
  </div>
  <div class="grid grid-4 mod-grid">
    ${moduleCards
      .map(
        ([i, t, d]) => `<a class="mod" href="/features/"><span class="mod-icon">${ico(i)}</span><h3>${t}</h3><p>${d}</p><span class="mod-arr" aria-hidden="true">→</span></a>`
      )
      .join("")}
  </div>
</div></section>

<section class="section tint"><div class="container flow-grid">
  <div>
    <span class="eyebrow">Smart · Simple · Powerful</span>
    <h2>From first enquiry to final invoice, without re-typing</h2>
    <p style="color:var(--muted)">Every step carries the one before it. A quotation becomes a sales order in one click, and the order flows through delivery to a GST invoice.</p>
    <ul class="tick-list" style="margin:18px 0 26px">
      <li>Multi-product enquiries and quotations with discounts</li>
      <li>Convert a quotation to a sales order in a click</li>
      <li>Print, PDF, Word or CSV, with the number of copies you set</li>
    </ul>
    <a class="btn btn-primary" href="/features/">See how it works ${arrow}</a>
  </div>
  <div class="flow-art">
    <div class="so-card">
      <div class="so-head"><b>Sales Order</b><span class="badge-new">New</span></div>
      <table>
        <thead><tr><th>Customer</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td>ABC Traders</td><td>₹1,25,000</td><td><span class="st ok">Paid</span></td></tr>
          <tr><td>Sunrise Pvt Ltd</td><td>₹85,000</td><td><span class="st wait">Pending</span></td></tr>
          <tr><td>Galaxy Retail</td><td>₹2,14,000</td><td><span class="st ok">Paid</span></td></tr>
          <tr><td>Prime Motors</td><td>₹68,000</td><td><span class="st wait">Pending</span></td></tr>
        </tbody>
      </table>
    </div>
    <ol class="flow-steps">
      <li>${ico("cart")}<span>Sales</span></li>
      <li>${ico("truck")}<span>Purchase</span></li>
      <li>${ico("box")}<span>Inventory</span></li>
      <li>${ico("file")}<span>Invoices</span></li>
    </ol>
    <p class="sample">Illustration with sample data</p>
  </div>
</div></section>

<section class="section"><div class="container">
  <div class="section-head left">
    <span class="eyebrow">Built for your trade</span>
    <h2>Made for the way Indian businesses work</h2>
  </div>
  <div class="trade-row">
    ${industries
      .map(
        ([, t]) => `<div class="trade"><span class="mod-icon">${ico(tradeIcons[t] || "layers")}</span><h3>${t}</h3><p>${tradeText[t] || ""}</p></div>`
      )
      .join("")}
  </div>
  <p style="text-align:center;margin:30px 0 0"><a class="btn btn-ghost" href="/industries/">Explore all industries ${arrow}</a></p>
</div></section>

<section class="section tint"><div class="container steps-grid">
  <div>
    <span class="eyebrow">Simple 3-step process</span>
    <h2>Up and running in three steps</h2>
    <div class="steps2">
      <div class="step2"><span class="mod-icon">${ico("file")}</span><h3>Book a demo</h3><p>Tell us about your business. We show you SIPERP with your workflow in mind.</p></div>
      <div class="step2"><span class="mod-icon">${ico("gear")}</span><h3>We set you up</h3><p>Your private workspace, company details, users, roles and numbering, ready to go.</p></div>
      <div class="step2"><span class="mod-icon">${ico("bolt")}</span><h3>Start working</h3><p>Your team signs in from any browser and starts raising quotations, invoices and orders.</p></div>
    </div>
    <p style="margin:26px 0 0"><a class="btn btn-primary" href="/book-demo/">Book a demo ${arrow}</a></p>
  </div>
  <div class="steps-art">
    <span class="script" aria-hidden="true">Your business,<br>our priority</span>
    <div class="blob" aria-hidden="true"></div>
    <div class="mini">${dashboardSlide()}${phoneMock()}</div>
  </div>
</div></section>

<section class="section"><div class="container">
  <div class="section-head">
    <span class="eyebrow">Transparent pricing</span>
    <h2>Clear monthly plans</h2>
    <p>Flexible plans that fit your business. Move up whenever you grow.</p>
  </div>
  <div class="grid grid-3 plans">${PLANS.map(planCard).join("")}</div>
  <p style="text-align:center;margin-top:24px"><a class="link-arrow" href="/pricing/">Compare plans in detail ${arrow}</a></p>
</div></section>

<section class="section tint"><div class="container why-grid">
  <div class="why-card">
    <span class="eyebrow on-dark">Built for Indian businesses</span>
    <h2>Everything your team needs, in one dependable system.</h2>
    <ul class="tick-list on-dark">
      <li>GST-ready invoices with the right CGST, SGST or IGST split</li>
      <li>A separate, private workspace and database for every business</li>
      <li>Roles, permissions and an audit log you can rely on</li>
    </ul>
    <a class="btn btn-light" href="/book-demo/">Book a demo ${arrow}</a>
  </div>
  <div class="faq-card">
    <span class="eyebrow">Frequently asked questions</span>
    <h2>Quick answers to common questions</h2>
    ${faq(HOME_FAQ)}
  </div>
</div></section>

<section class="section" style="padding-top:20px"><div class="container"><div class="cta2">
  <a class="cta2-logo" href="/" aria-label="SIPERP home"><img src="/img/logo-full.png" alt="SIPERP: Smart Industry Platform" width="190" height="75"></a>
  <div class="cta2-copy">
    <h2>See SIPERP running your kind of business</h2>
    <p>Book a free demo and see how we can help you grow, simplify and scale.</p>
    <div class="hero-cta">
      <a class="btn btn-light btn-lg" href="/book-demo/">Book a Demo ${arrow}</a>
      <a class="btn btn-outline-light btn-lg" href="tel:${SITE.phoneRaw}">${ico("phone")} ${SITE.phone}</a>
    </div>
  </div>
</div></div></section>`,
  };
}
