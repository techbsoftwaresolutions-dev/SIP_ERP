// Decides whether a document needs approving, and who may approve it.
//
// Pure functions over the rules in models/ApprovalRule.js — nothing here
// touches the database, so the whole engine is testable on its own and the
// same evaluation runs on create, on update, and when a screen asks "would
// this need approval?".
//
// The governing rule everywhere below: NO RULES MEANS NO APPROVALS. A client
// with nothing configured behaves exactly as they did before this existed.

const { ADMIN_ROLE } = require("../auth/permissions");

// Document types a rule can govern. Each is a MODULES key, so a rule can never
// point at a document type that has no screen behind it. Kept to the documents
// where approval is a real business step — you do not approve a customer
// record into existence.
const DOCUMENT_TYPES = [
  { key: "sales:invoices", label: "Sales Invoice" },
  { key: "sales:orders", label: "Sales Order" },
  { key: "sales:returns", label: "Sales Return" },
  { key: "purchase:orders", label: "Purchase Order" },
  { key: "purchase:invoices", label: "Purchase Invoice" },
  { key: "manufacturing:work-orders", label: "Work Order" },
];

const CONDITIONS = [
  { key: "always", label: "Every document", needsThreshold: false },
  { key: "amount_above", label: "Total is more than", needsThreshold: true, unit: "₹" },
  { key: "discount_above", label: "Discount is more than", needsThreshold: true, unit: "%" },
];

const APPLIES_TO = ["all", "plans", "clients"];

// Approval states a document can be in. "not_required" is stored rather than
// left blank so a document created before a rule existed reads differently
// from one the engine actively cleared.
const STATUSES = ["not_required", "pending", "approved", "rejected"];

function isValidDocumentType(key) {
  return DOCUMENT_TYPES.some((d) => d.key === key);
}

// Does this rule govern this client at all?
function ruleCoversTenant(rule, tenant) {
  if (rule.status === "disabled") return false;
  const scope = rule.appliesTo || "all";
  if (scope === "all") return true;
  if (!tenant) return false; // a targeted rule cannot match an unknown tenant
  if (scope === "plans") return (rule.planCodes || []).includes(tenant.planCode || "");
  if (scope === "clients") return (rule.subdomains || []).includes(tenant.subdomain || "");
  return false;
}

// What the document is worth, for the amount_above condition. Falls back
// through the field names the different document types actually use, so one
// rule works across invoices and purchase orders without per-type code.
function documentAmount(doc) {
  const d = doc || {};
  const candidates = [d.grandTotal, d.totalAmount, d.total, d.amount, d.netAmount];
  const found = candidates.find((v) => typeof v === "number" && !Number.isNaN(v));
  return found === undefined ? 0 : found;
}

function documentDiscount(doc) {
  const d = doc || {};
  const pct = Number(d.discountPercent);
  if (!Number.isNaN(pct) && pct > 0) return pct;
  // Fall back to working the percentage out from a flat discount, so a rule
  // written in percent still catches a document discounted by value.
  const flat = Number(d.discountAmount) || 0;
  const gross = documentAmount(d) + flat;
  return gross > 0 ? (flat / gross) * 100 : 0;
}

// Does this rule's condition fire for this document?
function conditionMatches(rule, doc) {
  const threshold = Number(rule.threshold) || 0;
  switch (rule.condition) {
    case "amount_above":
      return documentAmount(doc) > threshold;
    case "discount_above":
      return documentDiscount(doc) > threshold;
    case "always":
    default:
      return true;
  }
}

// Every rule that governs this client and this document type, in order.
// Evaluating the condition is separate, because the screens want to show
// "this client has 2 approval rules on invoices" before a document exists.
function rulesForDocument(rules, documentType, tenant) {
  return (rules || [])
    .filter((r) => r.documentType === documentType && ruleCoversTenant(r, tenant))
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.name).localeCompare(String(b.name)));
}

// The verdict for one document.
//
// `required` is true when ANY applicable rule fires — rules are additive, not
// a chain, so adding one can only ever make approval more likely. The roles
// that may approve are the union across the rules that fired, with
// Administrator always included: a rule whose approver role was deleted must
// never leave a document nobody can clear.
function evaluateDocument(rules, documentType, tenant, doc) {
  const applicable = rulesForDocument(rules, documentType, tenant);
  const matched = applicable.filter((r) => conditionMatches(r, doc));
  const roles = new Set([ADMIN_ROLE]);
  for (const r of matched) for (const role of r.approverRoles || []) if (role) roles.add(role);
  return {
    required: matched.length > 0,
    status: matched.length > 0 ? "pending" : "not_required",
    matched: matched.map((r) => ({ code: r.code, name: r.name })),
    // What the document will say about why it is waiting.
    reason: matched.map((r) => r.name).join("; "),
    approverRoles: [...roles],
  };
}

// May this role sign off a document waiting on these rules? Administrator
// always may — see the note in evaluateDocument.
function canApprove(roleName, approverRoles) {
  const role = String(roleName || "").trim();
  if (!role) return false;
  if (role.toLowerCase() === ADMIN_ROLE.toLowerCase()) return true;
  return (approverRoles || []).some((r) => String(r).toLowerCase() === role.toLowerCase());
}

module.exports = {
  DOCUMENT_TYPES,
  CONDITIONS,
  APPLIES_TO,
  STATUSES,
  isValidDocumentType,
  ruleCoversTenant,
  rulesForDocument,
  evaluateDocument,
  canApprove,
  documentAmount,
  documentDiscount,
};
