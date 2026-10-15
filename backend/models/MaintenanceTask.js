const { mongoose, baseOptions } = require("./_shared");

const maintenanceTaskSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    asset: { type: String, required: true },
    type: { type: String, default: "Preventive" },
    scheduledDate: { type: String, default: "" },
    assignedTo: { type: String, default: "R. Kumar" },
    status: { type: String, default: "Scheduled" },
    // Values for whatever extra fields this client defined for this form in
    // Settings → Custom Fields — see models/CustomFieldDefinition.js.
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseOptions
);

module.exports = mongoose.model("MaintenanceTask", maintenanceTaskSchema);
