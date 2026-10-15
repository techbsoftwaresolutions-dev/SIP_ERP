// Converts a rupee amount into words using the Indian numbering system
// (Lakh/Crore), e.g. 105339.78 -> "One Lakh Five Thousand Three Hundred
// Thirty Nine Rupees and Seventy Eight Paise Only". Computed live from the
// invoice amount — never a hardcoded string.
const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${TENS[t]}${o ? " " + ONES[o] : ""}`;
}

function threeDigits(n) {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  let out = h ? `${ONES[h]} Hundred` : "";
  if (rest) out += `${out ? " " : ""}${twoDigits(rest)}`;
  return out;
}

function integerToWords(num) {
  if (num === 0) return "Zero";
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const hundred = num;

  const parts = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));
  return parts.join(" ");
}

export function amountInWords(value) {
  const n = Number(value) || 0;
  const rupees = Math.floor(n);
  const paise = Math.round((n - rupees) * 100);
  let out = `${integerToWords(rupees)} Rupees`;
  if (paise) out += ` and ${integerToWords(paise)} Paise`;
  return `${out} Only`;
}
