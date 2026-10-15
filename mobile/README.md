# SIPERP (Smart Industry Platform) — Mobile (React Native / Expo)

The phone app for SIPERP. It talks to the **same backend** as the web
app over the same REST API, so there is no separate mobile backend.

## How it relates to the web app

- **Company code instead of subdomain.** The web app knows which client it is
  serving from its subdomain (`acme.<domain>`). A phone has no subdomain, so
  the login screen asks for that same code once, remembers it, and sends it as
  the `X-Tenant` header. Leave it empty for the main workspace.
- **Same permissions.** `/api/bootstrap` supplies the role permissions, plan /
  add-on / client module gates, Menu Management overrides, brand colour and
  subscription state. `src/navigation/menu.js` is a copy of the web sidebar's
  `NAV`, filtered by the same rules, so a menu the web hides is hidden here too.
  An expired or suspended subscription shows the same block screen.
- **Shared field configs.** The form definitions in `src/pages/**/*Fields.js`,
  `src/utils/*` and `src/print/invoiceCalc.js` are copied unchanged from
  `frontend/src`. `src/components/forms` (AddRecordForm, ItemsEditor,
  SearchableSelect, DateInput) accept the same field schema as the web
  versions. When a web `*Fields.js` changes, copy it over.
- **Same URLs.** Every screen is registered under its web route
  (`src/navigation/routes.js`), so `navigate("/sales/invoices/new", { state })`
  works as it does on the web, and `siperp://sales/invoices/INV-0001` deep
  links open the right screen.
- **Super Admin stays on the web.** The mobile app is for tenant users only.

## What's in it

Every tenant-side page of the web app has a mobile screen:

| Area | Mobile screens |
|---|---|
| Sign-in | Company code + username/password, forgot password, 12-hour session, auto sign-out on 401, subscription block screen |
| Dashboard | KPIs, production KPIs, sales trend, top customers, recent orders/invoices (each gated like the web); search + reminders in the header |
| Customers / Suppliers | List (search, status tabs), detail (call / WhatsApp / email, summary, recent orders & invoices), add/edit, groups, ledger (add/edit/delete entries), outstanding |
| Products | Items, categories, brands — list + add/edit, create category/brand/warehouse inline |
| Purchase | Orders (filters, detail, PDF, "Record GRN"), goods receipts (+ detail), invoices, returns — with the PO/GRN/invoice number lookups |
| Sales | Hub tab, enquiries, quotations, sales orders (stats, filters, convert to invoice), delivery challans (PDF), invoices (approval, PDF, make challan, AI reminder), returns |
| Inventory | Stock overview, stock detail, stock in/out, transfer, adjustment |
| Manufacturing | BOMs, work orders (+ detail: release, generate job cards, issue material, book production, cancel issue/receipt), job cards, material issues, production receipts, work centers, machines |
| Maintenance | Service due (+ new task), service history |
| Reports | Sales, purchase and inventory (valuation + low stock) with every web tab and filter, CSV/PDF export via the share sheet; financial and other report catalogues |
| Users & Roles | Users (+ invite / reset link), roles with a permission matrix, audit logs (filters + before/after detail) |
| Settings | Company (logo, signature, seal upload), numbering, invoice theme, general, email, WhatsApp, tax, backup export |
| Subscription | Plan, menu access, invoice-theme tier, in-app upgrade (Razorpay Checkout in a WebView, verified server-side) |
| AI | Assistant (ask about your data), payment reminder drafts → WhatsApp / email / share |
| Documents | Invoice / challan / PO rendered to PDF on the phone → Share (WhatsApp, email, Drive…), Print, or "Send via WhatsApp" through the WhatsApp Business API when it's set up |
| Account | Profile & password |

Differences from the web, on purpose:

- Phone PDFs use the standard GST layout; the other invoice themes apply to
  web printing.
- Sales/Purchase/Inventory reports are one screen each with tabs; the web's
  separate Inventory Valuation and Low Stock reports are two tabs here.
- The Super Admin panel is web-only.

## Setup

```bash
cd mobile
npm install
```

### Point the app at your backend

`API_BASE_URL` in `mobile/.env` (for `expo start`) and in `eas.json` (for
builds) is the API **origin without `/api`**:

- Production: `https://api.techbsoftwaresolutions.com`
- Local backend on an emulator: `http://10.0.2.2:5000` (Android) or `http://localhost:5000` (iOS)
- Local backend on a physical phone: your computer's LAN IP, e.g. `http://192.168.1.20:5000`
  (same Wi-Fi; allow port 5000 through the firewall)

### Run it

```bash
npm start
```

Scan the QR code with **Expo Go**, or press `a` / `i` for an emulator. `npm run web`
opens it in a browser, which is handy for quick checks (PDF share falls back to
the browser print dialog there).

### Build an installable app

```bash
npx eas build -p android --profile preview
```

## Notes

- The project lives in OneDrive; Metro's file watcher there misses new files
  and edits. If a change doesn't show up, stop and restart `npm start`.
- In-app plan upgrades take payment through Razorpay. Before publishing to the
  App Store / Play Store, check their rules on selling subscriptions inside an
  app (B2B SaaS is often allowed an external payment flow, but confirm), or hide
  the upgrade button in store builds.
- Files no longer used by the app (safe to delete): `src/screens/`,
  `src/config/`, `src/navigation/{CustomersStack,MenuStack,ProductsStack,SalesStack}.js`,
  `src/components/{BarTrendChart,Card,ConfirmDialog,FieldInput,ScreenHeader,StatusBadge}.js`.
