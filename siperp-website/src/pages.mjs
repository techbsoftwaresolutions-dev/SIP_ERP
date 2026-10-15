// Page content for siperp.in. Each page returns { path, title, description, body, jsonld? }.
// Wording sticks to what the product actually does today: no customer counts,
// testimonials or awards are claimed anywhere.

import { SITE, ico, leadForm, ctaBand, faq } from "./layout.mjs";
import { makeHomePage } from "./home.mjs";

// The legal name used in the Terms and Privacy Policy (as printed in the app's
// own footer). Confirm it is exactly right before launch.
const LEGAL_NAME = "TechB Software Solutions Pvt. Ltd.";

// Plan prices match the platform's starter plans (Super Admin -> Subscription
// Plans). If those change, change them here too and rebuild.
// Annual = pay for 10 months, get 12. Setup is a one-time fee (data import,
// invoice template, user setup and training).
export const PLANS = [
  {
    name: "Basic",
    icon: "box",
    price: "499",
    annual: "4,990",
    setup: "3,000",
    blurb: "Essentials for a small team getting started.",
    features: ["Sales & Purchase", "Inventory & stock", "GST invoicing and printing", "Up to 5 users"],
  },
  {
    name: "Professional",
    icon: "layers",
    price: "1,499",
    annual: "14,990",
    setup: "5,000",
    featured: true,
    blurb: "For growing businesses that need reporting and more seats.",
    features: ["Everything in Basic", "Sales, purchase & inventory reports", "Audit logs", "Roles & permissions", "Up to 20 users"],
  },
  {
    name: "Enterprise",
    icon: "shield",
    price: "2,999",
    annual: "29,990",
    setup: "10,000",
    blurb: "The full platform with unlimited seats and priority help.",
    features: ["Everything in Professional", "Unlimited users", "Priority support", "Manufacturing & maintenance modules on request"],
  },
];

const HOME_FAQ = [
  ["What is SIPERP?", "SIPERP stands for Smart Industry Platform. It is a cloud ERP and CRM for Indian businesses. It brings enquiries, quotations, sales, purchase, inventory, manufacturing and reports into one system, so your team stops juggling spreadsheets and separate tools."],
  ["Does it handle GST invoices?", "Yes. Invoices carry GSTIN, HSN and the right tax split (CGST + SGST within a state, IGST between states), and can be printed or downloaded as PDF, Word or CSV."],
  ["Is my data separate from other businesses?", "Yes. Every business on SIPERP has its own separate workspace and database, with its own users, roles and settings."],
  ["Can different people see different things?", "Yes. You create roles and choose, per menu, who can view, create, edit or delete. An audit log records who changed what."],
  ["How do we get started?", "Book a demo. We will show SIPERP with your kind of business in mind, then set up your workspace with your company details, users and numbering."],
];

const featureCards = [
  ["cart", "Sales", "Enquiries, quotations, sales orders, delivery challans, invoices and returns, linked from first call to final payment."],
  ["truck", "Purchase", "Purchase orders, goods receipt, supplier invoices and returns, with supplier ledgers and outstanding payables."],
  ["box", "Inventory", "Stock in, out, transfers and adjustments across warehouses, with a live stock overview."],
  ["factory", "Manufacturing", "Bills of material, work orders, job cards, material issue and production receipt, by work centre and machine."],
  ["users", "CRM & Parties", "Customers and suppliers with groups, ledgers, outstanding balances and GST details that fill in for you."],
  ["chart", "Reports", "Sales, purchase and inventory reports, plus a dashboard that shows where the business stands today."],
  ["wrench", "Maintenance", "Track machine service due dates and keep a full service history."],
  ["shield", "Roles & Security", "Role-based access down to each menu, and an audit trail of who did what."],
];

