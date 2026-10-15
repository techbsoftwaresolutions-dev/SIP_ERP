// GSTIN checks and (optional) address lookup for the Customer / Supplier forms.
//
// There is no free, official GST-portal API: the government site is behind a
// captcha, and the licensed feed is sold through GST Suvidha Providers. So this
// works in two layers:
//   1. Always on, offline: validate the GSTIN (format + check digit) and read
//      its state code and PAN. The forms use this to fill the State instantly.
//   2. Optional, when the operator configures a provider: fetch the registered
//      address, legal/trade name and pincode. Configure with two env vars:
//        GST_LOOKUP_URL   e.g. https://provider.example/gst?gstNo={gstin}&key={key}
//        GST_LOOKUP_KEY   the provider's API key (substituted for {key})
//      and, if the provider wants the key in a header instead of the URL:
//        GST_LOOKUP_KEY_HEADER   e.g. x-api-key
//   Any provider that returns the standard GSTN taxpayer record (lgnm, tradeNam,
//   pradr.addr.{bno,bnm,st,loc,dst,stcd,pncd}) works unchanged.

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function normaliseGstin(value) {
  return String(value || "").trim().toUpperCase();
}

// The 15th character is a check digit over the first 14 (mod-36 weighted sum).
function checkDigit(first14) {
  let sum = 0;
  for (let i = 0; i < 14; i += 1) {
    const value = CHARSET.indexOf(first14[i]);
    if (value < 0) return "";
    const product = value * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHARSET[(36 - (sum % 36)) % 36];
}

function isValidGstin(gstin) {
  const g = normaliseGstin(gstin);
  return GSTIN_PATTERN.test(g) && checkDigit(g.slice(0, 14)) === g[14];
}

function lookupConfigured() {
  return Boolean(process.env.GST_LOOKUP_URL);
}

const text = (v) => (v === undefined || v === null ? "" : String(v).trim());

// Provider responses wrap the taxpayer record differently (taxpayerInfo, data,
// or bare) — find it, then read the standard GSTN field names from it.
function normaliseTaxpayer(raw) {
  if (!raw || typeof raw !== "object") return null;
  const tp =
    (raw.taxpayerInfo && typeof raw.taxpayerInfo === "object" && raw.taxpayerInfo) ||
    (raw.data && raw.data.taxpayerInfo) ||
    (raw.data && typeof raw.data === "object" && !Array.isArray(raw.data) && raw.data) ||
    raw;
  const legalName = text(tp.lgnm || tp.legalName || tp.legal_name);
  const tradeName = text(tp.tradeNam || tp.tradeName || tp.trade_name);
  if (!legalName && !tradeName) return null;

  const pradr = tp.pradr || tp.principalAddress || {};
  const addr = pradr.addr && typeof pradr.addr === "object" ? pradr.addr : typeof pradr === "object" ? pradr : {};
  const parts = [addr.bno, addr.flno, addr.bnm, addr.st, addr.loc]
    .map(text)
    .filter(Boolean)
    .filter((p, i, all) => all.indexOf(p) === i);
  let address = parts.join(", ");
  // Some providers only give the single formatted line.
  if (!address) address = text(pradr.adr || tp.address || (typeof pradr === "string" ? pradr : ""));

  return {
    name: legalName,
    tradeName,
    address,
    city: text(addr.dst || addr.city || addr.loc),
    state: text(addr.stcd || addr.state),
    pincode: text(addr.pncd || addr.pincode).replace(/\D/g, "").slice(0, 6),
    status: text(tp.sts || tp.status),
  };
}

async function fetchTaxpayer(gstin) {
  const key = process.env.GST_LOOKUP_KEY || "";
  const url = process.env.GST_LOOKUP_URL.replace("{gstin}", encodeURIComponent(gstin)).replace("{key}", encodeURIComponent(key));
  const headers = { Accept: "application/json" };
  if (process.env.GST_LOOKUP_KEY_HEADER && key) headers[process.env.GST_LOOKUP_KEY_HEADER] = key;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) return { error: `The GST service answered ${res.status}.` };
    return { taxpayer: normaliseTaxpayer(await res.json()) };
  } catch (err) {
    return { error: err.name === "AbortError" ? "The GST service took too long to answer." : "Could not reach the GST service." };
  } finally {
    clearTimeout(timer);
  }
}

// What the forms receive. Never throws — a lookup problem must not block
// someone from simply typing the address in.
async function lookupGstin(rawGstin) {
  const gstin = normaliseGstin(rawGstin);
  const out = { gstin, valid: false, configured: lookupConfigured(), found: false };
  if (!GSTIN_PATTERN.test(gstin)) return { ...out, message: "That is not a valid GST number format." };
  out.valid = checkDigit(gstin.slice(0, 14)) === gstin[14];
  out.stateCode = gstin.slice(0, 2);
  out.pan = gstin.slice(2, 12);
  if (!out.valid) return { ...out, message: "This GST number's check digit does not match — please re-check it." };
  if (!out.configured) return out;
  const { taxpayer, error } = await fetchTaxpayer(gstin);
  if (error) return { ...out, message: error };
  if (!taxpayer) return { ...out, message: "No registered details were found for this GST number." };
  return { ...out, found: true, ...taxpayer };
}

module.exports = { lookupGstin, isValidGstin, normaliseTaxpayer, lookupConfigured };
