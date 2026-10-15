const { mongoose, baseOptions } = require("./_shared");

const machineSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    name: { type: String, required: true },
    code: { type: String, default: "" },
    // WorkCenter.name — same name-reference convention the rest of the app uses.
    workCenter: { type: String, default: "" },
    machineType: { type: String, default: "" },
    manufacturer: { type: String, default: "" },
    serialNo: { type: String, default: "" },
    installedOn: { type: String, default: "" },
    capacityPerHour: { type: Number, default: 0 },
    unit: { type: String, default: "Nos" },
    // Running | Idle | Under Maintenance | Breakdown — what the shop floor
    // sees, and what keeps a machine out of the job-card picker when down.
    status: { type: String, default: "Idle" },
    lastServiceDate: { type: String, default: "" },
    nextServiceDate: { type: String, default: "" },
    notes: { type: String, default: "" },
    // Values for whatever extra fields this client defined for this form in
    // Settings → Custom Fields — see models/CustomFieldDefinition.js.
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseOptions
);

module.exports = mongoose.model("Machine", machineSchema);