const industries = [
  ["factory", "Manufacturing", "Plan production with bills of material and work orders, issue materials, record output, and see the real cost behind every product.", ["Bill of materials & work orders", "Job cards, machines & work centres", "Raw material and finished goods stock"]],
  ["layers", "Wholesale & Distribution", "Move high volumes of stock and invoices without losing track of who owes what.", ["Fast GST invoicing & delivery challans", "Multi-warehouse stock and transfers", "Customer and supplier outstanding"]],
  ["store", "Retail", "Keep every item, price and tax rate in one catalogue and know what to reorder.", ["Item, category and brand catalogue", "Stock in/out and adjustments", "Daily sales visibility on the dashboard"]],
  ["box", "Packaging", "Quote, produce and deliver orders in many sizes and specifications without re-typing them.", ["Quotations that convert to sales orders", "Packing categories on parties and products", "Delivery challans tied to invoices"]],
  ["tag", "Trading", "Buy, store and sell with clear margins and clean books.", ["Purchase orders to goods receipt", "Sales and purchase reports", "Ledgers for every customer and supplier"]],
  ["wrench", "Services & Maintenance", "Schedule recurring service work and keep a history customers can trust.", ["Service due and service history", "Enquiry to quotation to invoice", "Reminders so nothing slips"]],
];

function featureRow({ icon, title, intro, points, art, flip }) {
  return `<div class="feature-row${flip ? " flip" : ""}">
  <div class="feature-copy">
    <div class="icon">${ico(icon)}</div>
    <h2>${title}</h2>
    <p>${intro}</p>
    <ul class="tick-list">${points.map((p) => `<li>${p}</li>`).join("")}</ul>
  </div>
  <div class="feature-art">${art}</div>
</div>`;
}

const flow = (steps, on = -1) =>
  `<div class="chip-flow">${steps
    .map((s, i) => `<span class="chip${i === on ? " on" : ""}">${s}</span>${i < steps.length - 1 ? '<span class="arrow">→</span>' : ""}`)
    .join("")}</div>`;

const orgLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "SIPERP",
  alternateName: "SIPERP: Smart Industry Platform",
  url: SITE.url,
  logo: SITE.url + "/img/logo-full.png",
  parentOrganization: { "@type": "Organization", name: SITE.company, url: SITE.companyUrl },
  contactPoint: { "@type": "ContactPoint", telephone: SITE.phoneRaw, email: SITE.email, contactType: "sales", areaServed: "IN", availableLanguage: ["en", "ta", "hi"] },
};

const softwareLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "SIPERP",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE.url,
  description: "Cloud ERP and CRM for Indian businesses: sales, purchase, inventory, manufacturing, GST invoicing and reports.",
  offers: PLANS.map((p) => ({
    "@type": "Offer",
    name: p.name,
    price: p.price.replace(",", ""),
    priceCurrency: "INR",
    description: `${p.name} plan, per month, plus GST`,
  })),
};

const faqLd = (items) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
});

const planCard = (p) => `<div class="price-card${p.featured ? " featured" : ""}">
  ${p.featured ? '<span class="tag">Most popular</span>' : ""}
  <div class="plan-head"><span class="mod-icon">${ico(p.icon || "box")}</span><div><h3>${p.name}</h3><p>${p.blurb}</p></div></div>
  <div class="price"><strong>₹${p.price}</strong><span>/ month</span></div>
  <div class="fine">+ GST. Or ₹${p.annual} a year, which is 2 months free.</div>
  <div class="fine">One-time setup ₹${p.setup}: data import, templates and training.</div>
  <ul class="tick-list">${p.features.map((f) => `<li>${f}</li>`).join("")}</ul>
  <a class="btn ${p.featured ? "btn-primary" : "btn-ghost"}" href="/book-demo/">Book a demo</a>
</div>`;

