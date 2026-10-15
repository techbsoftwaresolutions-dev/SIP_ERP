const { mongoose, baseOptions } = require("./_shared");

const ledgerEntrySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    partyType: { type: String, required: true }, // "Customer" | "Supplier"
    partyName: { type: String, required: true },
    date: { type: String, default: "" },
    type: { type: String, default: "" },
    referenceNo: { type: String, default: "" },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
  },
  baseOptions
);

module.exports = mongoose.model("LedgerEntry", ledgerEntrySchema);
