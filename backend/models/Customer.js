const { mongoose, baseOptions } = require("./_shared");

const customerSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    name: { type: String, required: true },
    contactPerson: { type: String, default: "—" },
    customerType: { type: String, default: "Industrial" },
    packingCategory: { type: String, default: "" },
    // Blank = fall back to the company default in Settings
    // (salesPaymentTerms / purchasePaymentTerms).
    paymentTerms: { type: String, default: "" },
    gstNo: { type: String, default: "" },
    address: { type: String, default: "" },
    city: { type: String, default: "Chennai" },
    state: { type: String, default: "" },
    pincode: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    totalOrders: { type: Number, default: 0 },
    outstanding: { type: Number, default: 0 },
    status: { type: String, default: "Active" },
    // Values for whatever extra fields this client defined for Customers in
    // Settings → Custom Fields — see models/CustomFieldDefinition.js.
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseOptions
);

module.exports = mongoose.model("Customer", customerSchema);
