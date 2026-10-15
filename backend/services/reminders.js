// Reminders are computed live from the data on every request rather than
// stored — there is nothing to keep in sync, nothing to expire, and no
// scheduler to run. The cost is a handful of indexed reads per call.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 24 * 60 * 60 * 1000;

// Date fields in this app are free-text and genuinely hold two shapes:
// the "25 Sep 2026" label futureLabel() writes, and the "2026-10-30" an
// <input type="date"> submits. Both occur in the same column, so anything
// doing overdue maths has to handle both or it silently reports nonsense.
function parseAnyDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const s = String(value).trim();

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const parts = s.split(/\s+/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = MONTHS.indexOf(parts[1].slice(0, 3));
    const year = parseInt(parts[2], 10);
    if (month !== -1 && !Number.isNaN(day) && !Number.isNaN(year)) return new Date(year, month, day);
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// "30 Days" / "Net 30" / "30" -> 30. "Immediate" / "Advance" / "COD" -> 0.
// Anything unparseable falls back to the caller's default.
function parseTermDays(terms, fallback) {
  if (terms === null || terms === undefined || terms === "") return fallback;
  const s = String(terms).trim().toLowerCase();
  if (/immediate|advance|cod|cash/.test(s)) return 0;
  const m = s.match(/(\d+)/);
  return m ? Number(m[1]) : fallback;
}

// Whole days from today until `date`. Negative means overdue.
function daysUntil(date) {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / DAY_MS);
}

