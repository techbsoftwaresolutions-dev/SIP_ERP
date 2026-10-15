// Natural-language questions over the CRM, answered safely.
//
// The model is NEVER given the ability to run arbitrary code or Mongo. It
// gets ONE tool — run_query — whose input is validated field-by-field
// against the whitelist below before anything touches the database. Unknown
// collections, unknown fields, bad operators, oversized limits are all
// rejected. Reads only; no create/update/delete surface exists.

const { createMessage, textOf, toolUseOf, AiError } = require("./aiClient");

// alias -> { model, fields: { name: type }, sort }
// `type` is one of "string" | "number" | "date". Only listed fields can be
// filtered, sorted, or returned.
const QUERYABLE = {
  customers: {
    model: "Customer",
    fields: {
      id: "string", name: "string", city: "string", state: "string",
      customerType: "string", paymentTerms: "string", gstNo: "string",
      phone: "string", email: "string", totalOrders: "number",
      outstanding: "number", status: "string", createdAt: "date",
    },
    sort: { outstanding: -1 },
  },
  invoices: {
    model: "Invoice",
    fields: {
      id: "string", customer: "string", poNumber: "string", soNumber: "string",
      product: "string", date: "string", dueDate: "string", amount: "number",
      paidAmount: "number", balance: "number", status: "string", createdAt: "date",
    },
    sort: { createdAt: -1 },
  },
  salesOrders: {
    model: "SalesOrder",
    fields: {
      id: "string", orderNo: "string", customer: "string", city: "string",
      orderDate: "string", requiredDate: "string", poNumber: "string",
      product: "string", qty: "number", amount: "number", status: "string",
      deliveryStatus: "string", paymentStatus: "string", salesRep: "string",
      invoiceId: "string", createdAt: "date",
    },
    sort: { createdAt: -1 },
  },
  deliveryChallans: {
    model: "DeliveryChallan",
    fields: {
      id: "string", salesOrder: "string", customer: "string", date: "string",
      product: "string", dispatchedQty: "number", unit: "string",
      warehouse: "string", transporter: "string", vehicleNo: "string",
      status: "string", createdAt: "date",
    },
    sort: { createdAt: -1 },
  },
  purchaseOrders: {
    model: "PurchaseOrder",
    fields: {
      id: "string", supplier: "string", orderDate: "string", expectedDate: "string",
      subTotal: "number", taxTotal: "number", amount: "number",
      paymentTerms: "string", status: "string", createdAt: "date",
    },
    sort: { createdAt: -1 },
  },
  items: {
    model: "Item",
    fields: {
      id: "string", name: "string", itemCode: "string", hsnCode: "string",
      category: "string", brand: "string", warehouse: "string", qty: "number",
      unit: "string", sellingPrice: "number", purchasePrice: "number",
      minStockLevel: "number", reserved: "number", damaged: "number",
      status: "string", createdAt: "date",
    },
    sort: { qty: 1 },
  },
};

const OPS = ["eq", "ne", "gt", "gte", "lt", "lte", "contains", "in", "nin", "exists"];
const OP_TO_MONGO = { ne: "$ne", gt: "$gt", gte: "$gte", lt: "$lt", lte: "$lte", in: "$in", nin: "$nin" };
const MAX_LIMIT = 50;
const MAX_ROWS_TO_MODEL = 40;
const MAX_TOOL_ROUNDS = 3;

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Accepts an ISO string, "YYYY-MM-DD", "today", "N days ago", "N days" — used
// only for `createdAt` (the one real Date field on every collection).
function coerceDate(value) {
  if (value instanceof Date) return value;
  const s = String(value).trim().toLowerCase();
  if (s === "today" || s === "now") return new Date();
  const rel = s.match(/^(\d+)\s*days?(?:\s*ago)?$/);
  if (rel) {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(rel[1], 10));
    return d;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new AiError(`"${value}" is not a valid date.`, 400);
  return parsed;
}

// Turn one validated {field, op, value} clause into a Mongo fragment.
function clauseToMongo(spec, { field, op, value }) {
  const type = spec.fields[field];
  if (!type) throw new AiError(`Unknown field "${field}" for this collection.`, 400);
  if (!OPS.includes(op)) throw new AiError(`Unsupported operator "${op}".`, 400);

  const cast = (v) => {
    if (type === "number") {
      const n = Number(v);
      if (Number.isNaN(n)) throw new AiError(`"${v}" is not a number.`, 400);
      return n;
    }
    if (type === "date") return coerceDate(v);
    return String(v);
  };

  if (op === "exists") return { [field]: { $exists: Boolean(value) } };

  if (op === "contains") {
    if (type !== "string") throw new AiError(`"contains" only works on text fields.`, 400);
    return { [field]: { $regex: escapeRegex(value), $options: "i" } };
  }

  if (op === "in" || op === "nin") {
    if (!Array.isArray(value)) throw new AiError(`"${op}" needs a list of values.`, 400);
    return { [field]: { [OP_TO_MONGO[op]]: value.map(cast) } };
  }

  if (op === "eq") return { [field]: cast(value) };
  return { [field]: { [OP_TO_MONGO[op]]: cast(value) } };
}

