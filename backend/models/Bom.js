const { mongoose, baseOptions } = require("./_shared");

// One component line of a BOM. `item` is the Item's `name`, matching how
// every other document in this app references the catalog (see SalesOrder /
// PurchaseOrder line items) — not an ObjectId.
const componentSchema = new mongoose.Schema(
  {
    item: { type: String, required: true },
    itemCode: { type: String, default: "" },
    // Quantity needed to build ONE `outputQty` batch of the parent product.
    qty: { type: Number, default: 0 },
    unit: { type: String, default: "Nos" },
    // Expected process loss, applied on top of `qty` when a work order
    // explodes this BOM into its material requirement.
    wastagePercent: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    // Values for whatever extra fields this client defined for this form in
    // Settings → Custom Fields — see models/CustomFieldDefinition.js.
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

// A routing step. Kept on the BOM so a work order can generate its job cards
// from the same definition the costing came from.
const operationSchema = new mongoose.Schema(
  {
    operation: { type: String, required: true },
    workCenter: { type: String, default: "" },
    machine: { type: String, default: "" },
    // Per `outputQty` batch, same basis as the component quantities.
    hours: { type: Number, default: 0 },
    costPerHour: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    sequence: { type: Number, default: 0 },
  },
  { _id: false }
);

const bomSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    // The finished (or semi-finished) Item this BOM produces.
    product: { type: String, required: true },
    productCode: { type: String, default: "" },
    version: { type: String, default: "1.0" },
    // How many units of `product` one run of this BOM yields. Every component
    // quantity and operation time is expressed per this batch size.
    outputQty: { type: Number, default: 1 },
    unit: { type: String, default: "Nos" },
    components: { type: [componentSchema], default: [] },
    operations: { type: [operationSchema], default: [] },
    materialCost: { type: Number, default: 0 },
    operationCost: { type: Number, default: 0 },
    overheadCost: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 },
    // Only one BOM per product should be "Active" — that's the one a new
    // work order defaults to. Others stay as "Draft" or "Obsolete" history.
    status: { type: String, default: "Draft" }, // Draft | Active | Obsolete
    effectiveFrom: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  baseOptions
);

module.exports = mongoose.model("Bom", bomSchema);
