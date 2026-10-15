const { mongoose, baseOptions } = require("./_shared");

const brandSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    packingCategory: { type: String, default: "" },
    manufacturer: { type: String, default: "" },
    material: { type: String, default: "" },
    status: { type: String, default: "Active" },
    // Values for whatever extra fields this client defined for this form in
    // Settings → Custom Fields — see models/CustomFieldDefinition.js.
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseOptions
);

module.exports = mongoose.model("Brand", brandSchema);
