// Thin wrapper around the Anthropic Messages API. Uses Node's global fetch
// (Node 18+) so no new dependency is added to the backend. The API key is
// read from the environment and never leaves the server.
//
//   ANTHROPIC_API_KEY   required — get one at https://console.anthropic.com
//   ANTHROPIC_MODEL     optional — defaults to a current Claude model
//
// Every AI route checks isConfigured() first and returns a friendly 503 if
// the key is missing, so the app keeps working with the feature simply off.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const API_VERSION = "2023-06-01";

function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// What a customer sees when the AI features aren't switched on. Deliberately
// says nothing about keys or servers — that is an operator's concern, and is
// logged below instead.
const AI_UNAVAILABLE_MESSAGE =
  "AI features are coming soon. We're getting them ready and they'll be available here shortly.";

let loggedMissingKey = false;
function noteMissingKey() {
  if (loggedMissingKey) return;
  loggedMissingKey = true;
  // eslint-disable-next-line no-console
  console.warn("[AI] ANTHROPIC_API_KEY is not set in backend/.env - AI features are off.");
}

// Raised for any AI-layer failure (missing key, upstream error, bad shape).
// server-side callers map this to a 502/503 with `.message` shown to the user.
class AiError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "AiError";
    this.status = status;
  }
}

// Low-level call. Returns the raw Anthropic response JSON.
//   { system, messages, tools?, tool_choice?, max_tokens?, temperature?, model? }
async function createMessage({
  system,
  messages,
  tools,
  tool_choice,
  max_tokens = 1024,
  temperature = 0.2,
  model = DEFAULT_MODEL,
}) {
  if (!isConfigured()) {
    noteMissingKey();
    throw new AiError(AI_UNAVAILABLE_MESSAGE, 503);
  }

  const body = { model, max_tokens, temperature, messages };
  if (system) body.system = system;
  if (tools) body.tools = tools;
  if (tool_choice) body.tool_choice = tool_choice;

  let res;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": API_VERSION,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new AiError(`Could not reach the AI service: ${err.message}`);
  }

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new AiError(`AI service returned an unreadable response (${res.status}).`);
  }

  if (!res.ok) {
    const detail = json?.error?.message || `${res.status} ${res.statusText}`;
    throw new AiError(`AI service error: ${detail}`, res.status === 429 ? 429 : 502);
  }

  return json;
}

// Concatenate all text blocks from a Messages API response.
function textOf(response) {
  return (response?.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

// First tool_use block in a response, or null.
function toolUseOf(response) {
  return (response?.content || []).find((b) => b.type === "tool_use") || null;
}

module.exports = { isConfigured, noteMissingKey, AI_UNAVAILABLE_MESSAGE, createMessage, textOf, toolUseOf, AiError, DEFAULT_MODEL };