function buildFilter(spec, where) {
  if (!where || !where.length) return {};
  const parts = where.map((c) => clauseToMongo(spec, c));
  return parts.length === 1 ? parts[0] : { $and: parts };
}

function buildSort(spec, sort) {
  if (!sort || !sort.field) return spec.sort || { seq: -1 };
  if (!spec.fields[sort.field]) throw new AiError(`Cannot sort by unknown field "${sort.field}".`, 400);
  return { [sort.field]: sort.direction === "asc" ? 1 : -1 };
}

async function runQuery(models, input) {
  const alias = input.collection;
  const spec = QUERYABLE[alias];
  if (!spec) throw new AiError(`Unknown collection "${alias}".`, 400);
  const Model = models[spec.model];
  if (!Model) throw new AiError(`Collection "${alias}" is not available.`, 400);

  const filter = buildFilter(spec, input.where);
  const sort = buildSort(spec, input.sort);
  const limit = Math.min(Math.max(parseInt(input.limit, 10) || 20, 1), MAX_LIMIT);

  // Only ever return whitelisted fields.
  const projection = { _id: 0, __v: 0 };
  const rows = await Model.find(filter, projection).sort(sort).limit(limit).lean();
  const cleaned = rows.map((r) => {
    const out = {};
    for (const f of Object.keys(spec.fields)) if (r[f] !== undefined) out[f] = r[f];
    if (r.orderNo !== undefined) out.orderNo = r.orderNo;
    return out;
  });
  return { alias, filter, count: cleaned.length, rows: cleaned };
}

const RUN_QUERY_TOOL = {
  name: "run_query",
  description:
    "Read records from one CRM collection. Returns up to 50 matching rows. " +
    "Use it to answer the user's question, then summarise the result in plain English.",
  input_schema: {
    type: "object",
    properties: {
      collection: { type: "string", enum: Object.keys(QUERYABLE) },
      where: {
        type: "array",
        description: "AND-combined filter clauses.",
        items: {
          type: "object",
          properties: {
            field: { type: "string" },
            op: { type: "string", enum: OPS },
            value: {},
          },
          required: ["field", "op", "value"],
        },
      },
      sort: {
        type: "object",
        properties: {
          field: { type: "string" },
          direction: { type: "string", enum: ["asc", "desc"] },
        },
      },
      limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT },
    },
    required: ["collection"],
  },
};

function schemaForPrompt() {
  return Object.entries(QUERYABLE)
    .map(([alias, spec]) => {
      const fields = Object.entries(spec.fields)
        .map(([f, t]) => `${f}:${t}`)
        .join(", ");
      return `- ${alias} — ${fields}`;
    })
    .join("\n");
}

const SYSTEM_PROMPT = `You are the reporting assistant inside a billing/CRM app for an Indian business.
Answer the user's question about their own data by calling the run_query tool, then replying in clear plain English.

Collections you can query (field:type):
${schemaForPrompt()}

Rules:
- "not paid" / "outstanding" invoices means status is not "Paid" (values seen: Paid, Partially Paid, Unpaid, Overdue) OR balance > 0.
- Money is in Indian Rupees — write amounts like ₹1,23,456.
- Dates: only createdAt is a real date; order/invoice "date" fields are display text, don't filter on them numerically. For "last 7 days" use where createdAt gte "7 days ago".
- Keep the answer to 1-3 short sentences of prose. Do NOT print a markdown table or a bulleted list of every row — the app shows the matching rows in its own table right below your answer. Mention the total count and, when useful, the headline number (e.g. total outstanding).
- If nothing matches, say so plainly. If the question can't be answered from these collections, say what's missing — do not guess.
- Never invent records, totals, or names that aren't in a tool result.`;

// Main entry. Returns { answer, executed: [{collection, count}], rows }.
async function answerQuestion(models, question) {
  const messages = [{ role: "user", content: String(question).slice(0, 1000) }];
  const executed = [];
  let lastRows = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await createMessage({
      system: SYSTEM_PROMPT,
      messages,
      tools: [RUN_QUERY_TOOL],
      max_tokens: 1200,
    });

    const toolUse = toolUseOf(response);
    if (response.stop_reason !== "tool_use" || !toolUse) {
      return { answer: textOf(response) || "I couldn't produce an answer.", executed, rows: lastRows };
    }

    messages.push({ role: "assistant", content: response.content });

    let result;
    try {
      const q = await runQuery(models, toolUse.input || {});
      executed.push({ collection: q.alias, count: q.count });
      lastRows = q.rows;
      result = JSON.stringify(q.rows.slice(0, MAX_ROWS_TO_MODEL));
      if (result.length > 9000) result = result.slice(0, 9000) + "…(truncated)";
    } catch (err) {
      result = `ERROR: ${err.message}`;
    }

    messages.push({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: toolUse.id, content: result }],
    });
  }

  // Ran out of rounds — ask for a final answer with no more tools.
  const final = await createMessage({ system: SYSTEM_PROMPT, messages, max_tokens: 1000 });
  return { answer: textOf(final) || "I couldn't produce an answer.", executed, rows: lastRows };
}

module.exports = { answerQuestion, QUERYABLE };
