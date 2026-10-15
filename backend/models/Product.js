const { mongoose, baseOptions } = require("./_shared");

const productSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    category: { type: String, default: "General" },
    brand: { type: String, default: "" },
    material: { type: String, default: "" },
    size: { type: String, default: "" },
    hsnSac: { type: String, default: "" },
    unit: { type: String, default: "Pcs" },
    unitPrice: { type: Number, default: 0 },
    stock: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 50 },
    status: { type: String, default: "In Stock" },
  },
  baseOptions
);

module.exports = mongoose.model("Product", productSchema);
