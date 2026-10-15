const { mongoose, baseOptions } = require("./_shared");

// One routing operation of one work order, as booked on the shop floor.
// A work order with a three-step routing produces three job cards.
const jobCardSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    workOrder: { type: String, required: true }, // WorkOrder.id
    product: { type: String, default: "" },
    operation: { type: String, required: true },
    sequence: { type: Number, default: 0 },
    workCenter: { type: String, default: "" },
    machine: { type: String, default: "" },
    operator: { type: String, default: "" },
    shift: { type: String, default: "" },
    plannedQty: { type: Number, default: 0 },
    completedQty: { type: Number, default: 0 },
    rejectedQty: { type: Number, default: 0 },
    unit: { type: String, default: "Nos" },
    startTime: { type: String, default: "" },
    endTime: { type: String, default: "" },
    // Actual machine/labour hours booked, for costing against the BOM estimate.
    hours: { type: Number, default: 0 },
    date: { type: String, default: "" },
    status: { type: String, default: "Pending" }, // Pending | In Progress | Completed | On Hold
    remarks: { type: String, default: "" },
    // Values for whatever extra fields this client defined for this form in
    // Settings → Custom Fields — see models/CustomFieldDefinition.js.
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseOptions
);

module.exports = mongoose.model("JobCard", jobCardSchema);
