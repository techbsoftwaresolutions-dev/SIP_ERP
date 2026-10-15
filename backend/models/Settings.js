const { mongoose, baseOptions } = require("./_shared");

const settingsSchema = new mongoose.Schema(
  {
    // Admin Profile
    adminName: { type: String, default: "" },
    adminAvatar: { type: String, default: "" },
    username: { type: String, default: "admin" },
    password: { type: String, default: "admin123" },

    // Company Settings
    logo: { type: String, default: "" },
    signature: { type: String, default: "" },
    seal: { type: String, default: "" },
    companyName: { type: String, default: "" },
    legalName: { type: String, default: "" },
    gstin: { type: String, default: "" },
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    website: { type: String, default: "" },

    // Bank Details (shown on printed invoices)
    bankName: { type: String, default: "" },
    bankAccountName: { type: String, default: "" },
    bankAccountNumber: { type: String, default: "" },
    bankIfsc: { type: String, default: "" },

    // General Settings
    currency: { type: String, default: "INR (₹)" },
    fiscalYearStart: { type: String, default: "April" },
    timezone: { type: String, default: "Asia/Kolkata (IST)" },
    dateFormat: { type: String, default: "DD MMM YYYY" },

    // Invoice print theme. The catalogue and the tier rules live in
    // ../invoiceThemes.js; what a client may actually pick depends on their
    // plan, so this value is always resolved through resolveTheme() on read
    // rather than trusted as-is.
    invoiceTheme: { type: String, default: "billbook" },
    invoiceAccent: { type: String, default: "#2f4a7d" },

    // Numbering Settings.
    // Each document type is prefix + a zero-padded running serial, e.g.
    // prefix "SIS/26-27/" + next 99 + digits 3 -> "SIS/26-27/099".
    // The serial is claimed and advanced atomically on each create; see
    // allocateDocNumber() in server.js.
    invoicePrefix: { type: String, default: "INV-" },
    invoiceNextNumber: { type: Number, default: 1 },
    invoiceDigits: { type: Number, default: 4 },
    salesOrderPrefix: { type: String, default: "SO-" },
    salesOrderNextNumber: { type: Number, default: 1 },
    salesOrderDigits: { type: Number, default: 4 },
    purchaseOrderPrefix: { type: String, default: "PO-" },
    purchaseOrderNextNumber: { type: Number, default: 1 },
    purchaseOrderDigits: { type: Number, default: 4 },
    deliveryChallanPrefix: { type: String, default: "DC-" },
    deliveryChallanNextNumber: { type: Number, default: 1 },
    deliveryChallanDigits: { type: Number, default: 4 },
    quotationPrefix: { type: String, default: "QTN-" },
    quotationNextNumber: { type: Number, default: 1 },
    quotationDigits: { type: Number, default: 4 },
    customerCodePrefix: { type: String, default: "CUST-" },
    customerCodeNextNumber: { type: Number, default: 1 },
    customerCodeDigits: { type: Number, default: 4 },
    supplierCodePrefix: { type: String, default: "SUP-" },
    supplierCodeNextNumber: { type: Number, default: 1 },
    supplierCodeDigits: { type: Number, default: 4 },

    // Payment terms & reminders.
    // Used to default an invoice/bill due date when the customer or
    // supplier has no paymentTerms of their own. Accepts "30 Days",
    // "Net 30", "30", or "Immediate".
    salesPaymentTerms: { type: String, default: "15 Days" },
    purchasePaymentTerms: { type: String, default: "30 Days" },
    // How many days ahead counts as "due soon" on the Reminders screen.
    reminderDueSoonDays: { type: Number, default: 7 },

    // How many copies a document prints and downloads with by default
    // ("1" to "3": Original, Duplicate, Office). Kept as text because the
    // settings screens edit every field as text; the preview pages choose a
    // different number per print if they want to. Invoices and delivery
    // challans have always printed three, so they default to that.
    invoiceCopies: { type: String, default: "3" },
    challanCopies: { type: String, default: "3" },
    purchaseOrderCopies: { type: String, default: "1" },
    quotationCopies: { type: String, default: "1" },
    enquiryCopies: { type: String, default: "1" },

    // The table template list pages use: "Classic Table" (the default) or
    // "Card Rows" (each row as a soft card). Chosen in Settings -> General.
    tableStyle: { type: String, enum: ["Classic Table", "Card Rows"], default: "Classic Table" },

    // What each printed copy is called: 1 copy is the ORIGINAL, 2 adds a
    // DUPLICATE, 3 adds an OFFICE copy. Blank keeps those defaults; a business
    // can rename any of them (e.g. "TRANSPORTER COPY").
    copyLabel1: { type: String, default: "", maxlength: 30 },
    copyLabel2: { type: String, default: "", maxlength: 30 },
    copyLabel3: { type: String, default: "", maxlength: 30 },

    // The built-in admin account signs in with these. `password` is LEGACY
    // plain text, kept only so an existing install keeps working — the
    // first successful sign-in rehashes into adminPasswordHash and clears
    // it. See ../clientAuth.js.
    adminPasswordHash: { type: String, default: "" },

    // Email Settings
    smtpHost: { type: String, default: "" },
    smtpPort: { type: String, default: "587" },
    smtpUser: { type: String, default: "" },
    // Stripped from every API response by sanitizeSettings() in ../server.js.
    smtpPassword: { type: String, default: "" },
    fromEmail: { type: String, default: "" },

    // WhatsApp Business Cloud API (Meta). Each client uses their own account.
    // "Enabled" turns on the "Send via WhatsApp" buttons on print pages.
    waStatus: { type: String, default: "Disabled" },
    waPhoneNumberId: { type: String, default: "" },
    waBusinessAccountId: { type: String, default: "" },
    // Stripped from every API response by sanitizeSettings() in ../server.js.
    waAccessToken: { type: String, default: "" },
    // The approved template documents are sent with (see whatsapp.js).
    waTemplateName: { type: String, default: "document_share" },
    waTemplateLang: { type: String, default: "en" },

    // Tax Settings
    taxName: { type: String, default: "GST" },
    defaultTaxRate: { type: Number, default: 18 },
    taxRegistrationNo: { type: String, default: "" },
  },
  baseOptions
);

module.exports = mongoose.model("Settings", settingsSchema);
