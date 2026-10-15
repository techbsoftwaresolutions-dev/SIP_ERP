const { mongoose, baseOptions } = require("./_shared");

// A physical or logical production area — a line, a cell, a department.
// Machines belong to one, and job cards are booked against one.
const workCenterSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    name: { type: String, required: true },
    code: { type: String, default: "" },
    description: { type: String, default: "" },
    location: { type: String, default: "" },
    supervisor: { type: String, default: "" },
    // Rated output per working day, in `unit` — used by the capacity column
    // on the work centers list.
    capacityPerDay: { type: Number, default: 0 },
    unit: { type: String, default: "Nos" },
    workingHoursPerDay: { type: Number, default: 8 },
    // Drives the operation cost on a BOM routing step.
    costPerHour: { type: Number, default: 0 },
    status: { type: String, default: "Active" }, // Active | Inactive
    // Values for whatever extra fields this client defined for this form in
    // Settings → Custom Fields — see models/CustomFieldDefinition.js.
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseOptions
);

module.exports = mongoose.model("WorkCenter", workCenterSchema);
