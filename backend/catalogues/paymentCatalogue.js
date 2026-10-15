// The payment methods the platform ships with.
//
// Unlike modules or invoice templates, a payment method has no code behind it
// — it is a label recorded on an invoice and printed back out. So a super
// admin can genuinely create new ones here ("NEFT/RTGS", "Cash on Delivery"),
// which is why models/PaymentMethod.js allows full CRUD where the other
// registries do not.
//
// The six below are what frontend/src/pages/sales/invoiceFields.js hardcoded
// before this existed, in the same order, so seeding changes nothing about
// what an invoice form offers.

const SHIPPED = [
  {
    code: "cash",
    label: "Cash",
    description: "Notes and coins across the counter.",
    requiresReference: false,
    referenceLabel: "",
  },
  {
    code: "credit",
    label: "Credit",
    description: "Billed now, settled later on the customer's terms.",
    requiresReference: false,
    referenceLabel: "",
  },
  {
    code: "upi",
    label: "UPI",
    description: "GPay, PhonePe, Paytm and the rest.",
    requiresReference: true,
    referenceLabel: "UPI transaction ID",
  },
  {
    code: "bank-transfer",
    label: "Bank Transfer",
    description: "NEFT, RTGS or IMPS into the company account.",
    requiresReference: true,
    referenceLabel: "UTR / reference number",
  },
  {
    code: "cheque",
    label: "Cheque",
    description: "Post-dated or at sight.",
    requiresReference: true,
    referenceLabel: "Cheque number",
  },
  {
    code: "card",
    label: "Card",
    description: "Debit or credit card on a POS terminal.",
    requiresReference: true,
    referenceLabel: "Last 4 digits / approval code",
  },
];

// What the registry is seeded with on first read. Everything active, in the
// order the invoice form already showed them, with Cash as the default — which
// is what an empty dropdown effectively meant before.
function paymentSeedRows() {
  return SHIPPED.map((m, i) => ({
    ...m,
    status: "active",
    order: (i + 1) * 10,
    isDefault: m.code === "cash",
    // Built-in methods can be renamed, reordered and switched off, but not
    // deleted: invoices already recorded against them read better if the name
    // they were filed under still exists somewhere.
    builtIn: true,
  }));
}

// Enabled methods, in order, as the invoice form should offer them. Rows are
// stored complete (not as overrides), so this is mostly a filter and a sort —
// but it also copes with an empty collection by falling back to what ships.
function resolvePaymentMethods(docs) {
  const list = docs && docs.length ? docs : paymentSeedRows();
  return list
    .filter((m) => m.status !== "disabled")
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.label).localeCompare(String(b.label)))
    .map((m) => ({
      code: m.code,
      label: m.label,
      description: m.description || "",
      requiresReference: Boolean(m.requiresReference),
      referenceLabel: m.referenceLabel || "Reference",
      isDefault: Boolean(m.isDefault),
    }));
}

// The method a new invoice starts on: whichever enabled row is marked default,
// else the first enabled one. Returns "" when nothing is enabled at all, which
// the form reads as "no preselection" rather than crashing.
function defaultPaymentMethod(methods) {
  const list = methods || [];
  const marked = list.find((m) => m.isDefault);
  return (marked && marked.label) || (list[0] && list[0].label) || "";
}

module.exports = { SHIPPED, paymentSeedRows, resolvePaymentMethods, defaultPaymentMethod };
