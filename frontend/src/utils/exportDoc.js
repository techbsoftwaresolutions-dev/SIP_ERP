// Shared PDF / Word / Excel export helpers — builds simple tabular
// documents from the same column definitions a DataTable already uses,
// then triggers a browser download. No backend involved; works on
// whatever rows are passed in (never fabricated).
import { safeFileName } from "./share";

import jsPDF from "jspdf";

function exportableColumns(columns) {
  return columns.filter(
    (c) => c.key !== "actions" && c.key !== "__actions" && c.key !== "__print" && c.key !== "__view"
  );
}

function cellText(col, row) {
  if (col.exportValue) {
    const v = col.exportValue(row);
    return v === undefined || v === null ? "" : String(v);
  }
  // Use the on-screen `render` when it produces plain text (e.g. "₹6,000",
  // "18%", "20 Box") so exports read exactly like the table. A render that
  // returns markup (StatusBadge, links, …) is skipped for the raw value.
  if (typeof col.render === "function") {
    try {
      const v = col.render(row);
      if (typeof v === "string" || typeof v === "number") return String(v);
    } catch {
      /* fall through to the raw value */
    }
  }
  const raw = row[col.key];
  return raw === undefined || raw === null ? "" : String(raw);
}

// A value that reads as a number / currency / percentage (e.g. "₹1,200",
// "18%", "-5", "1,234.56") — used to right-align those columns so exports
// line up the way a report should, the same in PDF, Word and Excel.
const NUMERIC_CELL_RE = /^-?\s*[₹$€£]?\s*-?[\d,]+(\.\d+)?\s*%?$/;

