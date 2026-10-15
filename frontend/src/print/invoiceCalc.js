// Shared money formatting and GST maths for every invoice layout.
//
// These used to live inside InvoicePrint.jsx. They are here so a new theme
// can never end up with its own slightly different copy of the tax split —
// the numbers on the page must not depend on which theme is selected.

export function inr(n) {
  return `Rs. ${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function num(n) {
  return (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Every line item's tax, split into CGST+SGST (same state as the buyer) or
// IGST (different state) — the split is computed here, never stored, so it
// always reflects the real customer/company state at print time.
export function taxSplit(invoice, intraState) {
  const items = invoice.items || [];
  const taxTotal = items.reduce((a, i) => a + ((i.amount || 0) - (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0)), 0);
  const taxableTotal = items.reduce((a, i) => a + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const avgRate = taxableTotal > 0 ? (taxTotal / taxableTotal) * 100 : 0;
  if (intraState) {
    return { cgstRate: avgRate / 2, cgstAmount: taxTotal / 2, sgstRate: avgRate / 2, sgstAmount: taxTotal / 2, igstRate: 0, igstAmount: 0, taxTotal, taxableTotal };
  }
  return { cgstRate: 0, cgstAmount: 0, sgstRate: 0, sgstAmount: 0, igstRate: avgRate, igstAmount: taxTotal, taxTotal, taxableTotal };
}

// Groups line items by HSN/SAC for the compliance-style tax breakdown table
// (matches how a real GST tax invoice reports taxable amount and tax by
// HSN code, not just as one lump total).
export function groupByHsn(items) {
  const map = new Map();
  (items || []).forEach((i) => {
    const key = i.hsnCode || "—";
    const taxable = (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0);
    const tax = (i.amount || 0) - taxable;
    const rate = taxable > 0 ? (tax / taxable) * 100 : Number(i.taxPercent) || 0;
    if (!map.has(key)) map.set(key, { hsnCode: key, taxable: 0, tax: 0, rate });
    const row = map.get(key);
    row.taxable += taxable;
    row.tax += tax;
  });
  return Array.from(map.values());
}

// Shipping address defaults to the billing address (same customer, same
// address/phone) unless the invoice explicitly stores a different one —
// so a plain invoice with no separate shipping details set never shows
// fabricated text, just the real billing address it already has.
export function shippingLines(invoice, customer) {
  if (invoice.shippingSameAsBilling === false && invoice.shippingAddress) {
    return { name: invoice.customer, freeform: invoice.shippingAddress };
  }
  return {
    name: invoice.customer,
    line1: invoice.address || customer?.address || "",
    line2: [customer?.city, customer?.state].filter(Boolean).join(", ") + (customer?.pincode ? ` - ${customer.pincode}` : ""),
    phone: invoice.phone || customer?.phone || "",
  };
}
