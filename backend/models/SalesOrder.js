const { mongoose, baseOptions } = require("./_shared");

// Per-product rows shown in the "Items" editor on the Sales Order form.
// `pendingQty` is derived on the client (orderQty - dispatchQty) but stored
// too, so lists/exports don't have to recompute it.
const lineItemSchema = new mongoose.Schema(
  {
    product: { type: String, default: "" },
    orderQty: { type: Number, default: 0 },
    dispatchQty: { type: Number, default: 0 },
    pendingQty: { type: Number, default: 0 },
    unit: { type: String, default: "Nos" },
    unitPrice: { type: Number, default: 0 },
    requiredDate: { type: String, default: "" },
  },
  { _id: false }
);

const salesOrderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    orderNo: { type: String, required: true },
    customer: { type: String, required: true },
    city: { type: String, default: "Chennai" },
    orderDate: { type: String, default: "" },
    deliveryDate: { type: String, default: "" },
    requiredDate: { type: String, default: "" },
    poNumber: { type: String, default: "" },
    poDate: { type: String, default: "" },
    // Set once this order has been converted to a Sales Invoice — the id of
    // that invoice, so "Convert to Invoice" becomes a no-op (with a message)
    // on repeat clicks instead of creating duplicates.
    invoiceId: { type: String, default: "" },
    product: { type: String, default: "" },
    qty: { type: Number, default: 0 },
    unit: { type: String, default: "Nos" },
    amount: { type: Number, default: 0 },
    items: { type: Number, default: 1 },
    lineItems: { type: [lineItemSchema], default: [] },
    status: { type: String, default: "Open" },
    deliveryStatus: { type: String, default: "Not Dispatched" },
    paymentStatus: { type: String, default: "Pending" },
    salesRep: { type: String, default: "R. Kumar" },
    // Values for whatever extra fields this client defined for this form in
    // Settings → Custom Fields — see models/CustomFieldDefinition.js.
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseOptions
);

module.exports = mongoose.model("SalesOrder", salesOrderSchema);