// A column is numeric when (nearly) every non-blank cell in it looks numeric —
// decided per column, not per cell, so a whole column aligns consistently.
function columnAligns(cols, rows) {
  return cols.map((col) => {
    if (col.align === "right" || col.align === "left") return col.align;
    let seen = 0;
    let numeric = 0;
    for (const row of rows) {
      const t = cellText(col, row).trim();
      if (!t || t === "—" || t === "-") continue;
      seen += 1;
      if (NUMERIC_CELL_RE.test(t)) numeric += 1;
    }
    return seen > 0 && numeric / seen >= 0.8 ? "right" : "left";
  });
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeFileName(filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// jsPDF's built-in Helvetica is WinAnsi-encoded and has no ₹ glyph (it prints
// as a stray "1"), nor real em-dashes / smart quotes. Swap those for ASCII the
// standard font can actually render.
function pdfSafe(s) {
  return String(s)
    .replace(/₹/g, "Rs ")
    .replace(/[‒–—―]/g, "-")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/…/g, "...")
    .replace(/ /g, " ");
}

// Builds the tabular PDF and returns the jsPDF instance (so the same layout
// can be either downloaded or handed to the share sheet as a Blob).
function buildPDFTableDoc(columns, rows, title) {
  const cols = exportableColumns(columns);
  const aligns = columnAligns(cols, rows);
  const wide = cols.length > 6;
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: wide ? "landscape" : "portrait" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 32;
  const tableWidth = pageWidth - margin * 2;
  const fontSize = cols.length > 9 ? 6.5 : cols.length > 6 ? 7.5 : 8.5;
  const lineH = fontSize + 3;
  const pad = 4;
  const bottomLimit = pageHeight - margin;

  // ---- Column widths, proportional to actual content ----
  // Measure the header and a sample of cells per column: `wants` is the
  // width that would fit the longest whole value, `needs` the width of just
  // the longest single word (so headers/values don't get chopped mid-word).
  // Clamp each column between its `needs` and a max, then scale the set to
  // exactly fill the table width. This is what stops long addresses / big
  // amounts from bleeding into the next column the way equal widths did.
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(fontSize);
  const sample = rows.slice(0, 60);
  const longestWordW = (txt) => {
    let mx = 0;
    for (const w of pdfSafe(txt).split(/\s+/)) {
      const ww = pdf.getTextWidth(w);
      if (ww > mx) mx = ww;
    }
    return mx;
  };
  const maxW = tableWidth * (wide ? 0.24 : 0.34);
  const wants = [];
  const needs = [];
  cols.forEach((c, i) => {
    let full = pdf.getTextWidth(pdfSafe(String(c.header)));
    let word = longestWordW(String(c.header));
    for (const row of sample) {
      const t = cellText(c, row);
      const fw = pdf.getTextWidth(pdfSafe(t));
      if (fw > full) full = fw;
      const ww = longestWordW(t);
      if (ww > word) word = ww;
    }
    wants[i] = full + pad * 2;
    needs[i] = Math.min(maxW, word + pad * 2);
  });
  // Every column keeps at least its `needs` width (so whole words never get
  // chopped); the leftover page width is then shared out in proportion to how
  // much *more* each column would still like, up to its `wants`.
  const needsSum = needs.reduce((a, b) => a + b, 0);
  let colW;
  if (needsSum >= tableWidth) {
    const s = tableWidth / needsSum;
    colW = needs.map((n) => n * s);
  } else {
    const extra = tableWidth - needsSum;
    const slack = wants.map((w, i) => Math.max(0, Math.min(maxW, w) - needs[i]));
    const slackSum = slack.reduce((a, b) => a + b, 0) || 1;
    colW = needs.map((n, i) => n + (extra * slack[i]) / slackSum);
  }
  const colX = [];
  let xCursor = margin;
  for (let i = 0; i < cols.length; i += 1) {
    colX[i] = xCursor;
    xCursor += colW[i];
  }

  let y = margin;

  // Wrap every cell of a row, return the wrapped lines and the row's height.
  // Font must be set to the body size here — splitTextToSize measures at the
  // current font size, and the title/other calls leave it at something else.
  const layoutRow = (getText) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(fontSize);
    const cellLines = cols.map((c, i) => pdf.splitTextToSize(pdfSafe(getText(c, i)) || "", colW[i] - pad * 2));
    const maxLines = Math.max(1, ...cellLines.map((l) => l.length));
    return { cellLines, rowH: maxLines * lineH + pad * 2 };
  };

  const drawRow = (cellLines, rowH, header) => {
    if (header) {
      pdf.setFillColor(234, 241, 251);
      pdf.rect(margin, y, tableWidth, rowH, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(20, 40, 70);
      pdf.setDrawColor(180, 190, 205);
    } else {
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(30, 30, 30);
      pdf.setDrawColor(225, 228, 233);
    }
    pdf.setFontSize(fontSize);
    pdf.rect(margin, y, tableWidth, rowH); // row border
    cols.forEach((c, i) => {
      if (i > 0) pdf.line(colX[i], y, colX[i], y + rowH); // column separator
      const lines = cellLines[i] || [];
      lines.forEach((ln, li) => {
        const ty = y + pad + li * lineH + fontSize;
        if (aligns[i] === "right") {
          pdf.text(ln, colX[i] + colW[i] - pad, ty, { align: "right" });
        } else {
          pdf.text(ln, colX[i] + pad, ty);
        }
      });
    });
    y += rowH;
  };

  // Title
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(20, 40, 70);
  pdf.text(pdfSafe(title), margin, y + 4);
  y += 26;

  const header = layoutRow((c) => String(c.header));
  drawRow(header.cellLines, header.rowH, true);

  if (rows.length === 0) {
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(fontSize);
    pdf.setTextColor(90, 90, 90);
    pdf.text("No records found.", margin + pad, y + pad + fontSize);
    return pdf;
  }

  rows.forEach((row) => {
    const { cellLines, rowH } = layoutRow((c) => cellText(c, row));
    if (y + rowH > bottomLimit) {
      pdf.addPage();
      y = margin;
      drawRow(header.cellLines, header.rowH, true);
    }
    drawRow(cellLines, rowH, false);
  });

  return pdf;
}

export function downloadPDFTable(columns, rows, title, filename) {
  buildPDFTableDoc(columns, rows, title).save(safeFileName(filename));
}

// Same PDF as downloadPDFTable, but as a Blob for sharing.
export function pdfTableBlob(columns, rows, title) {
  return buildPDFTableDoc(columns, rows, title).output("blob");
}

// Shares the tabular report as a PDF over WhatsApp or Email. Prefers the
// native share sheet with the real file attached (mobile + recent desktop
// Chrome/Edge); otherwise downloads the PDF and opens the target app
// pre-filled with a text summary so the user only attaches the file.
export async function shareTable({ columns, rows, title, filename, text, channel }) {
  const blob = pdfTableBlob(columns, rows, title);
  const file = new File([blob], filename, { type: "application/pdf" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return { shared: true };
    } catch (err) {
      if (err && err.name === "AbortError") return { shared: false, cancelled: true };
      // fall through to the manual path
    }
  }

  triggerDownload(blob, filename);
  const note = `${text}\n\n(PDF "${filename}" was downloaded to your device — please attach it to this message.)`;
  if (channel === "whatsapp") {
    window.open(`https://wa.me/?text=${encodeURIComponent(note)}`, "_blank", "noopener");
  } else if (channel === "email") {
    window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(note)}`;
  }
  return { shared: false, downloaded: true };
}

// Standard 3-copy delivery challan print set — same row of data repeated
// across 3 pages, each labeled for who that copy is for, matching how DCs
// are physically printed and distributed in triplicate.
const DC_COPY_LABELS = [
  "Original — For Consignee",
  "Duplicate — For Transporter",
  "Triplicate — For Consignor",
];

export function downloadDeliveryChallanCopies(columns, row, title, filename) {
  const cols = exportableColumns(columns);
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: cols.length > 6 ? "landscape" : "portrait" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 32;
  const colWidth = (pageWidth - margin * 2) / cols.length;
  const rowHeight = 20;

  DC_COPY_LABELS.forEach((label, idx) => {
    let y = margin;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(20, 40, 70);
    pdf.text(pdfSafe(title), margin, y);
    y += 20;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(90, 90, 90);
    pdf.text(pdfSafe(label), margin, y);
    y += 20;

    pdf.setFillColor(234, 241, 251);
    pdf.rect(margin, y, pageWidth - margin * 2, rowHeight, "F");
    pdf.setDrawColor(180, 190, 205);
    pdf.rect(margin, y, pageWidth - margin * 2, rowHeight);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(20, 40, 70);
    cols.forEach((c, i) => {
      pdf.text(pdfSafe(String(c.header)), margin + i * colWidth + 5, y + rowHeight - 7, { maxWidth: colWidth - 8 });
    });
    y += rowHeight;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(30, 30, 30);
    pdf.setDrawColor(225, 228, 233);
    pdf.rect(margin, y, pageWidth - margin * 2, rowHeight);
    cols.forEach((c, i) => {
      pdf.text(pdfSafe(cellText(c, row)), margin + i * colWidth + 5, y + rowHeight - 7, { maxWidth: colWidth - 8 });
    });

    if (idx < DC_COPY_LABELS.length - 1) pdf.addPage();
  });

  pdf.save(safeFileName(filename));
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// One HTML table styled to match the PDF export — same header shading,
// borders and per-column alignment — reused for both Word and Excel.
function buildHtmlTable(columns, rows, fontPx) {
  const cols = exportableColumns(columns);
  const aligns = columnAligns(cols, rows);
  const colWidthPct = (100 / cols.length).toFixed(2);

  const colGroup = cols.map(() => `<col style="width:${colWidthPct}%">`).join("");

  const headerCells = cols
    .map(
      (c, i) =>
        `<th style="border:1px solid #b4bec9;padding:6px 9px;background:#eaf1fb;color:#14283f;` +
        `font-weight:bold;text-align:${aligns[i]};vertical-align:middle;">${escapeHtml(c.header)}</th>`
    )
    .join("");

  const bodyRows = rows
    .map(
      (row) =>
        `<tr>${cols
          .map(
            (c, i) =>
              `<td style="border:1px solid #e1e4e9;padding:5px 9px;color:#1e1e1e;` +
              `text-align:${aligns[i]};vertical-align:middle;">${escapeHtml(cellText(c, row))}</td>`
          )
          .join("")}</tr>`
    )
    .join("");

  const emptyRow =
    rows.length === 0
      ? `<tr><td colspan="${cols.length}" style="border:1px solid #e1e4e9;padding:10px;` +
        `text-align:center;font-style:italic;color:#666;">No records found.</td></tr>`
      : "";

  return `
    <table style="border-collapse:collapse;width:100%;table-layout:fixed;` +
    `font-family:Arial, sans-serif;font-size:${fontPx}px;">
      <colgroup>${colGroup}</colgroup>
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows}${emptyRow}</tbody>
    </table>`;
}

