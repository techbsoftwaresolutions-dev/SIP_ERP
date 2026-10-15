const { mongoose, baseOptions } = require("./_shared");

const supplierSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    name: { type: String, required: true },
    contactPerson: { type: String, default: "" },
    category: { type: String, default: "General" },
    supplierType: { type: String, default: "Manufacturer" },
    packingCategory: { type: String, default: "" },
    // Blank = fall back to the company default in Settings
    // (salesPaymentTerms / purchasePaymentTerms).
    paymentTerms: { type: String, default: "" },
    gstNo: { type: String, default: "" },
    address: { type: String, default: "" },
    city: { type: String, default: "Chennai" },
    state: { type: String, default: "" },
    pincode: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    rating: { type: String, default: "4.0" },
    leadTimeDays: { type: Number, default: 7 },
    status: { type: String, default: "Active" },
    // Values for whatever extra fields this client defined for Suppliers in
    // Settings → Custom Fields — see models/CustomFieldDefinition.js.
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseOptions
);

module.exports = mongoose.model("Supplier", supplierSchema);
