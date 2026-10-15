// Thin wrapper around the Razorpay REST API. Uses Node's global fetch
// (Node 18+) so no new dependency is added to the backend — same approach as
// services/aiClient.js.
//
//   RAZORPAY_KEY_ID        required — from the Razorpay dashboard (Settings > API Keys)
//   RAZORPAY_KEY_SECRET    required — same place; never sent to the frontend
//   RAZORPAY_WEBHOOK_SECRET optional — only needed once a webhook is configured
//
// Every route that touches this checks isConfigured() first and returns a
// friendly 503 if the keys are missing, so the rest of the app — and the
// whole upgrade-picker UI — keeps working with online payment simply off
// until a Razorpay account is connected.

const crypto = require("crypto");

const ORDERS_URL = "https://api.razorpay.com/v1/orders";

function isConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

// Safe to expose to the frontend — it's the public half of the key pair,
// needed to open the Razorpay Checkout widget. The secret never leaves here.
function getPublicKeyId() {
  return process.env.RAZORPAY_KEY_ID || "";
}

class RazorpayError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "RazorpayError";
    this.status = status;
  }
}

function authHeader() {
  const token = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  return `Basic ${token}`;
}

// amount is in the smallest currency unit (paise for INR) — Razorpay requires
// this as an integer, never a decimal rupee amount.
async function createOrder({ amount, currency = "INR", receipt, notes }) {
  if (!isConfigured()) {
    throw new RazorpayError("Online payments are not configured yet. Contact TechB Software Solutions.", 503);
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new RazorpayError("Invalid order amount.", 400);
  }

  let res;
  try {
    res = await fetch(ORDERS_URL, {
      method: "POST",
      headers: { Authorization: authHeader(), "Content-Type": "application/json" },
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
function verifyPaymentSignature({ orderId, paymentId, signature }) {
  if (!isConfigured() || !orderId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch (_) {
    return false; // length mismatch etc — never a valid signature
  }
}

// For a future server-to-server webhook (Settings > Webhooks in the Razorpay
// dashboard). Needs RAZORPAY_WEBHOOK_SECRET and the RAW request body — not
// wired into a route yet since it requires a public HTTPS URL to register
// with Razorpay, which only exists once this is deployed. Left ready so
// adding the route later is a small addition, not a redesign.
function verifyWebhookSignature({ rawBody, signature }) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !rawBody || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch (_) {
    return false;
  }
}

module.exports = {
  isConfigured,
  getPublicKeyId,
  createOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  RazorpayError,
};
