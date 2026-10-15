import { useEffect, useState } from "react";
import api from "../../api/client";

export const UNITS = ["Nos", "Pcs", "Box", "Kg", "Litre", "Set", "Roll", "Sheet"];
export const DELIVERY_STATUS_OPTIONS = ["Not Dispatched", "Partially Dispatched", "Delivered", "Pending"];
export const PAYMENT_STATUS_OPTIONS = ["Pending", "Partially Paid", "Paid", "Unpaid"];
export const STATUS_OPTIONS = ["Open", "Pending", "Delivered", "Cancelled"];

// Converts the backend's "DD Mon YYYY" date labels (e.g. "10 Aug 2026") into
// the "YYYY-MM-DD" format an <input type="date"> needs to display a value.
export function toISODate(label) {
  if (!label) return "";
  const parsed = new Date(label);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

// Loads the live Customer/Purchase Order lists the Sales Order form's
// dropdowns draw from.
export function useSalesOrderLookups() {
  const [customers, setCustomers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);

  useEffect(() => {
    api.swr("/api/customers?page=1&pageSize=200", (r) => setCustomers(r.data || []));
    api.swr("/api/purchase-orders?page=1&pageSize=200", (r) => setPurchaseOrders(r.data || []));
    api.swr("/api/items?page=1&pageSize=200", (r) => setCatalogItems(r.data || []));
  }, []);

  // Normalized lookup used by the "Purchase Order Date" field's deriveFrom —
  // picking an existing Purchase Order No auto-fills its real order date.
  const purchaseOrderLookup = purchaseOrders.map((po) => ({ id: po.id, orderDateISO: toISODate(po.orderDate) }));

  return { customers, purchaseOrders, purchaseOrderLookup, catalogItems };
}

// One row of the Sales Order "Items" editor. Pending is always Order Qty
// minus what's been dispatched (never negative) and is shown read-only.
export function computeSalesOrderRow(row) {
  const orderQty = Number(row.orderQty) || 0;
  const dispatchQty = Number(row.dispatchQty) || 0;
  return { ...row, pendingQty: Math.max(orderQty - dispatchQty, 0) };
}

// Shared field definitions for the Sales Order form — used by both the
// standalone Add and Edit pages, so the two never drift apart. `isEdit`
// adds the SO Status field, which only makes sense once an order exists.
export function buildSalesOrderFields({ customers, purchaseOrders, purchaseOrderLookup, catalogItems = [], isEdit }) {
  const fields = [
    { key: "customer", label: "Customer", type: "combo", required: true, options: customers.map((c) => c.name) },
    {
      key: "poNumber",
      label: "Purchase Order No",
      type: "combo",
      options: purchaseOrders.map((po) => po.id),
      // This is the customer's own PO reference number, not necessarily one
      // of our internal Purchase Orders — so besides picking an existing
      // match, typing any value should just be accepted as-is.
      onCreate: (text) => text,
      createLabel: (text) => `Use "${text}"`,
    },
    {
      key: "poDate",
      label: "Purchase Order Date",
      type: "date",
      deriveFrom: { field: "poNumber", source: purchaseOrderLookup, match: "id", pick: "orderDateISO" },
    },
    { key: "deliveryStatus", label: "Delivery Status", type: "select", options: DELIVERY_STATUS_OPTIONS },
    { key: "paymentStatus", label: "Payment Status", type: "select", options: PAYMENT_STATUS_OPTIONS },
    {
      key: "lineItems",
      label: "Items",
      type: "items",
      full: true,
      computeRow: computeSalesOrderRow,
      addRowLabel: "+ Add Item",
      columns: [
        {
          key: "product",
          label: "Item",
          type: "combo",
          options: catalogItems.map((it) => it.name),
          // Picking a catalog Item pre-fills Unit and Unit Price from it —
          // both stay editable afterward.
          deriveFrom: {
            source: catalogItems,
            match: "name",
            fields: { unit: "unit", unitPrice: "sellingPrice" },
          },
        },
        { key: "orderQty", label: "Order Qty", type: "number" },
        { key: "dispatchQty", label: "Dispatch", type: "number" },
        { key: "pendingQty", label: "Pending", readOnly: true },
        { key: "unit", label: "Unit", type: "combo", options: UNITS },
        { key: "unitPrice", label: "Unit Price", type: "number" },
        { key: "requiredDate", label: "Required Date", type: "date" },
      ],
    },
  ];
  if (isEdit) {
    fields.push({ key: "status", label: "SO Status", type: "select", options: STATUS_OPTIONS });
  }
  return fields;
}