export function downloadWordTable(columns, rows, title, filename) {
  const wide = exportableColumns(columns).length > 6;
  const table = buildHtmlTable(columns, rows, wide ? 8.5 : 11);
  // A4, landscape once the table gets wide — same rule the PDF uses — so
  // columns get room to breathe instead of wrapping into unreadable stacks.
  const pageSize = wide ? "29.7cm 21cm" : "21cm 29.7cm";
  const orientation = wide ? "landscape" : "portrait";
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>${escapeHtml(title)}</title>
      <style>
        @page Section1 { size:${pageSize}; mso-page-orientation:${orientation}; margin:1.5cm 1.4cm; }
        div.Section1 { page:Section1; }
        body { font-family:Arial, sans-serif; color:#1e1e1e; }
        h2 { font-family:Arial, sans-serif; color:#14283f; font-size:15pt; margin:0 0 10pt; }
        .gen { color:#6b7280; font-size:9pt; margin:0 0 14pt; }
        table, td, th { mso-border-alt:solid #b4bec9 .5pt; }
      </style>
    </head>
    <body>
      <div class="Section1">
        <h2>${escapeHtml(title)}</h2>
        <p class="gen">Generated ${new Date().toLocaleString("en-IN")}</p>
        ${table}
      </div>
    </body>
    </html>`;
  triggerDownload(new Blob(["﻿", html], { type: "application/msword" }), filename);
}

// Strip a display string ("₹1,26,897.20", "Rs. 500", "18%", "1,250") down to
// a bare JS number, or null when it isn't really numeric.
function toBareNumber(s) {
  const t = String(s)
    .trim()
    .replace(/rs\.?/gi, "")
    .replace(/[₹$€£,\s]/g, "")
    .replace(/%$/, "");
  if (!t || t === "—" || t === "-") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const CODE_HEADER_RE = /hsn|sac|gstin|gst\s*no|\bphone\b|mobile|pin\s*code|pincode|ifsc|account\s*no|\bcode\b/i;

// A proper spreadsheet: numeric columns become real numbers (sortable /
// summable / right-aligned by Excel), percentages stay percentages, and
// digit-string codes (HSN, phone, GSTIN, pincode) are forced to text so
// Excel doesn't reformat or turn them into 3.92E+07.
function buildExcelSheet(columns, rows) {
  const cols = exportableColumns(columns);
  const aligns = columnAligns(cols, rows);

  const kinds = cols.map((col, i) => {
    if (CODE_HEADER_RE.test(String(col.header))) return "text";
    if (aligns[i] !== "right") return "text";
    let seen = 0;
    let pct = 0;
    let allInt = true;
    for (const row of rows) {
      const raw = cellText(col, row).trim();
      if (!raw || raw === "—" || raw === "-") continue;
      seen += 1;
      if (/%\s*$/.test(raw)) pct += 1;
      const n = toBareNumber(raw);
      if (n === null || !Number.isInteger(n) || String(Math.abs(n)).length < 7) allInt = false;
    }
    if (seen === 0) return "text";
    if (pct / seen >= 0.6) return "percent";
    if (allInt) return "text"; // long all-integer column ⇒ a code, keep as text
    return "number";
  });

  const widthPx = cols.map((col) => {
    let mx = String(col.header).length;
    for (const row of rows) mx = Math.max(mx, cellText(col, row).length);
    return Math.min(340, Math.max(56, Math.round(mx * 6.7) + 18));
  });

  const B = "border:.5pt solid #b4bec9;";
  const headRow = `<tr>${cols
    .map(
      (col, i) =>
        `<td style="${B}background:#dbe6f5;font-weight:bold;color:#14283f;text-align:${aligns[i]};` +
        `mso-number-format:'\\@';padding:4px 6px;">${escapeHtml(col.header)}</td>`
    )
    .join("")}</tr>`;

  const bodyRows = rows
    .map(
      (row) =>
        `<tr>${cols
          .map((col, i) => {
            const raw = cellText(col, row);
            if (kinds[i] === "number") {
              const n = toBareNumber(raw);
              if (n !== null) {
                return `<td style="${B}text-align:right;mso-number-format:'\\#\\,\\#\\#0.00';padding:4px 6px;">${n}</td>`;
              }
            }
            if (kinds[i] === "percent") {
              const n = toBareNumber(raw);
              if (n !== null) {
                return `<td style="${B}text-align:right;mso-number-format:'0.0%';padding:4px 6px;">${n / 100}</td>`;
              }
            }
            const alignCss = kinds[i] === "text" ? "left" : aligns[i];
            return `<td style="${B}text-align:${alignCss};mso-number-format:'\\@';padding:4px 6px;">${escapeHtml(raw)}</td>`;
          })
          .join("")}</tr>`
    )
    .join("");

  const emptyRow =
    rows.length === 0
      ? `<tr><td colspan="${cols.length}" style="${B}text-align:center;font-style:italic;color:#666;padding:8px;">No records found.</td></tr>`
      : "";

  return `<table border="0" cellspacing="0" style="border-collapse:collapse;font-family:Calibri, Arial, sans-serif;font-size:11pt;">
      <colgroup>${widthPx.map((w) => `<col width="${w}">`).join("")}</colgroup>
      ${headRow}${bodyRows}${emptyRow}
    </table>`;
}

export function downloadExcelTable(columns, rows, title, filename) {
  const nCols = exportableColumns(columns).length;
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8">
      <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
      <x:Name>${escapeHtml(title).replace(/[\\/?*[\]:]/g, " ").slice(0, 31)}</x:Name>
      <x:WorksheetOptions><x:FreezePanes/><x:SplitHorizontal>2</x:SplitHorizontal><x:TopRowBottomPane>2</x:TopRowBottomPane>
      <x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
    </head>
    <body>
      <table border="0" cellspacing="0"><tr><td colspan="${nCols}" style="font-family:Calibri, Arial, sans-serif;font-size:14pt;font-weight:bold;color:#14283f;mso-number-format:'\\@';">${escapeHtml(title)}</td></tr></table>
      ${buildExcelSheet(columns, rows)}
    </body>
    </html>`;
  triggerDownload(new Blob(["﻿", html], { type: "application/vnd.ms-excel" }), filename);
}
