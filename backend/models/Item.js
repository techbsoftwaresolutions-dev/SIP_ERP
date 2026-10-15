const { mongoose, baseOptions } = require("./_shared");

const itemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    name: { type: String, required: true },
    product: { type: String, default: "" },
    itemCode: { type: String, default: "" },
    // Scanned with a barcode/QR reader (hardware or camera) to find this item
    // fast on a Purchase or Sales Invoice — see the Barcode Scanner add-on.
    // Not unique: assigning one is optional, so blank values are common.
    barcode: { type: String, default: "", index: true },
    description: { type: String, default: "" },
    hsnCode: { type: String, default: "" },
    taxPercent: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    category: { type: String, default: "" },
    brand: { type: String, default: "" },
    // What role this item plays in production. Purely descriptive — the BOM
    // and work order pickers deliberately do NOT filter on it, because a
    // sub-assembly is a finished good to one BOM and a component to the next.
    // Raw Material | Semi-Finished | Finished Good | Consumable | Spare Part
    itemType: { type: String, default: "Raw Material" },
    batchNo: { type: String, default: "" },
    size: { type: String, default: "" },
    warehouse: { type: String, default: "Main Warehouse" },
    qty: { type: Number, default: 0 },
    unit: { type: String, default: "Pcs" },
    sellingPrice: { type: Number, default: 0 },
    purchasePrice: { type: Number, default: 0 },
    minStockLevel: { type: Number, default: 0 },
    reserved: { type: Number, default: 0 },
    damaged: { type: Number, default: 0 },
    status: { type: String, default: "Active" },
    // Values for whatever extra fields this client defined for Items in
    // Settings → Custom Fields — see models/CustomFieldDefinition.js.
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseOptions
);

module.exports = mongoose.model("Item", itemSchema);
