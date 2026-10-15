const { mongoose, baseOptions } = require("./_shared");

// Material requirement for this work order, exploded from the BOM at the
// moment the order was created and then frozen. A BOM revised afterwards must
// not retroactively change what an in-flight order was costed against, so
// these rows are a snapshot, not a live lookup.
const requirementSchema = new mongoose.Schema(
  {
    item: { type: String, required: true },
    itemCode: { type: String, default: "" },
    // BOM qty scaled to `plannedQty`, wastage included.
    requiredQty: { type: Number, default: 0 },
    // Kept in step by the material issue routes — never written directly.
    issuedQty: { type: Number, default: 0 },
    unit: { type: String, default: "Nos" },
    rate: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const workOrderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    // Bom.id this was exploded from. Blank is allowed — a rework or trial
    // order may have no BOM, and then `requirements` is filled in by hand.
    bom: { type: String, default: "" },
    product: { type: String, required: true },
    productCode: { type: String, default: "" },
    plannedQty: { type: Number, default: 0 },
    // Maintained by the production receipt routes as output is booked in.
    producedQty: { type: Number, default: 0 },
    rejectedQty: { type: Number, default: 0 },
    unit: { type: String, default: "Nos" },
    warehouse: { type: String, default: "Main Warehouse" },
    workCenter: { type: String, default: "" },
    machine: { type: String, default: "" },
    // SalesOrder.id when this order is being built against a customer order
    // rather than to stock.
    salesOrder: { type: String, default: "" },
    customer: { type: String, default: "" },
    startDate: { type: String, default: "" },
    dueDate: { type: String, default: "" },
    completedDate: { type: String, default: "" },
    priority: { type: String, default: "Normal" }, // Low | Normal | High | Urgent
    // Draft | Released | In Progress | Completed | Cancelled.
    // Material can only be issued once an order leaves Draft.
    status: { type: String, default: "Draft" },
    requirements: { type: [requirementSchema], default: [] },
    materialCost: { type: Number, default: 0 },
    operationCost: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    // Values for whatever extra fields this client defined for this form in
    // Settings → Custom Fields — see models/CustomFieldDefinition.js.
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseOptions
);

module.exports = mongoose.model("WorkOrder", workOrderSchema);
