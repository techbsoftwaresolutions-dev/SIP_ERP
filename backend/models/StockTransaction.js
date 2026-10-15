const { mongoose, baseOptions } = require("./_shared");

const stockTransactionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    type: { type: String, required: true }, // "In" | "Out" | "Transfer" | "Adjustment"
    product: { type: String, required: true },
    quantity: { type: Number, default: 0 },
    warehouse: { type: String, default: "Main Warehouse" },
    toWarehouse: { type: String, default: "" },
    reason: { type: String, default: "" },
    poNumber: { type: String, default: "" },
    grnNumber: { type: String, default: "" },
    supplier: { type: String, default: "" },
    batchNo: { type: String, default: "" },
    acceptedQty: { type: Number, default: 0 },
    status: { type: String, default: "" },
    issueType: { type: String, default: "" },
    referenceNo: { type: String, default: "" },
    departmentOrCustomer: { type: String, default: "" },
    unit: { type: String, default: "Nos" },
    date: { type: String, default: "" },
  },
  baseOptions
);

module.exports = mongoose.model("StockTransaction", stockTransactionSchema);
