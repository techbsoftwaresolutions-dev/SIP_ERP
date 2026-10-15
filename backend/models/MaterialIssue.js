const { mongoose, baseOptions } = require("./_shared");

const issueLineSchema = new mongoose.Schema(
  {
    item: { type: String, required: true },
    itemCode: { type: String, default: "" },
    qty: { type: Number, default: 0 },
    unit: { type: String, default: "Nos" },
    rate: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    batchNo: { type: String, default: "" },
  },
  { _id: false }
);

// Raw material leaving the store for a work order. Posting one decrements
// Item.qty for every line (see the material issue routes in server.js), so
// this is the document that actually moves stock onto the shop floor.
const materialIssueSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    workOrder: { type: String, required: true }, // WorkOrder.id
    product: { type: String, default: "" }, // what that work order builds
    issueDate: { type: String, default: "" },
    warehouse: { type: String, default: "Main Warehouse" },
    issuedBy: { type: String, default: "" },
    receivedBy: { type: String, default: "" },
    items: { type: [issueLineSchema], default: [] },
    totalQty: { type: Number, default: 0 },
    totalValue: { type: Number, default: 0 },
    status: { type: String, default: "Issued" }, // Issued | Cancelled
    notes: { type: String, default: "" },
  },
  baseOptions
);

module.exports = mongoose.model("MaterialIssue", materialIssueSchema);
