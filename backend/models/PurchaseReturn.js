const { mongoose, baseOptions } = require("./_shared");

const returnItemSchema = new mongoose.Schema(
  {
    product: { type: String, default: "" },
    invoicedQty: { type: Number, default: 0 },
    returnQty: { type: Number, default: 0 },
    unitPrice: { type: Number, default: 0 },
    unit: { type: String, default: "Pcs" },
  },
  { _id: false }
);

const purchaseReturnSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    poNumber: { type: String, default: "" },
    grNumber: { type: String, default: "" },
    invoiceNumber: { type: String, default: "" },
    supplier: { type: String, required: true },
    date: { type: String, default: "" },
    // Which Stock Overview warehouse the returned quantity is deducted
    // from — same field, same default, as GoodsReceipt.js.
    warehouse: { type: String, default: "Main Warehouse" },
    items: { type: [returnItemSchema], default: [] },
    amount: { type: Number, default: 0 },
    reason: { type: String, default: "Not specified" },
    creditNote: { type: String, default: "Pending" },
    status: { type: String, default: "Pending" },
    // Values for whatever extra fields this client defined for this form in
    // Settings → Custom Fields — see models/CustomFieldDefinition.js.
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseOptions
);

module.exports = mongoose.model("PurchaseReturn", purchaseReturnSchema);