function fmtDate(d) {
  if (!d) return "";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// severity drives the colour/sort: overdue first, then due soon, then info.
function bucket(days) {
  if (days === null) return null;
  if (days < 0) return "overdue";
  return "due-soon";
}

function money(n) {
  return Math.round(Number(n) || 0);
}

// Builds every reminder for the current tenant.
//   dueSoonDays — the client's own "due soon" window, used for any type the
//                 platform has not given a lead time of its own
//   rules       — { enabled: Set, leadDays: Map } from notificationCatalogue.js.
//                 Omitted means every type is on at the client's own window,
//                 which is how the bell behaved before this was configurable.
//   extraItems  — already-built items (platform announcements) merged in and
//                 sorted alongside the computed ones, so the bell stays one list.
async function buildReminders(models, { dueSoonDays = 7, rules, extraItems } = {}) {
  // How far ahead this type looks, and whether it is switched on at all.
  const windowFor = (type) => {
    const n = rules && rules.leadDays ? rules.leadDays.get(type) : undefined;
    return n === undefined || n === null ? dueSoonDays : n;
  };
  const enabled = (type) => !rules || !rules.enabled || rules.enabled.has(type);
  const { Invoice, PurchaseInvoice, Item, SalesOrder, PurchaseOrder } = models;
  const items = [];

  // All five lookups are independent, so they run together (one round trip's
  // wait instead of five in a row), and each fetches only the fields the
  // rules below read — the full documents carry every line item.
  const [invoices, bills, stock, orders, pos] = await Promise.all([
    Invoice.find({}, { _id: 0, id: 1, customer: 1, balance: 1, amount: 1, paidAmount: 1, dueDate: 1 }).sort({ seq: -1 }).limit(500).lean(),
    PurchaseInvoice.find({}, { _id: 0, id: 1, supplier: 1, amount: 1, paidAmount: 1, dueDate: 1 }).sort({ seq: -1 }).limit(500).lean(),
    Item.find({}, { _id: 0, name: 1, unit: 1, qty: 1, reserved: 1, damaged: 1, minStockLevel: 1 }).limit(1000).lean(),
    SalesOrder.find({}, { _id: 0, id: 1, orderNo: 1, customer: 1, amount: 1, status: 1, deliveryStatus: 1, requiredDate: 1 }).sort({ seq: -1 }).limit(500).lean(),
    PurchaseOrder.find({}, { _id: 0, id: 1, supplier: 1, amount: 1, status: 1, expectedDate: 1 }).sort({ seq: -1 }).limit(500).lean(),
  ]);

  // ---- Receivables: sales invoices with money still owed ----
  for (const inv of invoices) {
    const balance = money(inv.balance != null ? inv.balance : (inv.amount || 0) - (inv.paidAmount || 0));
    if (balance <= 0) continue;
    const due = parseAnyDate(inv.dueDate);
    const days = daysUntil(due);
    if (days === null || days > windowFor("receivable")) continue;
    items.push({
      type: "receivable",
      severity: bucket(days),
      title: `${inv.customer || "Customer"} owes ₹${balance.toLocaleString("en-IN")}`,
      subtitle: `Invoice ${inv.id}`,
      amount: balance,
      dueDate: fmtDate(due),
      days,
      link: `/sales/invoices/${encodeURIComponent(inv.id)}`,
    });
  }

  // ---- Payables: purchase bills we still owe ----
  for (const bill of bills) {
    const balance = money((bill.amount || 0) - (bill.paidAmount || 0));
    if (balance <= 0) continue;
    const due = parseAnyDate(bill.dueDate);
    const days = daysUntil(due);
    if (days === null || days > windowFor("payable")) continue;
    items.push({
      type: "payable",
      severity: bucket(days),
      title: `Pay ${bill.supplier || "supplier"} ₹${balance.toLocaleString("en-IN")}`,
      subtitle: `Bill ${bill.id}`,
      amount: balance,
      dueDate: fmtDate(due),
      days,
      link: `/purchase/invoices`,
    });
  }

  // ---- Low stock ----
  for (const it of stock) {
    const available = (Number(it.qty) || 0) - (Number(it.reserved) || 0) - (Number(it.damaged) || 0);
    const min = Number(it.minStockLevel) || 0;
    // Out of stock is always worth flagging, even when nobody has set a
    // minimum level — otherwise items sitting at zero stay invisible.
    const isOut = available <= 0;
    const isLow = min > 0 && available <= min;
    if (!isOut && !isLow) continue;
    items.push({
      type: "low-stock",
      severity: available <= 0 ? "overdue" : "due-soon",
      title: `${it.name} ${available <= 0 ? "is out of stock" : "is low on stock"}`,
      subtitle: `${available} ${it.unit || ""} left · minimum ${min}`.trim(),
      amount: null,
      dueDate: "",
      days: null,
      link: `/inventory`,
    });
  }

  // ---- Sales orders past their required date, not yet delivered ----
  for (const so of orders) {
    if (so.deliveryStatus === "Delivered" || so.status === "Cancelled") continue;
    const due = parseAnyDate(so.requiredDate);
    const days = daysUntil(due);
    if (days === null || days > windowFor("delivery")) continue;
    items.push({
      type: "delivery",
      severity: bucket(days),
      title: `${so.orderNo || so.id} for ${so.customer || "customer"} ${days < 0 ? "is overdue" : "is due"}`,
      subtitle: `Required ${fmtDate(due)} · ${so.deliveryStatus || "Not Dispatched"}`,
      amount: money(so.amount),
      dueDate: fmtDate(due),
      days,
      link: `/sales/orders/${encodeURIComponent(so.id)}`,
    });
  }

  // ---- Purchase orders past their expected date ----
  for (const po of pos) {
    if (["Received", "Cancelled", "Closed"].includes(po.status)) continue;
    const due = parseAnyDate(po.expectedDate);
    const days = daysUntil(due);
    if (days === null || days > windowFor("purchase-order")) continue;
    items.push({
      type: "purchase-order",
      severity: bucket(days),
      title: `${po.id} from ${po.supplier || "supplier"} ${days < 0 ? "is overdue" : "is due"}`,
      subtitle: `Expected ${fmtDate(due)} · ${po.status || "Draft"}`,
      amount: money(po.amount),
      dueDate: fmtDate(due),
      days,
      link: `/purchase/orders/${encodeURIComponent(po.id)}`,
    });
  }

  // Types the platform has switched off drop out here rather than being
  // guarded at five separate call sites — the reminder is still computed,
  // it just never reaches the bell.
  const shown = items.filter((x) => enabled(x.type));
  items.length = 0;
  items.push(...shown);

  // Platform announcements are already in item shape, so they sort in with
  // the rest by severity instead of sitting in a second list.
  if (extraItems && extraItems.length) items.push(...extraItems);

  // Most urgent first: overdue before due-soon, then by how overdue.
  const rank = { overdue: 0, "due-soon": 1 };
  items.sort((a, b) => {
    const s = (rank[a.severity] ?? 2) - (rank[b.severity] ?? 2);
    if (s !== 0) return s;
    return (a.days === null ? 9999 : a.days) - (b.days === null ? 9999 : b.days);
  });

  const counts = { total: items.length, overdue: 0, dueSoon: 0 };
  const byType = {};
  for (const i of items) {
    if (i.severity === "overdue") counts.overdue++;
    else counts.dueSoon++;
    byType[i.type] = (byType[i.type] || 0) + 1;
  }

  return { counts, byType, items };
}

module.exports = { buildReminders, parseAnyDate, parseTermDays, daysUntil };
