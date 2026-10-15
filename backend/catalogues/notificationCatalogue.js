// What the notification bell can raise, and how far ahead each thing counts
// as worth raising.
//
// The reminders themselves are computed live in reminders.js — this file only
// decides which of them are switched on and what "due soon" means for each.
// Before it existed, one `reminderDueSoonDays` setting governed all five, so a
// delivery due in six days shouted as loudly as an invoice due in six days.
//
// As everywhere else: an empty registry means every type is on with the
// client's own lead time, which is exactly how the bell behaved before.

const TYPES = [
  {
    key: "receivable",
    label: "Money owed to us",
    description: "A sales invoice with a balance, due soon or already overdue.",
    defaultLeadDays: 7,
  },
  {
    key: "payable",
    label: "Money we owe",
    description: "A purchase bill still unpaid as its due date approaches.",
    defaultLeadDays: 7,
  },
  {
    key: "low-stock",
    label: "Low or out of stock",
    description: "An item at or below its minimum level. Out of stock always shows.",
    // Stock is a state, not a date — nothing to look ahead to.
    defaultLeadDays: null,
  },
  {
    key: "delivery",
    label: "Delivery due",
    description: "A sales order with a delivery date coming up.",
    defaultLeadDays: 3,
  },
  {
    key: "purchase-order",
    label: "Purchase order due",
    description: "A purchase order expected in soon.",
    defaultLeadDays: 3,
  },
];

const SEVERITIES = ["info", "warning", "critical"];
const AUDIENCES = ["all", "plans", "clients"];

function typeSeedRows() {
  return TYPES.map((t, i) => ({
    key: t.key,
    label: t.label,
    description: t.description,
    enabled: true,
    // null means "use the client's own reminderDueSoonDays", which is the
    // behaviour every install has today.
    leadDays: null,
    order: (i + 1) * 10,
  }));
}

// Merges stored overrides onto the shipped catalogue.
function resolveNotificationTypes(docs) {
  const byKey = new Map((docs || []).map((d) => [d.key, d]));
  const seeds = typeSeedRows();
  return TYPES.map((t, i) => {
    const o = byKey.get(t.key) || {};
    const seed = seeds[i];
    return {
      key: t.key,
      label: o.label || t.label,
      description: o.description || t.description,
      enabled: o.enabled === undefined ? true : Boolean(o.enabled),
      leadDays: o.leadDays === undefined || o.leadDays === null ? null : Number(o.leadDays),
      order: o.order === undefined || o.order === null ? seed.order : o.order,
      supportsLeadDays: t.defaultLeadDays !== null,
      defaultLabel: t.label,
      defaultLeadDays: t.defaultLeadDays,
    };
  }).sort((a, b) => a.order - b.order);
}

// The shape reminders.js wants: { enabled: Set, leadDays: Map }. Keeping the
// lookup here means the reminder builder never has to know about the registry.
function notificationRules(docs, fallbackLeadDays) {
  const resolved = resolveNotificationTypes(docs);
  const enabled = new Set(resolved.filter((t) => t.enabled).map((t) => t.key));
  const leadDays = new Map(
    resolved.map((t) => [t.key, t.leadDays === null ? fallbackLeadDays : t.leadDays])
  );
  return { enabled, leadDays };
}

// Does this announcement reach this client, right now?
function announcementReaches(a, tenant, now = new Date()) {
  if (a.status !== "published") return false;
  if (a.startsAt && new Date(a.startsAt) > now) return false;
  if (a.endsAt && new Date(a.endsAt) < now) return false;
  const scope = a.audience || "all";
  if (scope === "all") return true;
  if (!tenant) return false; // a targeted announcement cannot match an unknown tenant
  if (scope === "plans") return (a.planCodes || []).includes(tenant.planCode || "");
  if (scope === "clients") return (a.subdomains || []).includes(tenant.subdomain || "");
  return false;
}

// Announcements as bell items, in the same shape buildReminders produces so
// the two can be merged and sorted together rather than living in two lists.
function announcementItems(announcements, tenant, now = new Date()) {
  return (announcements || [])
    .filter((a) => announcementReaches(a, tenant, now))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .map((a) => ({
      type: "announcement",
      // Critical announcements sort with overdue work; the rest sit below it,
      // because a notice from us should not bury a customer who has not paid.
      severity: a.severity === "critical" ? "overdue" : a.severity === "warning" ? "due-soon" : "info",
      title: a.title,
      subtitle: a.body || "",
      amount: null,
      dueDate: "",
      days: null,
      link: a.link || "",
      announcementId: a.code,
    }));
}

module.exports = {
  TYPES,
  SEVERITIES,
  AUDIENCES,
  typeSeedRows,
  resolveNotificationTypes,
  notificationRules,
  announcementReaches,
  announcementItems,
};
