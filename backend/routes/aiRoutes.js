// AI-assisted features (Tier 1): natural-language search, payment-reminder /
// message drafting, and invoice notes generation. All Anthropic calls happen
// here on the server; the API key never reaches the browser.
//
// Registered from server.js AFTER the tenant middleware, so the model
// proxies below already point at the right client database per request.

const {
  Customer,
  Invoice,
  Settings,
} = require("../models/tenantProxy");
const { currentModels } = require("../tenancy/tenantContext");
const { isConfigured, noteMissingKey, AI_UNAVAILABLE_MESSAGE, createMessage, textOf, AiError } = require("../services/aiClient");
const { answerQuestion } = require("../services/aiQuery");

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function inr(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

// Pull the first {...} JSON object out of a model reply; falls back to null.
function parseJsonLoose(text) {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function registerAiRoutes(app) {
  // Lets the frontend show a friendly "AI is off" state instead of erroring.
  app.get("/api/ai/status", (req, res) => {
    res.json({ configured: isConfigured() });
  });

  // --- Natural-language search over CRM data ---
  app.post(
    "/api/ai/ask",
    asyncHandler(async (req, res) => {
      const question = (req.body && req.body.question ? String(req.body.question) : "").trim();
      if (!question) return res.status(400).json({ message: "Ask a question first." });
      if (question.length > 800) return res.status(400).json({ message: "That question is too long." });

      const result = await answerQuestion(currentModels(), question);
      res.json(result);
    })
  );

  // --- Payment reminder / follow-up message drafting ---
  app.post(
    "/api/ai/payment-reminder",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const customerName = String(body.customer || "").trim();
      const channel = body.channel === "whatsapp" ? "whatsapp" : "email";
      const tone = String(body.tone || "polite").slice(0, 30);
      if (!customerName) return res.status(400).json({ message: "Customer is required." });
      if (!isConfigured()) {
        noteMissingKey();
        throw new AiError(AI_UNAVAILABLE_MESSAGE, 503);
      }

      const [customer, settings, dueInvoices] = await Promise.all([
        Customer.findOne({ name: customerName }).lean(),
        Settings.findOne().lean(),
        Invoice.find({ customer: customerName, balance: { $gt: 0 } }, { _id: 0, __v: 0 })
          .sort({ seq: -1 })
          .limit(50)
          .lean(),
      ]);

      const invoices = dueInvoices.length
        ? dueInvoices
        : await Invoice.find(
            { customer: customerName, status: { $nin: ["Paid", "paid", "PAID"] } },
            { _id: 0, __v: 0 }
          )
            .sort({ seq: -1 })
            .limit(50)
            .lean();

      const totalDue = invoices.reduce((s, i) => s + Number(i.balance || 0), 0);
      const companyName =
        (settings && (settings.companyName || settings.legalName || settings.adminName)) || "our company";

      const facts = {
        customer: customerName,
        contactPerson: customer?.contactPerson && customer.contactPerson !== "—" ? customer.contactPerson : null,
        companyName,
        totalOutstanding: inr(totalDue),
        invoiceCount: invoices.length,
        invoices: invoices.slice(0, 12).map((i) => ({
          number: i.id,
          date: i.date || "",
          dueDate: i.dueDate || "",
          amount: inr(i.amount),
          balance: inr(i.balance),
          status: i.status || "",
        })),
      };

      const system = `You draft short, courteous payment-reminder messages for an Indian business chasing its own customer.
Return ONLY a JSON object: {"subject": string, "message": string}.
- For channel "whatsapp": subject is "" and message is 3-5 short lines, friendly, may use a couple of simple emojis, no markdown.
- For channel "email": subject is a normal email subject; message is a short plain-text email body with greeting and sign-off from "${companyName}".
- Tone: ${tone}. Never threaten. Reference the outstanding total and list up to 5 invoice numbers with balances.
- Use only the facts given. Do not invent invoice numbers, dates, bank details, or contact names.`;

      const response = await createMessage({
        system,
        messages: [
          {
            role: "user",
            content: `Channel: ${channel}\nFacts:\n${JSON.stringify(facts, null, 2)}\n\nDraft the reminder.`,
          },
        ],
        max_tokens: 700,
        temperature: 0.4,
      });

      const raw = textOf(response);
      const parsed = parseJsonLoose(raw) || {};
      const message = (parsed.message || raw || "").trim();
      if (!message) throw new AiError("The AI did not return a message. Try again.");

      res.json({
        channel,
        subject: channel === "email" ? (parsed.subject || `Payment reminder — ${customerName}`) : "",
        message,
        outstanding: totalDue,
        invoiceCount: invoices.length,
      });
    })
  );

  // --- Invoice notes / terms generator ---
  app.post(
    "/api/ai/invoice-notes",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      if (!isConfigured()) {
        noteMissingKey();
        throw new AiError(AI_UNAVAILABLE_MESSAGE, 503);
      }
      const items = Array.isArray(body.items) ? body.items.slice(0, 20) : [];
      const productList = items
        .map((i) => String(i.product || "").trim())
        .filter(Boolean)
        .join(", ");

      const settings = await Settings.findOne().lean();
      const companyName = (settings && (settings.companyName || settings.legalName)) || "the seller";

      const system = `You write the "Notes / Terms" block printed on an Indian GST tax invoice.
Return plain text only (no markdown, no JSON): 2 to 4 short lines.
Include standard, non-controversial terms: goods once sold, payment timeframe, interest on delayed payment, and "Subject to local jurisdiction".
Keep it generic and professional. Do not invent bank details, GSTIN, phone numbers, or amounts.`;

      const userMsg = [
        `Seller: ${companyName}`,
        body.customer ? `Buyer: ${body.customer}` : null,
        productList ? `Items: ${productList}` : null,
        body.paymentMode ? `Payment mode: ${body.paymentMode}` : null,
        body.paymentTerms ? `Payment terms: ${body.paymentTerms}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const response = await createMessage({
        system,
        messages: [{ role: "user", content: `${userMsg}\n\nWrite the notes/terms.` }],
        max_tokens: 400,
        temperature: 0.5,
      });

      const notes = textOf(response);
      if (!notes) throw new AiError("The AI did not return any text. Try again.");
      res.json({ notes });
    })
  );
}

module.exports = { registerAiRoutes };
