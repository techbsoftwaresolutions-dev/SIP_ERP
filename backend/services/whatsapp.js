// WhatsApp Business Cloud API (Meta) — sends a document (invoice, PO, challan…)
// to a customer or supplier's WhatsApp number.
//
// How it works
//   1. The browser renders the document to a PDF (same PDF as "Download").
//   2. This module uploads that PDF to Meta (POST /{phone-number-id}/media)
//      and gets a media id back.
//   3. It sends an approved TEMPLATE message with the PDF as its header
//      (POST /{phone-number-id}/messages). A template is required because a
//      business may only message someone first with a pre-approved template;
//      free-form messages work only inside 24 hours of the customer writing.
//
// Every client uses their OWN WhatsApp Business account: phone number id,
// access token and template name are stored in that client's Settings.
//
// Nothing here throws for an expected failure (bad number, rejected token,
// unapproved template) — callers get { ok: false, error } with Meta's own
// wording, so the screen can tell the user what to fix.

const GRAPH_URL = (process.env.WHATSAPP_GRAPH_URL || "https://graph.facebook.com/v21.0").replace(/\/+$/, "");
const TIMEOUT_MS = 25000;

// What the template's four body variables receive, in order. The template a
// client creates in Meta must use exactly these four ({{1}}…{{4}}).
const TEMPLATE_BODY_HELP =
  "Hello {{1}}, please find your {{2}} for {{3}} attached. Thank you, {{4}}.";

function waConfigured(settings) {
  return Boolean(
    settings &&
      settings.waStatus === "Enabled" &&
      String(settings.waPhoneNumberId || "").trim() &&
      String(settings.waAccessToken || "").trim() &&
      String(settings.waTemplateName || "").trim()
  );
}

// Digits only, with country code. A bare 10-digit Indian mobile gets 91; a
// leading 0 or 00 is dropped. Returns "" when it cannot be a real number.
function normalizePhone(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  d = d.replace(/^00/, "");
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = `91${d}`;
  return d.length >= 11 && d.length <= 15 ? d : "";
}

function maskPhone(digits) {
  const d = String(digits || "");
  return d.length > 4 ? `${"•".repeat(d.length - 4)}${d.slice(-4)}` : d;
}

async function graph(path, { token, method = "GET", json, form }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${GRAPH_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(json ? { "Content-Type": "application/json" } : {}),
      },
      body: form || (json ? JSON.stringify(json) : undefined),
    });
    let body = null;
    try {
      body = await res.json();
    } catch (_) {
      // non-JSON error page
    }
    if (!res.ok) {
      const e = (body && body.error) || {};
      return {
        ok: false,
        status: res.status,
        error: e.error_user_msg || e.message || `WhatsApp responded with HTTP ${res.status}.`,
        code: e.code,
      };
    }
    return { ok: true, body };
  } catch (err) {
    return {
      ok: false,
      error: err && err.name === "AbortError" ? "WhatsApp took too long to respond. Please try again." : `Could not reach WhatsApp: ${err.message}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

// Checks the credentials by reading the phone number's own record. Cheap, and
// sends nothing to anybody.
async function verifyConnection(settings) {
  const id = String(settings.waPhoneNumberId || "").trim();
  const token = String(settings.waAccessToken || "").trim();
  if (!id || !token) return { ok: false, error: "Enter the Phone Number ID and the Access Token first." };
  const r = await graph(`/${encodeURIComponent(id)}?fields=display_phone_number,verified_name,quality_rating`, { token });
  if (!r.ok) return r;
  return {
    ok: true,
    displayPhoneNumber: r.body.display_phone_number || "",
    verifiedName: r.body.verified_name || "",
    quality: r.body.quality_rating || "",
  };
}

async function uploadPdf(settings, buffer, filename) {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", "application/pdf");
  form.append("file", new Blob([buffer], { type: "application/pdf" }), filename);
  const r = await graph(`/${encodeURIComponent(String(settings.waPhoneNumberId).trim())}/media`, {
    token: String(settings.waAccessToken).trim(),
    method: "POST",
    form,
  });
  if (!r.ok) return r;
  return { ok: true, mediaId: r.body && r.body.id };
}

// Sends `pdf` to `to` using the client's template. `params` fills the four
// template variables; each is trimmed because Meta rejects empty/very long ones.
async function sendDocument(settings, { to, pdf, filename, params }) {
  const phone = normalizePhone(to);
  if (!phone) return { ok: false, error: "That doesn't look like a valid WhatsApp number. Include the country code, e.g. 919876543210." };

  const up = await uploadPdf(settings, pdf, filename);
  if (!up.ok) return { ok: false, error: `Could not upload the document: ${up.error}` };

  const clean = (v) => String(v == null || v === "" ? "-" : v).replace(/[\r\n\t]+/g, " ").trim().slice(0, 200) || "-";
  const r = await graph(`/${encodeURIComponent(String(settings.waPhoneNumberId).trim())}/messages`, {
    token: String(settings.waAccessToken).trim(),
    method: "POST",
    json: {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: String(settings.waTemplateName).trim(),
        language: { code: String(settings.waTemplateLang || "en").trim() },
        components: [
          { type: "header", parameters: [{ type: "document", document: { id: up.mediaId, filename } }] },
          { type: "body", parameters: (params || []).slice(0, 4).map((text) => ({ type: "text", text: clean(text) })) },
        ],
      },
    },
  });
  if (!r.ok) return r;
  const message = r.body && r.body.messages && r.body.messages[0];
  return { ok: true, messageId: (message && message.id) || "", to: phone };
}

module.exports = { waConfigured, normalizePhone, maskPhone, verifyConnection, sendDocument, TEMPLATE_BODY_HELP, GRAPH_URL };
