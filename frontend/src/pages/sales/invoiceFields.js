import { useEffect, useState } from "react";
import api from "../../api/client";

export const STATUS_OPTIONS = ["Unpaid", "Partially Paid", "Paid", "Overdue"];
// Payment methods are configured per platform in the admin panel, so they
// are fetched rather than hardcoded. This list is only the fallback used
// while the call is in flight or if it fails — an invoice form that cannot
// offer a payment mode is worse than one offering the shipped six.
export const FALLBACK_PAYMENT_MODES = [
  { label: "Cash", requiresReference: false },
  { label: "Credit", requiresReference: false },
  { label: "UPI", requiresReference: true, referenceLabel: "UPI transaction ID" },
  { label: "Bank Transfer", requiresReference: true, referenceLabel: "UTR / reference number" },
  { label: "Cheque", requiresReference: true, referenceLabel: "Cheque number" },
  { label: "Card", requiresReference: true, referenceLabel: "Last 4 digits / approval code" },
];
export const UNITS = ["Nos", "Pcs", "Box", "Kg", "Litre", "Set", "Roll", "Sheet"];

// Just a starting suggestion pre-filled on a brand-new invoice's Notes /
// Terms field — fully editable and clearable per invoice, and never
// hardcoded into the print template itself (see InvoicePrint.jsx).
export const DEFAULT_INVOICE_NOTES = "Goods once sold will not be taken back.\nInterest @ 18% p.a. will be charged on overdue payments.";

export function inr(n) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

export function computeRow(row) {
  const quantity = Number(row.quantity) || 0;
  const unitPrice = Number(row.unitPrice) || 0;
  const taxPercent = Number(row.taxPercent) || 0;
  return { ...row, amount: quantity * unitPrice * (1 + taxPercent / 100) };
}

// Loads every live list the Invoice form's dropdowns draw from — Customers,
// the Items catalog (for the line-items editor's Item picker, which
// auto-fills HSN/Unit/Tax/Price from it), and every PO Number already used
// on a past invoice (so a repeat PO can be picked instead of retyped, while
// a brand-new one can still just be typed in). `refreshCustomers` is called
// after a save, since saving an invoice for a not-yet-known customer name
// also creates that customer record server-side (see `ensureCustomerFromInvoice`).
export function useInvoiceLookups() {
  const [customers, setCustomers] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [settings, setSettings] = useState(null);
  const [poNumbers, setPoNumbers] = useState([]);

  const refreshCustomers = () => {
    api.swr("/api/customers?page=1&pageSize=200", (r) => setCustomers(r.data || []));
  };

  useEffect(() => {
    api.swr("/api/items?page=1&pageSize=200", (r) => setCatalogItems(r.data || []));
    api.get("/api/settings").then(setSettings);
    api.get("/api/sales/invoices?page=1&pageSize=500").then((r) => {
      const seen = new Set();
      (r.data || []).forEach((inv) => {
        if (inv.poNumber) seen.add(inv.poNumber);
      });
      setPoNumbers(Array.from(seen));
    });
    refreshCustomers();
  }, []);

  // Typed values for both fields are accepted as-is — Customer creation
  // actually happens server-side on save; a PO Number is just free text
  // with no separate record of its own.
  const acceptTyped = async (value) => value;

  return { customers, catalogItems, settings, poNumbers, refreshCustomers, createCustomer: acceptTyped, createPoNumber: acceptTyped };
}

// The payment methods this platform offers, in the order the admin set.
// Returns the fallback list until the call answers, so the dropdown is never
// momentarily empty.
export function usePaymentMethods() {
  const [methods, setMethods] = useState(FALLBACK_PAYMENT_MODES);
  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/payment-methods")
      .then((r) => {
        if (!cancelled && r.methods && r.methods.length) setMethods(r.methods);
      })
      .catch(() => {
        /* fallback list already in place */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return methods;
}
