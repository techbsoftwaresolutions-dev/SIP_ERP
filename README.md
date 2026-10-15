# SIPERP Manufacturing ERP

A full-stack manufacturing ERP, with a separate frontend and backend. Production
(BOMs, work orders, job cards) sits alongside the usual purchase, inventory and
sales modules, and the two halves are connected: issuing material to a work
order takes raw material out of stock, and booking its output puts finished
goods back in.

- **frontend/** — React 19 + Vite, React Router, Recharts. Talks to the backend over REST.
- **backend/** — Node.js + Express REST API, backed by **MongoDB** (via Mongoose).

### Backend layout

```
backend/
├─ server.js          entry point (keep it here — hosting starts this file)
├─ .env, package.json
├─ config/            db.js — MongoDB connection
├─ routes/            aiRoutes, manufacturingRoutes, superAdminRoutes, tenantAdminRoutes
├─ middleware/        adminAudit — platform-admin audit trail
├─ auth/              clientAuth (sessions), superAdminAuth, permissions (roles/menus)
├─ tenancy/           tenantModels (per-client databases), tenantContext, subscription
├─ catalogues/        menu, notification, payment, theme and invoice-theme definitions
├─ services/          mailer, whatsapp, reminders, approvalEngine, AI and payment clients
├─ models/            Mongoose schemas
└─ scripts/           one-off tools: create-super-admin, sync-indexes, seed-tenants, reset-db, …
```

### Frontend layout

```
frontend/src/
├─ main.jsx, App.jsx        entry and all routes
├─ index.css, App.css       global styles
├─ api/                     client.js (API calls, caching), adminClient.js
├─ context/                 auth, permissions, theme, subscription state
├─ hooks/, utils/, config/  shared helpers
├─ print/                   printable invoice layouts
├─ assets/                  images
├─ components/
│  ├─ ui/         Icon, Loader, Modal, Toast, StatusBadge, ConfirmDialog, …
│  ├─ layout/     Layout, Sidebar, Topbar, PageHeader, MobileNav, banners
│  ├─ routing/    ProtectedRoute, AdminProtectedRoute
│  ├─ forms/      AddRecordForm, ItemsEditor, DateInput, SearchableSelect, …
│  ├─ data/       DataTable, Pagination, TableSearch, SimpleListPage, ledgers
│  └─ share/      WhatsApp / email sharing, payment-reminder dialog
└─ pages/                   one folder per feature
   auth · dashboard · customers · suppliers · products · purchase · inventory ·
   manufacturing · sales · reports · users · settings · admin (platform admin) · ai · maintenance
```

There is no demo/sample data baked into the project — every list starts empty and you populate it yourself through the app's own "+ New ..." / "+ Add ..." forms.

## Login

The app opens on a login page. This is a **demo build** — authentication is not real. Enter any non-empty username and password (e.g. `admin` / `admin123`) and you'll be signed in.

## Database (MongoDB)

All data is stored in MongoDB. You need a MongoDB instance the backend can connect to — either installed locally or a free MongoDB Atlas cluster.

**Option A — Local MongoDB**
1. Install [MongoDB Community Server](https://www.mongodb.com/try/download/community) and make sure it's running (`mongod` listening on `localhost:27017`).
2. `backend/.env` defaults to `MONGODB_URI=mongodb://127.0.0.1:27017/siperp_crm` — no changes needed.

**Option B — MongoDB Atlas (cloud, free tier)**
1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas), create a database user, and allow network access from your IP.
2. Copy your connection string into `backend/.env`:
   ```
   MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/siperp_crm
   ```
   Replace `<password>` with your actual password **and remove the `<` `>` characters** — they're just placeholders in Atlas's template, not part of the real string.

If the backend can't reach MongoDB, it prints a clear error on startup and exits rather than failing silently.

### Resetting the database

```
cd backend
npm run reset
```

Empties every collection in the database `MONGODB_URI` points at — it does
**not** insert any sample data. It first prints what it is about to delete and
asks you to type `yes`.

Other forms:

```
npm run reset -- --list          # show every database on the cluster and its doc count
npm run reset -- --db=test_crm   # clear a specific tenant database instead
npm run reset -- --db=test_crm --yes   # skip the confirmation prompt
```

`--db` binds the models onto any database on the same cluster, the same way a
tenant request does, so one command can clear any client. It refuses to touch
`admin` / `local` / `config`.

## Running it

Open two terminals — backend and frontend run as separate apps.

### 1. Backend (API server, port 5000)

```
cd backend
npm install
npm start
```

Health check: `http://localhost:5000/api/health` (reports MongoDB connection status).

### 2. Frontend (React app, port 5173)

```
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Shows the login page first; after signing in, you land on the Dashboard.

## What's included

Full sidebar navigation, all backed by MongoDB, all starting empty:

- **Dashboard** — KPI cards (sales, purchases, products, open order value, stock value — all computed live from real data), sales trend chart, recent orders/invoices, top customers.
- **Customers** — Customer List.
- **Suppliers** — Supplier List.
- **Products** — Items. Each item carries an **Item Type** (Raw Material / Semi-Finished / Finished Good / Consumable / Spare Part).
- **Purchase** — Purchase Orders, Goods Receipt, Purchase Invoice, Purchase Return.
- **Inventory** — Stock Overview, Stock In, Stock Out.
- **Manufacturing** — Bill of Materials, Work Orders, Job Cards, Material Issue, Production Receipt, Work Centers, Machines. See below.
- **Sales** — Enquiries, Sales Orders, Delivery Challan, Invoices, Sales Return.
- **Reports** — Sales / Purchase / Inventory reports.
- **Users & Roles** — Users, Roles & Permissions, Audit Logs (auto-logs each login and every write).
- **Settings** — Company, Numbering, Invoice Theme, General (all persisted to one Settings document), plus Manage Clients / Manage Plans on the main admin host.

Every "+ Add ..." button opens a modal form that POSTs to the backend and writes a real document to MongoDB, then refreshes the list. New records always appear at the top of page 1. Mobile number fields only accept 10 digits (no letters, no country code).

## The manufacturing cycle

The seven manufacturing screens are one workflow, not seven unrelated lists:

1. **Work Centers** and **Machines** describe the shop floor. A work center's
   cost per hour is what a BOM routing step is costed at.
2. **Bill of Materials** — what one batch of a product is built from.
   Components carry a wastage %, which is included in both the quantity a work
   order needs and the BOM's material cost. Routing operations give it a
   labour cost. Total cost = material + operations + overhead, and the list
   shows cost per unit.
3. **Work Orders** — pick a BOM and a planned quantity, and the BOM is
   *exploded* to that quantity (a BOM yielding 10, asked for 25, multiplies
   every component by 2.5). Those requirements are then **frozen** on the
   order, so revising the BOM later never rewrites an order already running.
   A Draft order must be **Released** before anything can move against it.
4. **Job Cards** — "Generate Job Cards" on a released work order creates one
   card per routing step of its BOM. Operators book completed/rejected
   quantities and hours against them.
5. **Material Issue** — issues raw material to a work order and **decrements
   `Item.qty`**. The modal pre-fills every line that is still short, so the
   usual case is one click. Posting also advances the order to In Progress.
6. **Production Receipt** — books output back in and **increments `Item.qty`**
   for the finished product. Only the accepted quantity reaches stock;
   rejects are recorded for the yield figure. The order closes itself once
   the planned quantity is met.

Both stock movements are corrected by **cancelling**, never by editing — a
cancel returns the stock and rewinds the work order's issued/produced totals.
That is also why a work order with movements against it cannot be deleted.

## Notes

- Restarting the backend does not reset your data — MongoDB persists it. Use `npm run reset` if you want to clear it out.
- Stock lives on `Item.qty`, keyed by item name + warehouse — that is what the Inventory overview aggregates and what manufacturing moves. An item that is not in the catalog cannot be issued or received; the API says so rather than silently losing the movement.
- BOM and work order item pickers deliberately do **not** filter by Item Type, because a sub-assembly is a finished good to one BOM and a component to the next. The type is descriptive.
- Purchase Orders / Goods Receipt / Purchase Invoice / Purchase Return use simple header-level forms (supplier, reference numbers, totals) rather than full line-item editors with per-product quantity/tax breakdowns — a reasonable scope trade-off for this build.
- Production build: `cd frontend && npm run build` (outputs to `frontend/dist/`).
- `frontend/.env` points `VITE_API_BASE_URL` at the deployed API. For local development create `frontend/.env.local` with `VITE_API_BASE_URL=http://localhost:5000` — Vite prefers it, and it keeps the committed `.env` pointing at production.
