const { mongoose, baseOptions } = require("./_shared");

const grItemSchema = new mongoose.Schema(
  {
    product: { type: String, default: "" },
    poQty: { type: Number, default: 0 },
    receivedQty: { type: Number, default: 0 },
    rejectedQty: { type: Number, default: 0 },
    unit: { type: String, default: "Pcs" },
  },
  { _id: false }
);

const goodsReceiptSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    poNumber: { type: String, default: "" },
    supplier: { type: String, required: true },
    date: { type: String, default: "" },
    invoiceNo: { type: String, default: "" },
    invoiceDate: { type: String, default: "" },
    items: { type: [grItemSchema], default: [] },
    warehouse: { type: String, default: "Main Warehouse" },
    inspection: { type: String, default: "Pending" },
    status: { type: String, default: "Pending" },
    // Values for whatever extra fields this client defined for this form in
    // Settings → Custom Fields — see models/CustomFieldDefinition.js.
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseOptions
);

module.exports = mongoose.model("GoodsReceipt", goodsReceiptSchema);
