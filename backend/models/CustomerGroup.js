const { mongoose, baseOptions } = require("./_shared");

const customerGroupSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    status: { type: String, default: "Active" },
  },
  baseOptions
);

module.exports = mongoose.model("CustomerGroup", customerGroupSchema);
