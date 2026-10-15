const round2 = (n) => Math.round(n * 100) / 100;

// What the New Sales Order page is pre-filled with when a quotation is
// converted. Nothing is saved until the user reviews it there and creates the
// order; that page then links the new order back (salesOrderId).
//
// A Sales Order carries no discount or tax of its own, so the quotation's
// discount is spread across the lines (each unit price scaled down by the same
// ratio) and the order's value equals what the customer agreed to pay before tax.
export function buildSalesOrderFromQuotation(q) {
  const items = Array.isArray(q.items) ? q.items : [];
  const subTotal = items.reduce((a, i) => a + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const discount = Number(q.discountAmount) || 0;
  const factor = subTotal > 0 ? (subTotal - discount) / subTotal : 1;
  return {
    id: q.id,
    customer: q.customer,
    poNumber: q.referenceNo || "",
    lineItems: items.map((i) => ({
      product: i.product || "",
      orderQty: Number(i.quantity) || 0,
      dispatchQty: 0,
      pendingQty: Number(i.quantity) || 0,
      unit: i.unit || "Nos",
      unitPrice: round2((Number(i.unitPrice) || 0) * factor),
    })),
  };
}