export const pages = [
  // ---------------------------------------------------------------- Home (see home.mjs)
  makeHomePage({ PLANS, planCard, HOME_FAQ, industries, orgLd, softwareLd, faqLd }),

  // ------------------------------------------------------------ Features
  {
    path: "/features/",
    title: "ERP Features: GST Billing, Inventory, Manufacturing | SIPERP",
    description: "Explore SIPERP features: GST invoicing, quotations, purchase orders, inventory, manufacturing with BOM, maintenance, CRM, reports and role-based access.",
    jsonld: [orgLd],
    body: `
<section class="page-hero"><div class="container">
  <span class="eyebrow">Features</span>
  <h1>Every part of your operation, connected</h1>
  <p>Sales, purchase, inventory, manufacturing, CRM and reports share one set of data, so every number agrees with every other number.</p>
</div></section>
<section class="section"><div class="container">
  ${featureRow({
    icon: "cart",
    title: "Sales",
    intro: "Manage the whole selling cycle in one place.",
    points: ["Enquiries with multiple products", "Quotations with item prices, tax, discount and totals", "Sales orders created from quotations in one click", "Delivery challans and GST tax invoices", "Sales returns that update stock and balances"],
    art: flow(["Enquiry", "Quotation", "Sales Order", "Challan", "Invoice", "Return"], 4),
  })}
  ${featureRow({
    icon: "truck",
    title: "Purchase",
    intro: "Buy with control and pay suppliers on time.",
    points: ["Purchase orders you can print and share", "Goods receipt against orders", "Purchase invoices and returns", "Supplier ledger and outstanding payables"],
    art: flow(["Purchase Order", "Goods Receipt", "Purchase Invoice", "Return"], 1),
    flip: true,
  })}
  ${featureRow({
    icon: "box",
    title: "Inventory",
    intro: "Always know what is on the shelf and where.",
    points: ["Stock in, stock out, transfer and adjustment", "Multiple warehouses", "Live stock overview", "Item master with categories and brands"],
    art: flow(["Stock In", "Transfer", "Stock Out", "Adjustment"], 0),
  })}
  ${featureRow({
    icon: "factory",
    title: "Manufacturing",
    intro: "Plan, issue, produce and receive, with every step recorded.",
    points: ["Bill of materials per product", "Work orders and job cards", "Material issue and production receipt", "Work centres and machines"],
    art: flow(["BOM", "Work Order", "Job Card", "Material Issue", "Production Receipt"], 1),
    flip: true,
  })}
  ${featureRow({
    icon: "wrench",
    title: "Maintenance",
    intro: "Keep machines and equipment serviced on schedule.",
    points: ["Service due list so nothing is missed", "Complete service history", "Reminders for upcoming work"],
    art: flow(["Service Due", "Service Done", "History"], 0),
  })}
  ${featureRow({
    icon: "users",
    title: "CRM and Parties",
    intro: "Every customer and supplier, with their full story.",
    points: ["Customer and supplier records with groups", "Enter a GST number and the state fills in automatically", "Ledgers and outstanding balances", "Your own custom fields"],
    art: flow(["Customer", "Ledger", "Outstanding"], 0),
    flip: true,
  })}
  ${featureRow({
    icon: "chart",
    title: "Reports and dashboard",
    intro: "See the state of the business without building spreadsheets.",
    points: ["Sales, purchase and inventory reports", "Dashboard with the numbers that matter today", "Export to CSV"],
    art: flow(["Sales", "Purchase", "Inventory"], 0),
  })}
</div></section>

<section class="section alt"><div class="container">
  <div class="section-head">
    <h2>And the things that make it dependable</h2>
  </div>
  <div class="grid grid-3">
    <div class="card"><div class="icon">${ico("shield")}</div><h3>Roles &amp; permissions</h3><p>Decide, menu by menu, who can view, create, edit or delete. Start from ready-made roles or build your own.</p></div>
    <div class="card"><div class="icon">${ico("file")}</div><h3>Audit log</h3><p>A record of who changed what and when, so questions about a figure have an answer.</p></div>
    <div class="card"><div class="icon">${ico("gear")}</div><h3>Your documents, your numbering</h3><p>Set your own number formats, choose invoice themes, add your logo, and decide how many copies print.</p></div>
    <div class="card"><div class="icon">${ico("layers")}</div><h3>Custom fields</h3><p>Add the extra details your business tracks on customers, suppliers and more.</p></div>
    <div class="card"><div class="icon">${ico("bolt")}</div><h3>Search everywhere</h3><p>Jump to any customer, order or product from one search box, and pick from searchable dropdowns everywhere.</p></div>
    <div class="card"><div class="icon">${ico("users")}</div><h3>Private workspace</h3><p>Every business has its own separate workspace, users and settings. Your data is not mixed with anyone else's.</p></div>
  </div>
</div></section>
${ctaBand({ title: "Want to see it with your own workflow?", text: "Tell us what you do and we will show the modules that fit." })}`,
  },

  // ---------------------------------------------------------- Industries
  {
    path: "/industries/",
    title: "ERP for Manufacturing, Wholesale, Retail & Trading | SIPERP",
    description: "SIPERP fits manufacturing, wholesale, distribution, retail, packaging, trading and service businesses in India. See how each industry uses it.",
    jsonld: [orgLd],
    body: `
<section class="page-hero"><div class="container">
  <span class="eyebrow">Industries</span>
  <h1>Software that speaks your trade</h1>
  <p>Different businesses care about different things. Here is how SIPERP helps in each.</p>
</div></section>
<section class="section"><div class="container">
  <div class="grid grid-2">
    ${industries
      .map(
        ([i, t, d, pts]) => `<div class="card"><div class="icon">${ico(i)}</div><h3>${t}</h3><p style="margin-bottom:14px">${d}</p>
        <ul class="tick-list">${pts.map((p) => `<li>${p}</li>`).join("")}</ul></div>`
      )
      .join("")}
  </div>
  <p style="text-align:center;color:var(--muted);margin-top:30px">Do not see your trade? SIPERP is flexible: <a href="/contact/">tell us what you do</a> and we will show you how it fits.</p>
</div></section>
${ctaBand()}`,
  },

  // -------------------------------------------------------------- Pricing
  (() => {
    const PRICING_FAQ = [
      ["Are the prices per user?", "No. Each plan has a monthly price for your whole business, with a limit on the number of users: 5 on Basic, 20 on Professional and unlimited on Enterprise."],
      ["Is GST extra?", "Yes. Prices shown are before GST."],
      ["Can I pay for several months at once?", "Yes. Pay yearly and get 2 months free: Basic ₹4,990, Professional ₹14,990 and Enterprise ₹29,990 a year, plus GST. You can also choose a term of 3, 6 or 24 months."],
      ["What is the one-time setup fee?", "It covers setting up your workspace: importing your items, customers and opening stock, setting your invoice template and users, and training your team. It is ₹3,000 on Basic, ₹5,000 on Professional and ₹10,000 on Enterprise, charged once."],
      ["Can I change plans later?", "Yes. You can move to a higher plan as your team and needs grow."],
      ["I need manufacturing or maintenance. Which plan is that?", "Those modules are set up per business. Tell us what you need on the demo and we will configure a plan that fits."],
    ];
    return {
      path: "/pricing/",
      title: "SIPERP Pricing: ERP & CRM Plans from ₹499 per Month",
      description: "SIPERP pricing: Basic ₹499, Professional ₹1,499 and Enterprise ₹2,999 per month plus GST. Save 2 months with yearly billing. Book a free demo.",
      jsonld: [softwareLd, faqLd(PRICING_FAQ)],
      body: `
<section class="page-hero"><div class="container">
  <span class="eyebrow">Pricing</span>
  <h1>Simple, clear plans</h1>
  <p>One monthly price for your whole business, not per user. Pick a plan, and move up whenever you need to.</p>
</div></section>
<section class="section"><div class="container">
  <div class="grid grid-3" style="align-items:stretch">${PLANS.map(planCard).join("")}</div>
  <p style="text-align:center;color:var(--muted);margin-top:22px">Monthly prices, before GST. Yearly billing gives 2 months free. Setup is charged once.</p>
</div></section>

<section class="section alt"><div class="container">
  <div class="section-head"><h2>Compare plans</h2></div>
  <div class="table-wrap"><table class="compare">
    <thead><tr><th>What you get</th><th>Basic</th><th>Professional</th><th>Enterprise</th></tr></thead>
    <tbody>
      <tr><td>Users</td><td>Up to 5</td><td>Up to 20</td><td>Unlimited</td></tr>
      <tr><td>Sales &amp; Purchase</td><td class="yes">✓</td><td class="yes">✓</td><td class="yes">✓</td></tr>
      <tr><td>Inventory &amp; stock</td><td class="yes">✓</td><td class="yes">✓</td><td class="yes">✓</td></tr>
      <tr><td>GST invoicing &amp; printing (PDF, Word, CSV)</td><td class="yes">✓</td><td class="yes">✓</td><td class="yes">✓</td></tr>
      <tr><td>Reports</td><td class="no">–</td><td class="yes">✓</td><td class="yes">✓</td></tr>
      <tr><td>Roles &amp; permissions</td><td class="no">–</td><td class="yes">✓</td><td class="yes">✓</td></tr>
      <tr><td>Audit logs</td><td class="no">–</td><td class="yes">✓</td><td class="yes">✓</td></tr>
      <tr><td>Priority support</td><td class="no">–</td><td class="no">–</td><td class="yes">✓</td></tr>
      <tr><td>Manufacturing &amp; maintenance modules</td><td class="no">–</td><td class="no">–</td><td>On request</td></tr>
    </tbody>
  </table></div>
</div></section>

<section class="section"><div class="container">
  <div class="section-head"><h2>Pricing questions</h2></div>
  ${faq(PRICING_FAQ)}
</div></section>
${ctaBand({ title: "Not sure which plan fits?", text: "Book a short demo. We will recommend the plan that suits your team and your trade." })}`,
    };
  })(),

  // ----------------------------------------------------------- Book a Demo
  {
    path: "/book-demo/",
    title: "Book a Free Demo | SIPERP ERP & CRM",
    description: "Book a free SIPERP demo. See sales, purchase, inventory, manufacturing and GST invoicing working for your kind of business. We will contact you shortly.",
    jsonld: [orgLd],
    body: `
<section class="page-hero"><div class="container">
  <span class="eyebrow">Book a Demo</span>
  <h1>See SIPERP working for your business</h1>
  <p>Tell us a little about you. We will get in touch to arrange a walkthrough at a time that suits you.</p>
</div></section>
<section class="section"><div class="container split">
  <div>
    <h2>What happens next</h2>
    <ul class="tick-list" style="margin-bottom:28px">
      <li>We call or message you to understand how your business works.</li>
      <li>We show the modules that matter to you: billing, stock, purchase, production.</li>
      <li>You get a clear plan and price, with no obligation.</li>
    </ul>
    <ul class="contact-list">
      <li><span class="icon">${ico("phone")}</span><div><small>Prefer to talk?</small><a href="tel:${SITE.phoneRaw}">${SITE.phone}</a></div></li>
      <li><span class="icon">${ico("whatsapp")}</span><div><small>WhatsApp</small><a href="${SITE.whatsapp}" target="_blank" rel="noopener">Chat with us</a></div></li>
      <li><span class="icon">${ico("mail")}</span><div><small>Email</small><a href="mailto:${SITE.email}">${SITE.email}</a></div></li>
    </ul>
  </div>
  <div>${leadForm({ kind: "demo", submit: "Book my demo" })}</div>
</div></section>`,
  },

  // ----------------------------------------------------------------- About
  {
    path: "/about/",
    title: "About SIPERP | Smart Industry Platform by TechB Solutions",
    description: "SIPERP is an ERP and CRM product built and supported by Techb Software Solutions in Hosur, Tamil Nadu, to help growing Indian businesses run better.",
    jsonld: [orgLd],
    body: `
<section class="page-hero"><div class="container">
  <span class="eyebrow">About us</span>
  <h1>Business software that fits how India works</h1>
  <p>SIPERP exists so a growing business can run on one dependable system instead of a pile of spreadsheets.</p>
</div></section>
<section class="section"><div class="container prose">
  <h2>Who builds SIPERP</h2>
  <p>SIPERP, the <strong>Smart Industry Platform</strong>, is built and supported by <a href="${SITE.companyUrl}" rel="noopener">${SITE.company}</a>, a software company based in Hosur, Tamil Nadu. We design and build web and mobile software for businesses, and SIPERP is our ERP and CRM product.</p>
  <h2>What we believe</h2>
  <ul>
    <li><strong>Built for Indian businesses.</strong> GST, HSN, CGST/SGST/IGST, delivery challans and the way invoices are really raised here.</li>
    <li><strong>One version of the truth.</strong> Sales, stock, purchase and accounts share the same data, so numbers agree.</li>
    <li><strong>Your data stays yours.</strong> Every business has its own private workspace, with access controlled role by role.</li>
    <li><strong>Real people on the other end.</strong> You can call, message or email us, and we set your workspace up with you.</li>
  </ul>
  <p style="margin-top:28px"><a class="btn btn-primary" href="/book-demo/">Book a demo</a> &nbsp; <a class="btn btn-ghost" href="/contact/">Contact us</a></p>
</div></section>`,
  },

  // --------------------------------------------------------------- Contact
  {
    path: "/contact/",
    title: "Contact SIPERP | Sales & Support, Hosur, Tamil Nadu",
    description: `Contact SIPERP for sales, demos and support. Call ${SITE.phone}, message us on WhatsApp or email. Our office is in Hosur, Tamil Nadu.`,
    jsonld: [orgLd],
    body: `
<section class="page-hero"><div class="container">
  <span class="eyebrow">Contact</span>
  <h1>We would love to hear from you</h1>
  <p>Questions about SIPERP, pricing or setup? Reach out and a real person will reply.</p>
</div></section>
<section class="section"><div class="container split">
  <div>
    <ul class="contact-list">
      <li><span class="icon">${ico("phone")}</span><div><small>Call</small><a href="tel:${SITE.phoneRaw}">${SITE.phone}</a></div></li>
      <li><span class="icon">${ico("whatsapp")}</span><div><small>WhatsApp</small><a href="${SITE.whatsapp}" target="_blank" rel="noopener">Message us on WhatsApp</a></div></li>
      <li><span class="icon">${ico("mail")}</span><div><small>Email</small><a href="mailto:${SITE.email}">${SITE.email}</a></div></li>
      <li><span class="icon">${ico("pin")}</span><div><small>Office</small><span>${SITE.company}<br>${SITE.address}</span></div></li>
    </ul>
    <p style="color:var(--muted)">Already a SIPERP customer? <a href="${SITE.login}" rel="noopener">Log in here</a>.</p>
  </div>
  <div>${leadForm({ kind: "contact", submit: "Send message" })}</div>
</div></section>`,
  },

  // ------------------------------------------------------- Privacy policy
  {
    path: "/privacy-policy/",
    title: "Privacy Policy | SIPERP",
    description: "How SIPERP collects, uses and protects the details you share on this website and in the application, and the choices you have over your data.",
    body: `
<section class="page-hero"><div class="container"><h1>Privacy Policy</h1><p>How we handle the details you share on this website and in the SIPERP application.</p></div></section>
<section class="section"><div class="container prose">
  <p><em>Last updated: October 2026.</em></p>
  <p>SIPERP is a product of ${LEGAL_NAME} (&ldquo;TechB&rdquo;, &ldquo;we&rdquo;). This policy explains what we collect when you visit this website or use the SIPERP application, and what we do with it.</p>

  <h2>1. This website</h2>
  <p>When you fill in the Book a Demo or Contact form we collect the details you give us: your name, company, phone number, email, type of business, team size and message. We also record your IP address and browser type to help prevent spam. We use these details only to contact you about SIPERP, to arrange a demo and to answer your questions. We do not sell them.</p>

  <h2>2. The SIPERP application</h2>
  <p>When a business uses SIPERP, it enters its own business information: customers, suppliers, products, stock, invoices, users and so on (&ldquo;Customer Data&rdquo;). We also keep account details for the people who sign in (such as name, email and role) and records of sign-in and activity so the business can see who did what.</p>
  <ul>
    <li>Customer Data belongs to the business that entered it. We process it only to provide, support and secure the service.</li>
    <li>Each business has its own separate workspace and database. We do not use one business&rsquo;s data for another.</li>
    <li>We do not sell Customer Data, and we do not use it for advertising.</li>
    <li>Our staff access a business&rsquo;s data only when needed to provide support or fix a problem, or when the law requires it.</li>
  </ul>

  <h2>3. Who else may handle data</h2>
  <p>We use trusted service providers to run SIPERP, for example for hosting, database storage and online payments. They handle data only on our instructions and to provide those services. Card and UPI payment details are handled by the payment provider and are not stored by us.</p>

  <h2>4. How long we keep data</h2>
  <p>We keep enquiry details for as long as needed to follow up with you. We keep Customer Data for as long as the business has an active subscription, and for a reasonable period afterwards so it can be exported, unless the business asks us to delete it sooner or the law requires otherwise.</p>

  <h2>5. Security</h2>
  <p>We use reasonable technical and organisational measures to protect data, including separate workspaces and role-based access inside the application. No system is completely secure, and we cannot guarantee absolute security. Please keep your password private and tell us straight away if you think your account has been misused.</p>

  <h2>6. Your choices</h2>
  <p>To see, correct or delete your personal details, email <a href="mailto:${SITE.email}">${SITE.email}</a>. A person who uses SIPERP through their employer should first contact that employer, who controls the business&rsquo;s data.</p>

  <h2>7. Cookies</h2>
  <p>This website does not use advertising or tracking cookies. The application stores a sign-in session on your device so you stay signed in.</p>

  <h2>8. Changes</h2>
  <p>We may update this policy and will change the date above when we do.</p>

  <h2>9. Contact</h2>
  <p>${LEGAL_NAME}, ${SITE.address}. Email <a href="mailto:${SITE.email}">${SITE.email}</a> or call ${SITE.phone}. See also our <a href="/terms-and-conditions/">Terms &amp; Conditions</a>.</p>
</div></section>`,
  },

  // ------------------------------------------------------ Terms & Conditions
  {
    path: "/terms-and-conditions/",
    title: "Terms & Conditions | SIPERP",
    description: "The terms that apply when you use the SIPERP website and application, including subscriptions, acceptable use, your data and liability.",
    body: `
<section class="page-hero"><div class="container"><h1>Terms &amp; Conditions</h1><p>The terms that apply when you use SIPERP.</p></div></section>
<section class="section"><div class="container prose">
  <p><em>Last updated: October 2026.</em></p>
  <p>These terms are an agreement between you and ${LEGAL_NAME} (&ldquo;TechB&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;), the maker of SIPERP (Smart Industry Platform). They cover this website and the SIPERP application (together, the &ldquo;Service&rdquo;). By using the Service you agree to them. If you use SIPERP for a business, you confirm you are allowed to accept these terms for that business (&ldquo;you&rdquo; then means the business).</p>

  <h2>1. The Service</h2>
  <p>SIPERP is cloud ERP and CRM software for sales, purchase, inventory, manufacturing, reports and related functions. Which features you can use depends on your plan and any add-ons. We may improve, change or add features over time. Features described as &ldquo;coming soon&rdquo; are not part of the Service until released.</p>

  <h2>2. Accounts and security</h2>
  <ul>
    <li>We create your workspace and an administrator account. You are responsible for who you give access to and for the roles and permissions you assign.</li>
    <li>Keep passwords confidential. You are responsible for activity under your users&rsquo; accounts, and must tell us promptly of any suspected unauthorised use.</li>
    <li>Information you give us (such as company name and GST number) must be accurate and kept up to date.</li>
  </ul>

  <h2>3. Plans, fees and payment</h2>
  <ul>
    <li>Fees are as shown on our <a href="/pricing/">Pricing</a> page or in your order or quotation. Prices exclude GST and other applicable taxes unless stated.</li>
    <li>You subscribe for the term you choose. Your subscription renews or ends as agreed when you subscribe; we may remind you before it ends.</li>
    <li>If your subscription ends or a payment is overdue, access to the application may be suspended until it is renewed. Your data is not deleted because of a suspension.</li>
    <li>Online payments are processed by a third-party payment provider. Refunds, if any, are as stated in your order or as required by law.</li>
    <li>We may change prices for future terms. A change does not affect a term you have already paid for.</li>
  </ul>

  <h2>4. Your data</h2>
  <ul>
    <li>You own the data you put into SIPERP (&ldquo;Customer Data&rdquo;). You give us permission to store and process it only to provide, support and secure the Service, as described in our <a href="/privacy-policy/">Privacy Policy</a>.</li>
    <li>You are responsible for the accuracy and legality of your Customer Data, including having the right to enter your customers&rsquo; and suppliers&rsquo; details, and for the correctness of invoices and tax figures you issue. SIPERP is a tool to help you; it does not give tax, legal or accounting advice.</li>
    <li>You can export your data using the backup tools in the application. We recommend you do so regularly, and we do not guarantee that data can always be recovered after loss.</li>
  </ul>

  <h2>5. Acceptable use</h2>
  <p>You must not: use the Service unlawfully or to infringe anyone&rsquo;s rights; try to break into, probe or overload the Service or another customer&rsquo;s workspace; reverse engineer or copy the software; upload malicious code; resell or share access outside your business without our written agreement; or use the Service to send spam. We may suspend access that puts the Service or other customers at risk.</p>

  <h2>6. Availability and support</h2>
  <p>We work to keep the Service available and to fix problems quickly, but we do not promise it will be uninterrupted or error-free. We may carry out maintenance, which we will try to schedule at low-use times. Support is provided by phone, WhatsApp and email as set out on our <a href="/contact/">Contact</a> page, or as agreed in your plan.</p>

  <h2>7. Intellectual property</h2>
  <p>The software, design, logos and name SIPERP belong to TechB and its licensors. We give you a limited, non-exclusive, non-transferable right to use the Service for your own business while your subscription is active. You keep ownership of your Customer Data and your own logos.</p>

  <h2>8. Confidentiality</h2>
  <p>Each side will keep the other&rsquo;s non-public information confidential and use it only for the purposes of the Service, except where disclosure is required by law.</p>

  <h2>9. Disclaimer and limit of liability</h2>
  <p>The Service is provided &ldquo;as is&rdquo; to the extent the law allows. We are not liable for indirect or consequential loss, loss of profit, or loss of data caused by events outside our reasonable control or by your own actions or inputs. Our total liability for any claim relating to the Service is limited to the fees you paid for the Service in the 12 months before the claim. Nothing in these terms limits liability that cannot be limited by law.</p>

  <h2>10. Ending the agreement</h2>
  <p>You may stop using the Service at any time; fees already paid for a term are not refundable unless stated in your order or required by law. We may suspend or end your access if you seriously or repeatedly breach these terms, with notice where practical. After the agreement ends we will make your data available for export for a reasonable period, then delete it unless the law requires us to keep it.</p>

  <h2>11. Changes to these terms</h2>
  <p>We may update these terms. If a change is significant we will tell you in the application or by email. Continuing to use the Service after a change means you accept it.</p>

  <h2>12. Governing law</h2>
  <p>These terms are governed by the laws of India. Subject to any rights you have by law, the courts at Hosur, Tamil Nadu have jurisdiction over disputes about them.</p>

  <h2>13. Contact</h2>
  <p>${LEGAL_NAME}, ${SITE.address}. Email <a href="mailto:${SITE.email}">${SITE.email}</a> or call ${SITE.phone}.</p>
</div></section>`,
  },
];
