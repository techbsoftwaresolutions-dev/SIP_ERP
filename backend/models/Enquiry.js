const { mongoose, baseOptions } = require("./_shared");

const enquirySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    customer: { type: String, required: true },
    contactPerson: { type: String, default: "" },
    date: { type: String, default: "" },
    // Each: { product, qty, unit, remarks } — an enquiry can ask about several
    // products. The three flat fields below are kept in step with these rows
    // (see deriveEnquiryScalars in server.js) so the list, exports and the
    // mobile app, which read them, keep working.
    items: { type: Array, default: [] },
    product: { type: String, default: "General Enquiry" },
    qty: { type: Number, default: 0 },
    unit: { type: String, default: "Nos" },
    requiredDate: { type: String, default: "" },
    source: { type: String, default: "Website" },
    priority: { type: String, default: "Medium" },
    estValue: { type: Number, default: 0 },
    status: { type: String, default: "New" },
    // Values for whatever extra fields this client defined for this form in
    // Settings → Custom Fields — see models/CustomFieldDefinition.js.
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseOptions
);

module.exports = mongoose.model("Enquiry", enquirySchema);
