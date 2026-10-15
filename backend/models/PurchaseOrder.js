const { mongoose, baseOptions } = require("./_shared");

const lineItemSchema = new mongoose.Schema(
  {
    product: { type: String, default: "" },
    hsnCode: { type: String, default: "" },
    quantity: { type: Number, default: 0 },
    unit: { type: String, default: "Nos" },
    unitPrice: { type: Number, default: 0 },
    taxPercent: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    supplier: { type: String, required: true },
    orderDate: { type: String, default: "" },
    expectedDate: { type: String, default: "" },
    items: { type: [lineItemSchema], default: [] },
    subTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    paymentTerms: { type: String, default: "30 Days" },
    status: { type: String, default: "Draft" },
    // Values for whatever extra fields this client defined for this form in
    // Settings → Custom Fields — see models/CustomFieldDefinition.js.
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseOptions
);

module.exports = mongoose.model("PurchaseOrder", purchaseOrderSchema);
