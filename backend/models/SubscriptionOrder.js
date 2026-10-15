const { mongoose, baseOptions } = require("./_shared");

// One row per self-service upgrade attempt a client makes from "My
// Subscription". Lives in the MASTER database next to Tenant and Plan (see
// ../tenantModels.js) — never in a client's own database, and not part of
// models/index.js for the same reason those two aren't.
//
// A row is created the moment a client picks a plan + term (status
// "created"), before any money has moved, so an abandoned checkout still
// leaves a trace. It only becomes "paid" — and only then does the tenant's
// plan actually change — once the Razorpay payment signature has been
// verified server-side (see ../subscriptionUpgrade.js). Nothing here is
// trusted as "this client paid" on its own; the signature check is what the
// tenant update is gated on.
const subscriptionOrderSchema = new mongoose.Schema(
  {
    tenantSubdomain: { type: String, required: true, index: true },
    companyName: { type: String, default: "" }, // snapshot, for admin readability

    // What was being bought. Price is the monthly rate at the moment of
    // purchase — a later change to the Plan itself must not rewrite what
    // this order actually charged.
    planCode: { type: String, required: true },
    planName: { type: String, required: true },
    price: { type: Number, required: true },
    termMonths: { type: Number, required: true },
    amountPayable: { type: Number, required: true }, // price * termMonths, in rupees
    currency: { type: String, default: "INR" },

    status: { type: String, default: "created" }, // "created" | "paid" | "failed" | "cancelled"
    gateway: { type: String, default: "razorpay" },
    gatewayOrderId: { type: String, default: "" },
    gatewayPaymentId: { type: String, default: "" },
    gatewaySignature: { type: String, default: "" },
    errorMessage: { type: String, default: "" }, // set on a failed verification, for support/debugging
  },
  baseOptions
);

// Exported as a bare schema, not a bound model — tenantModels.js binds it
// onto the master database's connection, same as Tenant and Plan.
module.exports = { schema: subscriptionOrderSchema };
