// Thin wrapper around the Razorpay REST API. Uses Node's global fetch
// (Node 18+) so no new dependency is added to the backend — same approach as
// services/aiClient.js.
//
// Key resolution order:
//   1. Master DB PaymentGatewayConfig collection (configured dynamically via Admin Panel)
//   2. Environment variables (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET)
//
// Every route that touches this checks isConfigured() and returns a friendly
// error if the keys are missing or the gateway is disabled.

const crypto = require("crypto");

const ORDERS_URL = "https://api.razorpay.com/v1/orders";

let cachedConfig = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 60 * 1000;

function invalidateConfigCache() {
  cachedConfig = null;
  cacheExpiresAt = 0;
}

// Resolves active Razorpay credentials from Master DB or fallback to environment variables
async function getActiveConfig() {
  if (cachedConfig && Date.now() < cacheExpiresAt) {
    return cachedConfig;
  }

  let dbConfig = null;
  try {
    const { getPaymentGatewayConfigModel } = require("../tenancy/tenantModels");
    const PaymentGatewayConfig = getPaymentGatewayConfigModel();
    if (PaymentGatewayConfig) {
      dbConfig = await PaymentGatewayConfig.findOne({ gateway: "razorpay" }).lean();
    }
  } catch (_) {
    // If DB is not available yet, silently fall back to env
  }

  const keyId = (dbConfig && dbConfig.keyId) ? dbConfig.keyId.trim() : (process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = (dbConfig && dbConfig.keySecret) ? dbConfig.keySecret.trim() : (process.env.RAZORPAY_KEY_SECRET || "").trim();
  const webhookSecret = (dbConfig && dbConfig.webhookSecret) ? dbConfig.webhookSecret.trim() : (process.env.RAZORPAY_WEBHOOK_SECRET || "").trim();
  const enabled = dbConfig ? dbConfig.enabled !== false : true;
  const companyName = (dbConfig && dbConfig.companyName) || "SIPERP";
  const themeColor = (dbConfig && dbConfig.themeColor) || "#2563eb";

  cachedConfig = {
    keyId,
    keySecret,
    webhookSecret,
    enabled,
    companyName,
    themeColor,
    isDbConfigured: Boolean(dbConfig && dbConfig.keyId),
  };
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;

  return cachedConfig;
}

function isConfiguredSync() {
  if (cachedConfig) {
    return Boolean(cachedConfig.enabled && cachedConfig.keyId && cachedConfig.keySecret);
  }
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

async function isConfigured() {
  const config = await getActiveConfig();
  return Boolean(config.enabled && config.keyId && config.keySecret);
}

// Safe to expose to the frontend — it's the public half of the key pair,
// needed to open the Razorpay Checkout widget. The secret never leaves here.
async function getPublicKeyId() {
  const config = await getActiveConfig();
  return config.keyId || "";
}

function getPublicKeyIdSync() {
  if (cachedConfig && cachedConfig.keyId) return cachedConfig.keyId;
  return process.env.RAZORPAY_KEY_ID || "";
}

class RazorpayError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "RazorpayError";
    this.status = status;
  }
}

function makeAuthHeader(keyId, keySecret) {
  const token = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  return `Basic ${token}`;
}

// Test Razorpay connection with given credentials or active credentials
async function testCredentials({ keyId, keySecret }) {
  const kId = (keyId || "").trim();
  const kSecret = (keySecret || "").trim();

  if (!kId || !kSecret) {
    throw new RazorpayError("Key ID and Key Secret are required to test Razorpay connection.", 400);
  }

  let res;
  try {
    res = await fetch("https://api.razorpay.com/v1/orders?count=1", {
      method: "GET",
      headers: { Authorization: makeAuthHeader(kId, kSecret) },
    });
  } catch (err) {
    throw new RazorpayError(`Could not reach Razorpay API: ${err.message}`, 502);
  }

  const data = await res.json().catch(() => ({}));
  if (res.status === 401 || (data && data.error && data.error.code === "BAD_REQUEST_ERROR")) {
    const desc = (data && data.error && data.error.description) || "Invalid Key ID or Key Secret.";
    throw new RazorpayError(desc, 401);
  }

  if (!res.ok) {
    const desc = (data && data.error && data.error.description) || `Razorpay check failed with status ${res.status}`;
    throw new RazorpayError(desc, res.status);
  }

  const isTestMode = kId.startsWith("rzp_test_");
  return {
    success: true,
    mode: isTestMode ? "test" : "live",
    message: `Connected successfully to Razorpay (${isTestMode ? "Test" : "Live"} mode).`,
  };
}

// amount is in the smallest currency unit (paise for INR) — Razorpay requires
// this as an integer, never a decimal rupee amount.
async function createOrder({ amount, currency = "INR", receipt, notes }) {
  const config = await getActiveConfig();
  if (!config.enabled || !config.keyId || !config.keySecret) {
    throw new RazorpayError("Online payments are not configured yet or currently disabled. Contact platform administrator.", 503);
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new RazorpayError("Invalid order amount.", 400);
  }

  let res;
  try {
    res = await fetch(ORDERS_URL, {
      method: "POST",
      headers: {
        Authorization: makeAuthHeader(config.keyId, config.keySecret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount, currency, receipt, notes, payment_capture: 1 }),
    });
  } catch (err) {
    throw new RazorpayError(`Could not reach Razorpay: ${err.message}`, 502);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data && data.error && data.error.description) || `Razorpay order creation failed (${res.status}).`;
    throw new RazorpayError(msg, 502);
  }
  return data; // { id, amount, currency, status, ... }
}

// Checkout hands back razorpay_order_id + razorpay_payment_id + a signature
// signed with the key secret over "order_id|payment_id". This is the
// standard way to confirm a payment actually succeeded without trusting the
// browser's word for it alone.
async function verifyPaymentSignature({ orderId, paymentId, signature }) {
  const config = await getActiveConfig();
  if (!config.keySecret || !orderId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac("sha256", config.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch (_) {
    return false; // length mismatch etc — never a valid signature
  }
}

// For webhook verification
async function verifyWebhookSignature({ rawBody, signature }) {
  const config = await getActiveConfig();
  const secret = config.webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !rawBody || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch (_) {
    return false;
  }
}

module.exports = {
  getActiveConfig,
  invalidateConfigCache,
  isConfigured,
  isConfiguredSync,
  getPublicKeyId,
  getPublicKeyIdSync,
  testCredentials,
  createOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  RazorpayError,
};
