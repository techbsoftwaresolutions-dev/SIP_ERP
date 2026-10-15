// Prefixes a stored mobile number with its country code for display on
// printed documents and detail views — e.g. "9899904089" -> "+91 9899904089".
// Only touches values that look like a plain 10-digit Indian mobile number;
// anything else (already has a country code, a landline with an STD code,
// blank) is left exactly as-is rather than being mangled.
export function formatPhone(phone) {
  if (!phone) return phone;
  const digits = String(phone).trim();
  return /^\d{10}$/.test(digits) ? `+91 ${digits}` : digits;
}
