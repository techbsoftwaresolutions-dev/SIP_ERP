const { mongoose, baseOptions } = require("./_shared");

const inventoryItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    warehouse: { type: String, default: "Main Warehouse" },
    quantity: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 50 },
    unit: { type: String, default: "Pcs" },
    status: { type: String, default: "In Stock" },
    lastUpdated: { type: String, default: "" },
  },
  baseOptions
);

module.exports = mongoose.model("InventoryItem", inventoryItemSchema);
