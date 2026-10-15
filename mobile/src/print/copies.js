// How many copies a document prints with, and what each is called. Mirrors the web
// app (frontend/src/utils/docExport.js): Settings -> General sets the count per
// document and may rename the three copies. 1 copy is the ORIGINAL, 2 adds a
// DUPLICATE, 3 adds an OFFICE copy.
const DEFAULT_COPY_LABELS = ["ORIGINAL COPY", "DUPLICATE COPY", "OFFICE COPY"];

export function copyLabelList(settings) {
  return DEFAULT_COPY_LABELS.map((fallback, i) => {
    const custom = String((settings && settings[`copyLabel${i + 1}`]) || "").trim().slice(0, 30);
    return custom ? custom.toUpperCase() : fallback;
  });
}

// `key` is the settings field, e.g. "invoiceCopies". Anything that is not 1-3
// falls back to `fallback`.
export function copyLabelsFor(settings, key, fallback = 3) {
  const n = parseInt(settings && settings[key], 10);
  return copyLabelList(settings).slice(0, [1, 2, 3].includes(n) ? n : fallback);
}
