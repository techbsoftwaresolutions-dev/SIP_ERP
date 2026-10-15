const { mongoose, baseOptions } = require("./_shared");

const lineItemSchema = new mongoose.Schema(
  {
    product: { type: String, default: "" },
    quantity: { type: Number, default: 0 },
    unitPrice: { type: Number, default: 0 },
    taxPercent: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    // Per-unit serial/warranty numbers for this line, for tracing a specific
    // unit back to the invoice it was bought on — see the Barcode Scanner
    // add-on. Optional and not required to match quantity: recording them at
    // all is opt-in.
    serials: { type: [String], default: [] },
  },
  { _id: false }
);

const purchaseInvoiceSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    poNumber: { type: String, default: "" },
    grNumber: { type: String, default: "" },
    supplier: { type: String, required: true },
    date: { type: String, default: "" },
    dueDate: { type: String, default: "" },
    items: { type: [lineItemSchema], default: [] },
    subTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    status: { type: String, default: "Unpaid" },
    // Values for whatever extra fields this client defined for this form in
    // Settings → Custom Fields — see models/CustomFieldDefinition.js.
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseOptions
);

module.exports = mongoose.model("PurchaseInvoice", purchaseInvoiceSchema);
