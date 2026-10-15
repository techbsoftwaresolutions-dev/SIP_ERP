import { useEffect, useState } from "react";
import api from "../../api/client";

export const UNITS = ["Nos", "Pcs", "Box", "Kg", "Litre", "Set", "Roll", "Sheet"];
export const REASON_OPTIONS = ["Damaged", "Quality Issue", "Wrong Specification", "Excess Quantity", "Other"];
export const STATUS_OPTIONS = ["Pending", "Inspection", "Approved", "Completed", "Rejected"];

// Loads the live Customer/Invoice/Sales Order/Delivery Challan lists the
// Sales Return form's dropdowns draw from.
export function useSalesReturnLookups() {
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [challans, setChallans] = useState([]);

  useEffect(() => {
    api.swr("/api/customers?page=1&pageSize=200", (r) => setCustomers(r.data || []));
    api.swr("/api/sales/invoices?page=1&pageSize=200", (r) => setInvoices(r.data || []));
    api.swr("/api/sales/orders?page=1&pageSize=200", (r) => setSalesOrders(r.data || []));
    api.swr("/api/sales/delivery-challans?page=1&pageSize=200", (r) => setChallans(r.data || []));
  }, []);

  return { customers, invoices, salesOrders, challans };
}

// "—" is this app's stored placeholder for "not set" on a handful of
// cross-reference fields (poNumber, soNumber, dcNumber, ...) — never a real
// value to auto-fill with.
const clean = (v) => (v && v !== "—" ? v : "");

// A Sales Order already carries a flat product/unit summary, but some older
// or blank-line rows have an empty top-level `product` despite having real
// line items — fall back to the first line item so auto-fetch still has
// something to offer for those too.
function normalizeSalesOrders(salesOrders) {
  return salesOrders.map((so) => {
    const firstLine = (so.lineItems && so.lineItems[0]) || {};
    return {
      orderNo: so.orderNo,
      customer: so.customer,
      product: so.product || firstLine.product || "",
      unit: so.unit || firstLine.unit || "Nos",
    };
  });
}

// An Invoice has no flat top-level unit at all (only per line item), and
// separately carries the SO/DC numbers it was raised from — useful to
// backfill those two fields as well when an invoice is picked.
function normalizeInvoices(invoices) {
  return invoices.map((inv) => {
    const firstItem = (inv.items && inv.items[0]) || {};
    return {
      id: inv.id,
      customer: inv.customer,
      product: inv.product || firstItem.product || "",
      unit: firstItem.unit || "Nos",
      soNumber: clean(inv.soNumber),
      dcNumber: clean(inv.dcNumber),
    };
  });
}

// Shared field definitions for the Sales Return form — used by both the
// standalone Add and Edit pages, so the two never drift apart.
//
// Picking either "Invoice No." or "SO No." auto-fetches that document's
// customer, product and unit into the rest of the form (and, from an
// invoice, backfills the SO/DC numbers it was raised from too) — the same
// "type a reference number, get the details" pattern Purchase Return's PO
// No. field uses. Return Qty, Return Value, Reason and Status are
// deliberately left for the user to fill in: what was ordered/invoiced isn't
// necessarily what's actually being returned, so nothing here guesses at it.
export function buildSalesReturnFields({ customers, invoices, salesOrders, challans }) {
  const soLookup = normalizeSalesOrders(salesOrders);
  const invoiceLookup = normalizeInvoices(invoices);

  const fromSoOrInvoice = (pick) => [
    { field: "soNumber", source: soLookup, match: "orderNo", pick },
    { field: "invoiceNo", source: invoiceLookup, match: "id", pick },
  ];

  return [
    {
      key: "customer",
      label: "Customer",
      type: "combo",
      required: true,
      options: customers.map((c) => c.name),
      deriveFrom: fromSoOrInvoice("customer"),
    },
    {
      key: "invoiceNo",
      label: "Invoice No.",
      type: "combo",
      options: invoices.map((i) => i.id),
    },
    {
      key: "soNumber",
      label: "SO No.",
      type: "combo",
      options: salesOrders.map((s) => s.orderNo),
      deriveFrom: [{ field: "invoiceNo", source: invoiceLookup, match: "id", pick: "soNumber" }],
    },
    {
      key: "dcNumber",
      label: "DC No.",
      type: "combo",
      options: challans.map((c) => c.id),
      deriveFrom: [{ field: "invoiceNo", source: invoiceLookup, match: "id", pick: "dcNumber" }],
    },
    {
      key: "product",
      label: "Product",
      placeholder: "Enter your product",
      deriveFrom: fromSoOrInvoice("product"),
    },
    { key: "qty", label: "Return Qty", type: "number", placeholder: "Enter your return quantity" },
    {
      key: "unit",
      label: "Unit",
      type: "select",
      options: UNITS,
      deriveFrom: fromSoOrInvoice("unit"),
    },
    { key: "amount", label: "Return Value (₹)", type: "number", placeholder: "Enter your return value" },
    { key: "reason", label: "Return Reason", type: "select", options: REASON_OPTIONS },
    { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
  ];
}
