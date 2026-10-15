const { mongoose, baseOptions } = require("./_shared");

const deliveryChallanSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    salesOrder: { type: String, default: "—" },
    customer: { type: String, required: true },
    date: { type: String, default: "" },
    product: { type: String, default: "" },
    dispatchedQty: { type: Number, default: 0 },
    unit: { type: String, default: "Nos" },
    warehouse: { type: String, default: "Main Warehouse" },
    transporter: { type: String, default: "" },
    items: { type: Number, default: 1 },
    vehicleNo: { type: String, default: "" },
    status: { type: String, default: "Pending" },
    // Values for whatever extra fields this client defined for this form in
    // Settings → Custom Fields — see models/CustomFieldDefinition.js.
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseOptions
);

module.exports = mongoose.model("DeliveryChallan", deliveryChallanSchema);
