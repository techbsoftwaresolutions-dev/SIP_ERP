const { mongoose, baseOptions } = require("./_shared");

// Finished goods coming off the line and back into stock. Posting one
// increments Item.qty for `product` by `acceptedQty` and advances the parent
// work order's producedQty/rejectedQty — the closing half of the cycle that
// MaterialIssue opens.
const productionReceiptSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    workOrder: { type: String, required: true }, // WorkOrder.id
    product: { type: String, required: true },
    productCode: { type: String, default: "" },
    receiptDate: { type: String, default: "" },
    warehouse: { type: String, default: "Main Warehouse" },
    // Only acceptedQty reaches stock; rejectedQty is recorded for yield
    // reporting and is not added to Item.qty.
    acceptedQty: { type: Number, default: 0 },
    rejectedQty: { type: Number, default: 0 },
    unit: { type: String, default: "Nos" },
    batchNo: { type: String, default: "" },
    receivedBy: { type: String, default: "" },
    inspectedBy: { type: String, default: "" },
    rejectionReason: { type: String, default: "" },
    status: { type: String, default: "Accepted" }, // Accepted | Cancelled
    notes: { type: String, default: "" },
  },
  baseOptions
);

module.exports = mongoose.model("ProductionReceipt", productionReceiptSchema);
