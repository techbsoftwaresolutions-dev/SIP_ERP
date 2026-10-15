// Plain-hex colour maths for the invoice layouts.
//
// The layouts used CSS color-mix() for their tints. Chrome reports those colours
// back as color(srgb ...), which html2canvas (used for the PDF / WhatsApp / Email
// share) cannot read, so sharing failed with "unsupported color function".
// Computing the tints here and handing the sheet ordinary #rrggbb values keeps
// the same look and makes every export work.

function parseHex(hex) {
  let h = String(hex || "").trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const toHex = (rgb) => "#" + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

// pctA percent of colour a plus the rest of colour b; returns `fallback` if either
// is not a hex colour.
export function mixHex(a, b, pctA, fallback) {
  const x = parseHex(a);
  const y = parseHex(b);
  if (!x || !y) return fallback;
  const t = pctA / 100;
  return toHex(x.map((v, i) => v * t + y[i] * (1 - t)));
}

// Every accent-derived colour a themed invoice sheet needs, as CSS custom
// properties for the sheet's inline style.
export function invoiceAccentVars(accent) {
  const base = parseHex(accent) ? accent : "#2f4a7d";
  return {
    "--inv-accent": base,
    "--inv-soft": mixHex(base, "#ffffff", 8, "#eef1f5"),
    "--inv-line": mixHex(base, "#ffffff", 28, "#c5ccdb"),
    "--inv-copy": mixHex("#ffffff", base, 76, "#cdd4e0"),
    "--inv-rail": mixHex(base, "#000000", 70, "#213458"),
  };
}
