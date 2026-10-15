// Small helpers shared by every document's preview / print page (Invoice,
// Purchase Order, Delivery Challan, Quotation, Enquiry): how many copies to
// produce, and how to turn a document into a CSV file.
import { downloadBlob } from "./share";

export const COPY_CHOICES = [1, 2, 3];

// What each printed copy is called: 1 copy is the ORIGINAL; 2 adds a DUPLICATE;
// 3 adds an OFFICE copy. A business can rename any of the three in Settings ->
// General (copyLabel1..3); a blank field keeps the default. `defaults` lets a
// document keep its own wording (a delivery challan's statutory
// "Original - For Consignee" ...) until the business sets its own.
export const DEFAULT_COPY_LABELS = ["ORIGINAL COPY", "DUPLICATE COPY", "OFFICE COPY"];

export function copyLabelList(settings, defaults = DEFAULT_COPY_LABELS) {
  return defaults.map((fallback, i) => {
    const custom = String((settings && settings[`copyLabel${i + 1}`]) || "").trim().slice(0, 30);
    return custom ? custom.toUpperCase() : fallback;
  });
}

// The default number of copies for a document type, from Settings. Falls back
// to `fallback` when the setting is missing or isn't 1-3.
export function copyCount(settings, key, fallback = 1) {
  const n = parseInt(settings && settings[key], 10);
  return COPY_CHOICES.includes(n) ? n : fallback;
}

const cell = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const line = (cells) => cells.map(cell).join(",");

// A document as CSV: a title, its key/value details, the line items as a
// table, then the totals.
//   meta:    [[label, value], ...]
//   columns: [{ header, get: (item, index) => value }]
//   totals:  [[label, value], ...]
export function buildDocCsv({ title, meta = [], columns = [], items = [], totals = [] }) {
  const rows = [line([title]), ""];
  meta.forEach(([k, v]) => rows.push(line([k, v])));
  if (columns.length) {
    rows.push("");
    rows.push(line(columns.map((c) => c.header)));
    items.forEach((it, i) => rows.push(line(columns.map((c) => c.get(it, i)))));
  }
  if (totals.length) {
    rows.push("");
    totals.forEach(([k, v]) => rows.push(line([k, v])));
  }
  return rows.join("\r\n");
}

// The BOM makes Excel read the file as UTF-8, so ₹ and non-English names
// don't come out garbled.
export function downloadCsvText(text, filename) {
  downloadBlob(new Blob(["﻿", text], { type: "text/csv;charset=utf-8" }), filename);
}

export const escHtml = (v) =>
  String(v === null || v === undefined ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// Wraps document sections in the markup Word needs to open it as a normal
// A4 document, one section per copy with a page break between them.
export function buildWordDocument(title, sections) {
  const body = sections
    .map((html, i) => `<div class="Section1"${i > 0 ? ' style="page-break-before:always;"' : ""}>${html}</div>`)
    .join("");
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="utf-8">
    <title>${escHtml(title)}</title>
    <style>
      @page Section1 { size:21cm 29.7cm; mso-page-orientation:portrait; margin:1.4cm 1.3cm; }
      div.Section1 { page:Section1; }
      body { font-family:Arial, sans-serif; font-size:10pt; color:#1e1e1e; }
      table, td { mso-border-alt:solid #b4bec9 .5pt; }
    </style>
  </head>
  <body>${body}</body>
  </html>`;
}

export function downloadWord(html, filename) {
  downloadBlob(new Blob(["﻿", html], { type: "application/msword" }), filename);
}
