const { mongoose, baseOptions } = require("./_shared");

const categorySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    materialType: { type: String, default: "" },
    unit: { type: String, default: "Nos" },
    taxRate: { type: Number, default: 18 },
    status: { type: String, default: "Active" },
    // Values for whatever extra fields this client defined for this form in
    // Settings → Custom Fields — see models/CustomFieldDefinition.js.
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseOptions
);

module.exports = mongoose.model("Category", categorySchema);
