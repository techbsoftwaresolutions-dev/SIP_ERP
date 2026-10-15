import { Platform } from "react-native";
import * as Sharing from "expo-sharing";
import { sharePdf } from "../print/documents";

// Table exports for list/report screens — the phone equivalent of the web
// ExportButtons (CSV / PDF download): the file is written to the cache and
// handed to the share sheet (WhatsApp, email, Drive, Files…).

const cell = (col, row) => {
  const v = col.value ? col.value(row) : row[col.key];
  return v === undefined || v === null ? "" : String(v);
};

export function toCSV(columns, rows) {
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
  return [columns.map((c) => q(c.header || c.label)).join(","), ...rows.map((r) => columns.map((c) => q(cell(c, r))).join(","))].join("\n");
}

const safe = (name) => String(name || "export").replace(/[^\w.-]+/g, "-");

export async function shareCsv(columns, rows, filename) {
  const csv = toCSV(columns, rows);
  const name = `${safe(filename)}.csv`;
  if (Platform.OS === "web") {
    const blob = new Blob(["﻿", csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return;
  }
  const FS = require("expo-file-system/legacy");
  const uri = `${FS.cacheDirectory}${name}`;
  await FS.writeAsStringAsync(uri, "﻿" + csv, { encoding: FS.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "text/csv", dialogTitle: name, UTI: "public.comma-separated-values-text" });
}

const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function tableHtml({ title, subtitle, columns, rows, summary = [] }) {
  return `<!doctype html><html><head><meta charset="utf-8"/><style>
    body{font-family:-apple-system,Roboto,Arial,sans-serif;font-size:10px;color:#1f2937;padding:16px}
    h1{font-size:16px;margin:0} .sub{color:#6b7280;margin:2px 0 10px}
    .sum{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}.sum div{border:1px solid #e5e9ef;border-radius:6px;padding:6px 10px}
    .sum b{display:block;font-size:12px}
    table{width:100%;border-collapse:collapse} th{background:#f3f5f8;text-align:left} th,td{border:1px solid #d9dee5;padding:4px 5px}
  </style></head><body>
  <h1>${esc(title)}</h1><div class="sub">${esc(subtitle || `Generated ${new Date().toLocaleString("en-IN")}`)}</div>
  ${summary.length ? `<div class="sum">${summary.map(([k, v]) => `<div>${esc(k)}<b>${esc(v)}</b></div>`).join("")}</div>` : ""}
  <table><tr>${columns.map((c) => `<th>${esc(c.header || c.label)}</th>`).join("")}</tr>
  ${rows.length ? rows.map((r) => `<tr>${columns.map((c) => `<td>${esc(cell(c, r))}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${columns.length}">No rows.</td></tr>`}
  </table></body></html>`;
}

export function shareTablePdf(opts) {
  return sharePdf(tableHtml(opts), `${safe(opts.filename || opts.title)}.pdf`);
}
