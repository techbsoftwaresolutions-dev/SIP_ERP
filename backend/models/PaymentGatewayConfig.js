const { mongoose, baseOptions } = require("./_shared");

// Platform-wide payment gateway configuration (Razorpay).
// Lives in the MASTER database alongside Tenant, Plan and SuperAdmin.
// Allows super-admins to view and manage Razorpay credentials directly
// from the Admin Panel without modifying environment files or restarting servers.
const paymentGatewayConfigSchema = new mongoose.Schema(
  {
    gateway: { type: String, required: true, unique: true, default: "razorpay" },
    enabled: { type: Boolean, default: true },
    keyId: { type: String, default: "" },
    keySecret: { type: String, default: "" },
    webhookSecret: { type: String, default: "" },
    companyName: { type: String, default: "SIPERP" },
    themeColor: { type: String, default: "#2563eb" },
    updatedBy: { type: String, default: "" },
  },
  baseOptions
);

module.exports = { schema: paymentGatewayConfigSchema };
