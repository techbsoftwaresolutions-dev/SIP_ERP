// Records store dates as "DD Mon YYYY" labels (e.g. "10 Oct 2026"); the date picker
// speaks YYYY-MM-DD. These convert between the two without any timezone shifts.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n) => String(n).padStart(2, "0");

// Today as YYYY-MM-DD, in the browser's own timezone.
export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// "10 Oct 2026" (or an already-ISO value) -> "2026-10-10"; "" if it cannot be read.
export function labelToIso(label) {
  const v = String(label || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const m = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/.exec(v);
  if (!m) return "";
  const month = MONTHS.findIndex((x) => x.toLowerCase() === m[2].toLowerCase());
  return month < 0 ? "" : `${m[3]}-${pad(month + 1)}-${pad(Number(m[1]))}`;
}

// Any stored date (a "10 Oct 2026" label or a YYYY-MM-DD value) as "10 Oct 2026";
// "—" when empty. For showing dates in lists.
export function prettyDate(value) {
  const v = String(value || "").trim();
  if (!v) return "—";
  const iso = labelToIso(v);
  if (!iso) return v;
  const [y, m, day] = iso.split("-");
  return `${day} ${MONTHS[Number(m) - 1]} ${y}`;
}
