const { mongoose, baseOptions } = require("./_shared");

const invoiceSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    seq: { type: Number, required: true },
    customer: { type: String, required: true },
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    // Shipping address defaults to the billing address (shippingSameAsBilling
    // true) — shippingAddress is only read when it's false, so it never
    // holds stale/fake data for invoices that never set a separate one.
    shippingSameAsBilling: { type: Boolean, default: true },
    shippingAddress: { type: String, default: "" },
    // The GST "Place of Supply" — the state this sale is legally supplied
    // into, which decides CGST+SGST (same as the seller's state) vs IGST
    // (different state). Stored explicitly per invoice rather than only
    // inferred from the customer's master record: a customer's registered
    // address doesn't always match where a given order is actually being
    // delivered, and re-deriving it at print time meant an invoice for a
    // customer with no state on file silently fell back to "same state"
    // (see isIntraState() in gstStateCodes.js) even when that was wrong.
    // Falls back to the customer's own state when blank, for invoices saved
    // before this field existed.
    placeOfSupply: { type: String, default: "" },
    soNumber: { type: String, default: "—" },
    dcNumber: { type: String, default: "—" },
    poNumber: { type: String, default: "" },
    poDate: { type: String, default: "" },
    transportName: { type: String, default: "" },
    vehicleNo: { type: String, default: "" },
    deliveryDate: { type: String, default: "" },
    deliveryLocation: { type: String, default: "" },
    paymentMode: { type: String, default: "" },
    // Cheque number, UPI transaction ID, card approval code — whatever the
    // chosen method asks for (see PaymentMethod.requiresReference). Stored
    // as free text because what it means depends on the method, and the
    // method itself is only a label by the time it reaches here.
    paymentReference: { type: String, default: "" },
    eWayBillNo: { type: String, default: "" },
    // Freeform terms/notes printed on the invoice — set per invoice from the
    // Add/Edit Invoice form, never hardcoded on the print template itself.
    notes: { type: String, default: "" },
    // Each: { product, hsnCode, quantity, unit, unitPrice, taxPercent, amount }.
    // CGST/SGST vs IGST is not stored — it's derived at print time from the
    // customer's state vs the company's (from Settings.gstin), same rate
    // either way, just split differently.
    items: { type: Array, default: [] },
    freightCharges: { type: Number, default: 0 },
    subTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    product: { type: String, default: "" },
    date: { type: String, default: "" },
    dueDate: { type: String, default: "" },
    amount: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    status: { type: String, default: "Unpaid" },

    // ---- Approval (see ../approvalEngine.js) ----
    // "not_required" is stored rather than left blank, so an invoice the
    // engine actively cleared reads differently from one raised before any
    // rule existed. Every invoice gets a verdict at save time.
    approvalStatus: { type: String, default: "not_required" },
    // Which rules held it, in words, so the screen can say why without
    // re-running the engine or looking rules up that may since have gone.
    approvalReason: { type: String, default: "" },
    approvedBy: { type: String, default: "" },
    approvedAt: { type: Date, default: null },
    approvalNote: { type: String, default: "" },
    // Values for whatever extra fields this client defined for this form in
    // Settings → Custom Fields — see models/CustomFieldDefinition.js.
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseOptions
);

module.exports = mongoose.model("Invoice", invoiceSchema);
