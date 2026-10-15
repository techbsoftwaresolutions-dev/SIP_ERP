const { mongoose, baseOptions } = require("./_shared");

const salesReturnSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    customer: { type: String, required: true },
    invoiceNo: { type: String, default: "—" },
    soNumber: { type: String, default: "—" },
    dcNumber: { type: String, default: "—" },
    product: { type: String, default: "" },
    qty: { type: Number, default: 0 },
    unit: { type: String, default: "Nos" },
    date: { type: String, default: "" },
    reason: { type: String, default: "Not specified" },
    amount: { type: Number, default: 0 },
    status: { type: String, default: "Pending" },
    // Values for whatever extra fields this client defined for this form in
    // Settings → Custom Fields — see models/CustomFieldDefinition.js.
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseOptions
);

module.exports = mongoose.model("SalesReturn", salesReturnSchema);
