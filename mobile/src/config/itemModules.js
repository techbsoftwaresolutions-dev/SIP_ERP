import { UNITS } from "./optionSources";

const PAYMENT_TERMS = ["Immediate", "15 Days", "30 Days", "45 Days", "60 Days"];

function computeAmountRow(row) {
  const quantity = Number(row.quantity) || 0;
  const unitPrice = Number(row.unitPrice) || 0;
  const taxPercent = Number(row.taxPercent) || 0;
  return { ...row, amount: quantity * unitPrice * (1 + taxPercent / 100) };
}

function computeReturnRow(row) {
  const returnQty = Number(row.returnQty) || 0;
  const unitPrice = Number(row.unitPrice) || 0;
  return { ...row, amount: returnQty * unitPrice };
}

// Documents that carry a header (supplier, dates, etc.) plus a list of line
// items, mirroring the web app's ItemsEditor-based pages.
export const ITEM_MODULES = {
  purchaseOrders: {
    title: "Purchase Order",
    endpoint: "/api/purchase-orders",
    card: { title: "supplier", subtitle: "orderDate", meta: ["amount"], status: "status" },
    headerFields: [
      { key: "supplier", label: "Supplier", type: "select", required: true, optionsSource: "suppliers" },
      { key: "expectedDate", label: "Expected Delivery", placeholder: "Enter your expected date" },
      { key: "paymentTerms", label: "Payment Terms", type: "select", options: PAYMENT_TERMS },
      { key: "status", label: "Status", type: "select", options: ["Draft", "Pending", "Sent", "Partially Received", "Received", "Completed", "Cancelled"], editOnly: true },
    ],
    itemColumns: [
      { key: "product", label: "Item", type: "select", optionsSource: "products" },
      { key: "quantity", label: "Qty", type: "number" },
      { key: "unit", label: "Unit", type: "select", options: UNITS },
      { key: "unitPrice", label: "Unit Price", type: "number" },
      { key: "taxPercent", label: "Tax (%)", type: "number" },
    ],
    computeRow: computeAmountRow,
  },
  goodsReceipt: {
    title: "Goods Receipt",
    endpoint: "/api/purchase/goods-receipts",
    card: { title: "supplier", subtitle: "date", meta: ["poNumber"], status: "status" },
    headerFields: [
      { key: "supplier", label: "Supplier", type: "select", required: true, optionsSource: "suppliers" },
      { key: "poNumber", label: "Purchase Order No", placeholder: "Enter your purchase order no" },
      { key: "inspection", label: "Inspection", type: "select", options: ["Pending", "Passed", "Partial", "Failed"] },
      { key: "status", label: "Status", type: "select", options: ["Pending", "Received", "Partially Accepted", "Completed", "Inspection Pending", "Rejected"], editOnly: true },
    ],
    itemColumns: [
      { key: "product", label: "Item", type: "select", optionsSource: "products" },
      { key: "poQty", label: "Purchase Order Qty", type: "number" },
      { key: "receivedQty", label: "Received Qty", type: "number" },
      { key: "rejectedQty", label: "Rejected Qty", type: "number" },
      { key: "unit", label: "Unit", type: "select", options: UNITS },
    ],
  },
  purchaseInvoices: {
    title: "Purchase Invoice",
    endpoint: "/api/purchase/invoices",
    card: { title: "supplier", subtitle: "date", meta: ["amount", "paidAmount"], status: "status" },
    headerFields: [
      { key: "supplier", label: "Supplier", type: "select", required: true, optionsSource: "suppliers" },
      { key: "poNumber", label: "Purchase Order No", placeholder: "Enter your purchase order no" },
      { key: "grNumber", label: "GRN Number", placeholder: "Enter your GRN number" },
      { key: "dueDate", label: "Due Date", placeholder: "Enter your due date" },
      { key: "paidAmount", label: "Paid Amount (₹)", type: "number", placeholder: "Enter your paid amount" },
      { key: "status", label: "Status", type: "select", options: ["Unpaid", "Paid", "Partially Paid", "Overdue"], editOnly: true },
    ],
    itemColumns: [
      { key: "product", label: "Item", type: "select", optionsSource: "products" },
      { key: "quantity", label: "Qty", type: "number" },
      { key: "unitPrice", label: "Unit Price", type: "number" },
      { key: "taxPercent", label: "Tax (%)", type: "number" },
    ],
    computeRow: computeAmountRow,
  },
  purchaseReturns: {
    title: "Purchase Return",
    endpoint: "/api/purchase/returns",
    card: { title: "supplier", subtitle: "date", meta: ["amount", "reason"], status: "status" },
    headerFields: [
      { key: "supplier", label: "Supplier", type: "select", required: true, optionsSource: "suppliers" },
      { key: "poNumber", label: "Purchase Order No", placeholder: "Enter your purchase order no" },
      { key: "grNumber", label: "GRN No.", placeholder: "Enter your GRN number" },
      { key: "invoiceNumber", label: "Invoice No.", placeholder: "Enter your invoice number" },
      { key: "reason", label: "Reason", type: "select", options: ["Damaged", "Quality Issue", "Wrong Specification", "Excess Quantity", "Other"] },
      { key: "creditNote", label: "Credit Note", placeholder: "Enter your credit note number" },
      { key: "status", label: "Status", type: "select", options: ["Pending", "Approved", "Completed", "Rejected"], editOnly: true },
    ],
    itemColumns: [
      { key: "product", label: "Item", type: "select", optionsSource: "products" },
      { key: "invoicedQty", label: "Invoiced Qty", type: "number" },
      { key: "returnQty", label: "Return Qty", type: "number" },
      { key: "unitPrice", label: "Unit Price", type: "number" },
      { key: "unit", label: "Unit", type: "select", options: ["Pcs", "Box", "Kg", "Litre", "Set"] },
    ],
    computeRow: computeReturnRow,
  },
};
