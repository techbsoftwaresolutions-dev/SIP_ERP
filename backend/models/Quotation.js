const { mongoose, baseOptions } = require("./_shared");

const quotationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    customer: { type: String, required: true },
    // The customer block, snapshotted onto the quotation the way an invoice
    // does, so the printed document does not change if the customer is edited later.
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    // Decides CGST+SGST vs IGST on the printout — see Invoice.placeOfSupply.
    placeOfSupply: { type: String, default: "" },
    // A short title / the customer enquiry this answers.
    subject: { type: String, default: "" },
    referenceNo: { type: String, default: "" },
    paymentTerms: { type: String, default: "" },
    deliveryTerms: { type: String, default: "" },
    // Terms & conditions printed on the quotation.
    notes: { type: String, default: "" },
    date: { type: String, default: "" },
    validTill: { type: String, default: "" },
    // Each: { product, hsnCode, quantity, unit, unitPrice, taxPercent, amount }.
    items: { type: Array, default: [] },
    // A single discount off the whole quotation, taken before tax so GST is
    // charged only on what the customer actually pays for. discountValue is
    // what was typed (a rupee amount or a percentage, per discountType);
    // discountAmount is the resulting rupees, recomputed on every save.
    discountType: { type: String, enum: ["amount", "percent"], default: "amount" },
    discountValue: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    freightCharges: { type: Number, default: 0 },
    // Before discount and tax.
    subTotal: { type: Number, default: 0 },
    // After the discount — the tax actually payable.
    taxTotal: { type: Number, default: 0 },
    product: { type: String, default: "" },
    // Grand total (sub total + tax + freight) — what the list shows.
    amount: { type: Number, default: 0 },
    status: { type: String, default: "Draft" },
    // The Sales Order this quotation was converted into, if any.
    salesOrderId: { type: String, default: "" },
    // Values for whatever extra fields this client defined for this form in
    // Settings → Custom Fields — see models/CustomFieldDefinition.js.
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseOptions
);

module.exports = mongoose.model("Quotation", quotationSchema);
