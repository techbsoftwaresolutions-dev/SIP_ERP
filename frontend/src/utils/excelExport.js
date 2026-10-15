import XLSXStyle from "xlsx-js-style";
import { downloadBlob } from "./share";
import { formatPhone } from "./formatPhone";
import { amountInWords } from "./numberToWords";
import { getStateCode } from "./gstStateCodes";
import { taxSplit, shippingLines } from "../print/invoiceCalc";

const XLSX = XLSXStyle?.utils ? XLSXStyle : (XLSXStyle?.default || XLSXStyle);

// Helper to download an XLSX workbook
export function downloadWorkbook(workbook, filename) {
  const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const cleanName = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  downloadBlob(blob, cleanName);
}

// Styling Constants
const FONT_FAMILY = "Calibri";
const COLOR_DARK_NAVY = "1E293B";
const COLOR_SLATE_HEADER = "F1F5F9";
const COLOR_TABLE_HEADER = "E2E8F0";
const COLOR_LIGHT_ZEBRA = "F8FAFC";
const COLOR_ACCENT_BLUE = "E0F2FE";
const COLOR_BALANCE_TEXT = "0369A1";
const COLOR_BORDER = "CBD5E1";
const COLOR_MUTED_TEXT = "475569";
const COLOR_DARK_TEXT = "0F172A";
const COLOR_WHITE = "FFFFFF";

const BORDER_THIN = {
  top: { style: "thin", color: { rgb: COLOR_BORDER } },
  bottom: { style: "thin", color: { rgb: COLOR_BORDER } },
  left: { style: "thin", color: { rgb: COLOR_BORDER } },
  right: { style: "thin", color: { rgb: COLOR_BORDER } },
};

function setCell(ws, r, c, val, type = "s", style = {}) {
  const addr = XLSX.utils.encode_cell({ r, c });
  ws[addr] = { v: val, t: type, s: style };
}

// Merges a range and applies borders across the entire perimeter so Excel doesn't drop edges
function mergeRange(ws, merges, r1, c1, r2, c2, style = {}) {
  merges.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) {
        ws[addr] = { v: "", t: "s", s: style };
      } else {
        ws[addr].s = { ...style, ...ws[addr].s };
      }
    }
  }
}

// Safely format text so Excel doesn't turn 10-digit numbers into scientific notation (e.g. 9.6E+09)
// and doesn't turn dates into ######## in narrow columns
export function escapeCsvText(val) {
  if (val === null || val === undefined) return "";
  const str = String(val).trim();
  if (!str) return "";
  // If value is purely numeric and 7+ digits (phone, account no, PIN), wrap as ="..."
  if (/^\+?\d{7,}$/.test(str)) {
    return `="${str}"`;
  }
  // If value looks like a date (e.g. "15 Oct 2026", "2026-10-15", "15/10/2026"), wrap as ="..." so Excel strictly treats as text string
  if (
    /^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$/.test(str) ||
    /^\d{4}-\d{2}-\d{2}$/.test(str) ||
    /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(str)
  ) {
    return `="${str}"`;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Builds and downloads a professional, multi-tab or single-tab Excel workbook for an Invoice.
 */
export function exportInvoiceExcel({
  invoice,
  customer,
  settings = {},
  intraState = true,
  copyLabels = ["ORIGINAL COPY"],
}) {
  if (!invoice) return;

  const wb = XLSX.utils.book_new();
  const split = taxSplit(invoice, intraState);
  const items = invoice.items || [];
  const stateCode = getStateCode(invoice.placeOfSupply || customer?.state || "");
  const shipping = shippingLines(invoice, customer);
  const shipText = shipping.freeform || [shipping.line1, shipping.line2].filter(Boolean).join(", ");
  const co = settings || {};

  copyLabels.forEach((copyLabel) => {
    const ws = {};
    const merges = [];
    let curRow = 0;

    // 1. Company Brand Header
    setCell(ws, curRow, 0, (co.companyName || "Your Company").toUpperCase(), "s", {
      font: { name: FONT_FAMILY, sz: 16, bold: true, color: { rgb: COLOR_DARK_TEXT } },
      alignment: { horizontal: "left", vertical: "center" },
    });
    mergeRange(ws, merges, curRow, 0, curRow, 7);
    curRow++;

    const contactLine1 = [co.legalName, co.address].filter(Boolean).join("  |  ");
    if (contactLine1) {
      setCell(ws, curRow, 0, contactLine1, "s", {
        font: { name: FONT_FAMILY, sz: 10, color: { rgb: COLOR_MUTED_TEXT } },
        alignment: { horizontal: "left", vertical: "center" },
      });
      mergeRange(ws, merges, curRow, 0, curRow, 7);
      curRow++;
    }

    const contactLine2 = [
      co.phone ? `Phone: ${formatPhone(co.phone)}` : "",
      co.email ? `Email: ${co.email}` : "",
      co.website ? `Web: ${co.website}` : "",
      co.gstin ? `GSTIN: ${co.gstin}` : "",
    ]
      .filter(Boolean)
      .join("  |  ");

    if (contactLine2) {
      setCell(ws, curRow, 0, contactLine2, "s", {
        font: { name: FONT_FAMILY, sz: 10, color: { rgb: COLOR_MUTED_TEXT } },
        alignment: { horizontal: "left", vertical: "center" },
      });
      mergeRange(ws, merges, curRow, 0, curRow, 7);
      curRow++;
    }

    curRow++; // blank line

    // 2. Document Banner
    setCell(ws, curRow, 0, `TAX INVOICE — ${copyLabel.toUpperCase()}`, "s", {
      font: { name: FONT_FAMILY, sz: 13, bold: true, color: { rgb: COLOR_WHITE } },
      fill: { fgColor: { rgb: COLOR_DARK_NAVY } },
      alignment: { horizontal: "center", vertical: "center" },
      border: BORDER_THIN,
    });
    mergeRange(ws, merges, curRow, 0, curRow, 7, {
      fill: { fgColor: { rgb: COLOR_DARK_NAVY } },
      border: BORDER_THIN,
    });
    curRow += 2; // blank line

    // 3. Customer & Invoice Metadata Box (2 Clean Cards side-by-side)
    // Left Box Header: Col 0-3 (BILLED TO)
    setCell(ws, curRow, 0, "  BILLED TO (BUYER)", "s", {
      font: { name: FONT_FAMILY, sz: 10.5, bold: true, color: { rgb: COLOR_DARK_NAVY } },
      fill: { fgColor: { rgb: COLOR_SLATE_HEADER } },
      alignment: { horizontal: "left", vertical: "center" },
      border: BORDER_THIN,
    });
    mergeRange(ws, merges, curRow, 0, curRow, 3, {
      fill: { fgColor: { rgb: COLOR_SLATE_HEADER } },
      border: BORDER_THIN,
    });

    // Right Box Header: Col 4-7 (INVOICE DETAILS)
    setCell(ws, curRow, 4, "  INVOICE DETAILS", "s", {
      font: { name: FONT_FAMILY, sz: 10.5, bold: true, color: { rgb: COLOR_DARK_NAVY } },
      fill: { fgColor: { rgb: COLOR_SLATE_HEADER } },
      alignment: { horizontal: "left", vertical: "center" },
      border: BORDER_THIN,
    });
    mergeRange(ws, merges, curRow, 4, curRow, 7, {
      fill: { fgColor: { rgb: COLOR_SLATE_HEADER } },
      border: BORDER_THIN,
    });
    curRow++;

    // Data rows for Metadata
    const billLine1 = invoice.address || customer?.address || "—";
    const billCityState =
      [customer?.city, customer?.state].filter(Boolean).join(", ") +
      (customer?.pincode ? ` - ${customer.pincode}` : "");
    const placeOfSupplyText =
      invoice.placeOfSupply || customer?.state
        ? `${stateCode ? stateCode + " - " : ""}${invoice.placeOfSupply || customer.state}`
        : "—";

    const leftPairs = [
      `Customer:  ${invoice.customer || "—"}`,
      `Address:  ${billLine1}`,
      `City / State:  ${billCityState || "—"}`,
      `Phone:  ${invoice.phone || customer?.phone ? formatPhone(invoice.phone || customer.phone) : "—"}`,
      `Buyer GSTIN:  ${customer?.gstNo || "—"}`,
      `Shipped To:  ${shipText || billLine1}`,
    ];

    const rightPairs = [
      ["Invoice No:", invoice.id || "—"],
      ["Invoice Date:", invoice.date || "—"],
      ["Due Date:", invoice.dueDate || "—"],
      ["Place of Supply:", placeOfSupplyText],
      ["PO Number:", invoice.poNumber || "—"],
      ["Payment Mode:", `${invoice.paymentMode || "—"} (${invoice.status || "Unpaid"})`],
    ];

    if (invoice.eWayBillNo) {
      leftPairs.push(`E-Way Bill:  ${invoice.eWayBillNo}`);
      rightPairs.push(["Transport / Vehicle:", [invoice.transportName, invoice.vehicleNo].filter(Boolean).join(" / ") || "—"]);
    }

    const nMeta = Math.max(leftPairs.length, rightPairs.length);
    for (let k = 0; k < nMeta; k++) {
      // Left side: Spans A..D (Col 0..3) so text NEVER gets cut off
      const leftText = leftPairs[k] || "";
      setCell(ws, curRow, 0, `  ${leftText}`, "s", {
        font: {
          name: FONT_FAMILY,
          sz: 10,
          bold: k === 0,
          color: { rgb: COLOR_DARK_TEXT },
        },
        alignment: { horizontal: "left", vertical: "center" },
        border: BORDER_THIN,
      });
      mergeRange(ws, merges, curRow, 0, curRow, 3, { border: BORDER_THIN });

      // Right side: Col 4 is label, Col 5-7 is value
      const rightRow = rightPairs[k] || ["", ""];
      setCell(ws, curRow, 4, `  ${rightRow[0]}`, "s", {
        font: { name: FONT_FAMILY, sz: 10, bold: true, color: { rgb: COLOR_MUTED_TEXT } },
        alignment: { horizontal: "left", vertical: "center" },
        border: BORDER_THIN,
      });
      setCell(ws, curRow, 5, `  ${rightRow[1]}`, "s", {
        font: { name: FONT_FAMILY, sz: 10, bold: k === 0, color: { rgb: COLOR_DARK_TEXT } },
        alignment: { horizontal: "left", vertical: "center" },
        border: BORDER_THIN,
      });
      mergeRange(ws, merges, curRow, 5, curRow, 7, { border: BORDER_THIN });

      curRow++;
    }

    curRow++; // blank line

    // 4. Line Items Table Header (Row curRow)
    const headers = [
      { text: "#", wch: 8, align: "center" },
      { text: "Description of Goods / Services", wch: 36, align: "left" },
      { text: "HSN/SAC", wch: 14, align: "center" },
      { text: "Qty", wch: 12, align: "right" },
      { text: "Unit", wch: 12, align: "center" },
      { text: "Rate (₹)", wch: 16, align: "right" },
      { text: "Tax %", wch: 12, align: "center" },
      { text: "Amount (₹)", wch: 18, align: "right" },
    ];

    headers.forEach((h, colIdx) => {
      setCell(ws, curRow, colIdx, h.text, "s", {
        font: { name: FONT_FAMILY, sz: 10.5, bold: true, color: { rgb: COLOR_DARK_TEXT } },
        fill: { fgColor: { rgb: COLOR_TABLE_HEADER } },
        alignment: { horizontal: h.align, vertical: "center" },
        border: BORDER_THIN,
      });
    });
    curRow++;

    // 5. Line Items Rows
    if (items.length === 0) {
      setCell(ws, curRow, 0, "No items.", "s", {
        font: { name: FONT_FAMILY, sz: 10, italic: true },
        alignment: { horizontal: "center", vertical: "center" },
        border: BORDER_THIN,
      });
      mergeRange(ws, merges, curRow, 0, curRow, 7, { border: BORDER_THIN });
      curRow++;
    } else {
      items.forEach((it, idx) => {
        const itemRowStyle = {
          font: { name: FONT_FAMILY, sz: 10, color: { rgb: COLOR_DARK_TEXT } },
          border: BORDER_THIN,
        };

        // Col 0: #
        setCell(ws, curRow, 0, idx + 1, "n", {
          ...itemRowStyle,
          alignment: { horizontal: "center", vertical: "center" },
        });

        // Col 1: Description
        setCell(ws, curRow, 1, `  ${it.product || "—"}`, "s", {
          ...itemRowStyle,
          alignment: { horizontal: "left", vertical: "center" },
        });

        // Col 2: HSN/SAC
        setCell(ws, curRow, 2, it.hsnCode || "—", "s", {
          ...itemRowStyle,
          alignment: { horizontal: "center", vertical: "center" },
        });

        // Col 3: Qty
        setCell(ws, curRow, 3, Number(it.quantity) || 0, "n", {
          ...itemRowStyle,
          alignment: { horizontal: "right", vertical: "center" },
          numFmt: "#,##0.00",
        });

        // Col 4: Unit
        setCell(ws, curRow, 4, it.unit || "—", "s", {
          ...itemRowStyle,
          alignment: { horizontal: "center", vertical: "center" },
        });

        // Col 5: Rate
        setCell(ws, curRow, 5, Number(it.unitPrice) || 0, "n", {
          ...itemRowStyle,
          alignment: { horizontal: "right", vertical: "center" },
          numFmt: "₹#,##0.00",
        });

        // Col 6: Tax %
        setCell(ws, curRow, 6, `${it.taxPercent || 0}%`, "s", {
          ...itemRowStyle,
          alignment: { horizontal: "center", vertical: "center" },
        });

        // Col 7: Amount
        setCell(ws, curRow, 7, Number(it.amount) || 0, "n", {
          ...itemRowStyle,
          alignment: { horizontal: "right", vertical: "center" },
          numFmt: "₹#,##0.00",
        });

        curRow++;
      });
    }

    curRow++; // blank line

    // 6. Totals Block (Right-aligned under Amount column, labels in Col 5 & 6 merged)
    const addTotalLine = (label, val, opts = {}) => {
      const { isGrandTotal, isBalance, isHeader } = opts;
      let fillRgb = COLOR_LIGHT_ZEBRA;
      let fontColor = COLOR_DARK_TEXT;
      let fontSize = 10;
      let isBold = true;

      if (isGrandTotal) {
        fillRgb = COLOR_DARK_NAVY;
        fontColor = COLOR_WHITE;
        fontSize = 11;
      } else if (isBalance) {
        fillRgb = COLOR_ACCENT_BLUE;
        fontColor = COLOR_BALANCE_TEXT;
        fontSize = 10.5;
      }

      const cellStyle = {
        font: { name: FONT_FAMILY, sz: fontSize, bold: isBold, color: { rgb: fontColor } },
        fill: { fgColor: { rgb: fillRgb } },
        border: BORDER_THIN,
      };

      // Col 5 & 6 merged for Label
      setCell(ws, curRow, 5, `${label}  `, "s", {
        ...cellStyle,
        alignment: { horizontal: "right", vertical: "center" },
      });
      mergeRange(ws, merges, curRow, 5, curRow, 6, cellStyle);

      // Col 7 for Value
      setCell(ws, curRow, 7, Number(val) || 0, "n", {
        ...cellStyle,
        alignment: { horizontal: "right", vertical: "center" },
        numFmt: "₹#,##0.00",
      });

      curRow++;
    };

    addTotalLine("Sub Total (Taxable):", split.taxableTotal);
    if (intraState) {
      addTotalLine(`CGST (${split.cgstRate.toFixed(1)}%):`, split.cgstAmount);
      addTotalLine(`SGST (${split.sgstRate.toFixed(1)}%):`, split.sgstAmount);
    } else {
      addTotalLine(`IGST (${split.igstRate.toFixed(1)}%):`, split.igstAmount);
    }

    if (invoice.freightCharges > 0) {
      addTotalLine("Freight Charges:", Number(invoice.freightCharges) || 0);
    }

    addTotalLine("TOTAL AMOUNT (₹):", Number(invoice.amount) || 0, { isGrandTotal: true });
    addTotalLine("Paid Amount (₹):", Number(invoice.paidAmount) || 0);
    addTotalLine("BALANCE DUE (₹):", Number(invoice.balance) || 0, { isBalance: true });

    curRow++; // blank line

    // 7. Amount in Words Box
    setCell(
      ws,
      curRow,
      0,
      `  Amount in Words:  ${amountInWords(invoice.amount)}`,
      "s",
      {
        font: { name: FONT_FAMILY, sz: 10, bold: true, color: { rgb: COLOR_DARK_TEXT } },
        fill: { fgColor: { rgb: COLOR_LIGHT_ZEBRA } },
        alignment: { horizontal: "left", vertical: "center" },
        border: BORDER_THIN,
      }
    );
    mergeRange(ws, merges, curRow, 0, curRow, 7, {
      fill: { fgColor: { rgb: COLOR_LIGHT_ZEBRA } },
      border: BORDER_THIN,
    });
    curRow += 2;

    // 8. Footer (Bank Details & Terms on Left, Signatory on Right)
    const hasBank = co.bankName || co.bankAccountNumber || co.bankIfsc;
    const footerStart = curRow;

    if (hasBank) {
      setCell(ws, curRow, 0, "  BANK DETAILS", "s", {
        font: { name: FONT_FAMILY, sz: 10, bold: true, color: { rgb: COLOR_DARK_NAVY } },
        fill: { fgColor: { rgb: COLOR_SLATE_HEADER } },
        border: BORDER_THIN,
      });
      mergeRange(ws, merges, curRow, 0, curRow, 4, {
        fill: { fgColor: { rgb: COLOR_SLATE_HEADER } },
        border: BORDER_THIN,
      });
      curRow++;

      const bankLines = [
        co.bankName ? `Bank Name: ${co.bankName}` : "",
        co.bankAccountNumber ? `Account No: ${co.bankAccountNumber}` : "",
        co.bankIfsc ? `IFSC Code: ${co.bankIfsc}` : "",
        co.bankAccountName ? `Account Holder: ${co.bankAccountName}` : "",
      ].filter(Boolean);

      bankLines.forEach((bLine) => {
        setCell(ws, curRow, 0, `  ${bLine}`, "s", {
          font: { name: FONT_FAMILY, sz: 9.5, color: { rgb: COLOR_DARK_TEXT } },
          border: BORDER_THIN,
        });
        mergeRange(ws, merges, curRow, 0, curRow, 4, { border: BORDER_THIN });
        curRow++;
      });
    }

    if (invoice.notes) {
      setCell(ws, curRow, 0, `  Notes:  ${invoice.notes}`, "s", {
        font: { name: FONT_FAMILY, sz: 9.5, italic: true, color: { rgb: COLOR_MUTED_TEXT } },
        border: BORDER_THIN,
      });
      mergeRange(ws, merges, curRow, 0, curRow, 4, { border: BORDER_THIN });
      curRow++;
    }

    if (co.invoiceTerms) {
      setCell(ws, curRow, 0, `  Terms:  ${co.invoiceTerms}`, "s", {
        font: { name: FONT_FAMILY, sz: 9.5, italic: true, color: { rgb: COLOR_MUTED_TEXT } },
        border: BORDER_THIN,
      });
      mergeRange(ws, merges, curRow, 0, curRow, 4, { border: BORDER_THIN });
      curRow++;
    }

    // Signatory Box on Right (Col 5-7 from footerStart to curRow)
    const signBoxHeight = Math.max(curRow - footerStart, 4);
    for (let r = footerStart; r < footerStart + signBoxHeight; r++) {
      for (let c = 5; c <= 7; c++) {
        setCell(ws, r, c, "", "s", { border: BORDER_THIN });
      }
    }
    setCell(
      ws,
      footerStart,
      5,
      `For ${(co.companyName || "Your Company").toUpperCase()}`,
      "s",
      {
        font: { name: FONT_FAMILY, sz: 10, bold: true, color: { rgb: COLOR_DARK_TEXT } },
        alignment: { horizontal: "center", vertical: "center" },
        border: BORDER_THIN,
      }
    );
    mergeRange(ws, merges, footerStart, 5, footerStart, 7, { border: BORDER_THIN });

    setCell(
      ws,
      footerStart + signBoxHeight - 1,
      5,
      "Authorized Signatory",
      "s",
      {
        font: { name: FONT_FAMILY, sz: 10, bold: true, color: { rgb: COLOR_MUTED_TEXT } },
        alignment: { horizontal: "center", vertical: "center" },
        border: BORDER_THIN,
      }
    );
    mergeRange(ws, merges, footerStart + signBoxHeight - 1, 5, footerStart + signBoxHeight - 1, 7, {
      border: BORDER_THIN,
    });

    curRow = Math.max(curRow, footerStart + signBoxHeight);

    // Set sheet metadata
    ws["!ref"] = `A1:H${curRow + 2}`;
    ws["!merges"] = merges;
    ws["!cols"] = headers.map((h) => ({ wch: h.wch }));

    const cleanSheetName =
      copyLabel
        .replace(/[\\/?*[\]:]/g, "")
        .trim()
        .slice(0, 31) || "Invoice";

    XLSX.utils.book_append_sheet(wb, ws, cleanSheetName);
  });

  // Ensure Excel opens on Sheet 1 (Index 0)
  wb.Workbook = { Views: [{ ActiveTab: 0 }] };

  downloadWorkbook(wb, `invoice-${invoice.id}.xlsx`);
}

/**
 * Builds and downloads a clean, aligned CSV for an Invoice.
 */
export function exportInvoiceCsv({ invoice, customer, settings = {}, intraState = true }) {
  if (!invoice) return;

  const split = taxSplit(invoice, intraState);
  const items = invoice.items || [];
  const stateCode = getStateCode(invoice.placeOfSupply || customer?.state || "");
  const shipping = shippingLines(invoice, customer);
  const shipText = shipping.freeform || [shipping.line1, shipping.line2].filter(Boolean).join(", ");
  const co = settings || {};
  const placeOfSupplyText =
    invoice.placeOfSupply || customer?.state
      ? `${stateCode ? stateCode + " - " : ""}${invoice.placeOfSupply || customer.state}`
      : "—";

  const rows = [];
  const line = (cells) => cells.map(escapeCsvText).join(",");

  // 1. Company Header
  rows.push(line([(co.companyName || "Your Company").toUpperCase()]));
  if (co.legalName) rows.push(line([co.legalName]));
  if (co.address) rows.push(line([co.address]));
  const contactParts = [
    co.phone ? `Phone: ${formatPhone(co.phone)}` : "",
    co.email ? `Email: ${co.email}` : "",
    co.website ? `Web: ${co.website}` : "",
  ].filter(Boolean);
  if (contactParts.length) rows.push(line([contactParts.join(" | ")]));
  if (co.gstin) rows.push(line([`GSTIN: ${co.gstin}`]));
  rows.push("");

  // 2. Invoice Metadata (2 Balanced Columns across A-B and E-F)
  rows.push(line(["TAX INVOICE DETAILS", "", "", "", "CUSTOMER & BILLING DETAILS", ""]));
  rows.push(line(["Invoice No:", invoice.id || "—", "", "", "Customer:", invoice.customer || "—"]));
  rows.push(line(["Date:", invoice.date || "—", "", "", "Billing Address:", invoice.address || customer?.address || "—"]));
  rows.push(line(["Due Date:", invoice.dueDate || "—", "", "", "Phone:", formatPhone(invoice.phone || customer?.phone || "—")]));
  rows.push(line(["Place of Supply:", placeOfSupplyText, "", "", "Buyer GSTIN:", customer?.gstNo || "—"]));
  rows.push(line(["PO Number:", invoice.poNumber || "—", "", "", "Shipping Address:", shipText || invoice.address || customer?.address || "—"]));
  rows.push(line(["Payment Mode:", invoice.paymentMode || "—", "", "", "Status:", invoice.status || "Unpaid"]));
  if (invoice.eWayBillNo) {
    rows.push(line(["E-Way Bill:", invoice.eWayBillNo, "", "", "Transport / Vehicle:", [invoice.transportName, invoice.vehicleNo].filter(Boolean).join(" / ") || "—"]));
  }
  rows.push("");

  // 3. Line Items Table (8 Columns: A to H)
  rows.push(
    line([
      "#",
      "Description of Goods / Services",
      "HSN/SAC",
      "Qty",
      "Unit",
      "Unit Price (₹)",
      "Tax %",
      "Amount (₹)",
    ])
  );

  if (items.length === 0) {
    rows.push(line(["", "No items."]));
  } else {
    items.forEach((it, i) => {
      rows.push(
        line([
          i + 1,
          it.product || "—",
          it.hsnCode || "—",
          Number(it.quantity) || 0,
          it.unit || "—",
          Number(it.unitPrice || 0).toFixed(2),
          `${it.taxPercent || 0}%`,
          Number(it.amount || 0).toFixed(2),
        ])
      );
    });
  }
  rows.push("");

  // 4. Totals Block: Placed in Col G (label) and Col H (value) — NO EMPTY GAP!
  const addTotal = (lbl, val) => {
    rows.push(line(["", "", "", "", "", "", lbl, Number(val || 0).toFixed(2)]));
  };

  addTotal("Sub Total (Taxable):", split.taxableTotal);
  if (intraState) {
    addTotal(`CGST (${split.cgstRate.toFixed(1)}%):`, split.cgstAmount);
    addTotal(`SGST (${split.sgstRate.toFixed(1)}%):`, split.sgstAmount);
  } else {
    addTotal(`IGST (${split.igstRate.toFixed(1)}%):`, split.igstAmount);
  }
  if (invoice.freightCharges > 0) {
    addTotal("Freight Charges:", invoice.freightCharges);
  }
  addTotal("TOTAL AMOUNT (₹):", invoice.amount);
  addTotal("Paid Amount (₹):", invoice.paidAmount || 0);
  addTotal("BALANCE DUE (₹):", invoice.balance);
  rows.push("");

  // 5. Amount in Words, Bank Details, Notes, and Terms
  rows.push(line(["Amount in Words:", amountInWords(invoice.amount)]));

  const hasBank = co.bankName || co.bankAccountNumber || co.bankIfsc;
  if (hasBank) {
    rows.push(line(["Bank Details:", [co.bankName ? `Bank: ${co.bankName}` : "", co.bankAccountNumber ? `A/c: ${co.bankAccountNumber}` : "", co.bankIfsc ? `IFSC: ${co.bankIfsc}` : "", co.bankAccountName ? `Holder: ${co.bankAccountName}` : ""].filter(Boolean).join(" | ")]));
  }
  if (invoice.notes) {
    rows.push(line(["Notes:", invoice.notes.replace(/\r?\n/g, "; ")]));
  }
  if (co.invoiceTerms) {
    rows.push(line(["Terms & Conditions:", String(co.invoiceTerms).replace(/\r?\n/g, "; ")]));
  }

  // UTF-8 BOM so Excel opens Hindi, ₹ symbol and special chars properly
  const csvContent = "\ufeff" + rows.join("\r\n");
  downloadBlob(
    new Blob([csvContent], { type: "text/csv;charset=utf-8" }),
    `invoice-${invoice.id}.csv`
  );
}

/**
 * Builds and downloads an Excel workbook for Delivery Challans.
 */
export function exportDeliveryChallanExcel({
  dc,
  customer,
  settings = {},
  copyLabels = ["ORIGINAL — FOR CONSIGNEE"],
}) {
  if (!dc) return;
  const wb = XLSX.utils.book_new();
  const co = settings || {};
  const stateCode = getStateCode(customer?.state);

  copyLabels.forEach((copyLabel) => {
    const ws = {};
    const merges = [];
    let curRow = 0;

    setCell(ws, curRow, 0, (co.companyName || "Your Company").toUpperCase(), "s", {
      font: { name: FONT_FAMILY, sz: 16, bold: true, color: { rgb: COLOR_DARK_TEXT } },
      alignment: { horizontal: "left", vertical: "center" },
    });
    mergeRange(ws, merges, curRow, 0, curRow, 5);
    curRow++;

    if (co.address || co.gstin) {
      setCell(
        ws,
        curRow,
        0,
        [co.address, co.gstin ? `GSTIN: ${co.gstin}` : ""].filter(Boolean).join("  |  "),
        "s",
        {
          font: { name: FONT_FAMILY, sz: 10, color: { rgb: COLOR_MUTED_TEXT } },
          alignment: { horizontal: "left", vertical: "center" },
        }
      );
      mergeRange(ws, merges, curRow, 0, curRow, 5);
      curRow++;
    }

    curRow++;

    setCell(ws, curRow, 0, `DELIVERY CHALLAN — ${copyLabel.toUpperCase()}`, "s", {
      font: { name: FONT_FAMILY, sz: 13, bold: true, color: { rgb: COLOR_WHITE } },
      fill: { fgColor: { rgb: COLOR_DARK_NAVY } },
      alignment: { horizontal: "center", vertical: "center" },
      border: BORDER_THIN,
    });
    mergeRange(ws, merges, curRow, 0, curRow, 5, {
      fill: { fgColor: { rgb: COLOR_DARK_NAVY } },
      border: BORDER_THIN,
    });
    curRow += 2;

    const metaRows = [
      ["DC Number:", dc.id || "—", "DC Date:", dc.date || "—"],
      ["Customer:", dc.customer || "—", "Sales Order No:", dc.salesOrder || "—"],
      ["Delivery Address:", dc.deliveryAddress || customer?.address || "—", "State Code:", stateCode || "—"],
      ["Transporter:", dc.transporter || "—", "Vehicle No:", dc.vehicleNo || "—"],
      ["E-Way Bill:", dc.eWayBillNo || "—", "Status:", dc.status || "—"],
    ];

    metaRows.forEach((row) => {
      setCell(ws, curRow, 0, `  ${row[0]}`, "s", {
        font: { name: FONT_FAMILY, sz: 10, bold: true, color: { rgb: COLOR_MUTED_TEXT } },
        border: BORDER_THIN,
      });
      setCell(ws, curRow, 1, `  ${row[1]}`, "s", {
        font: { name: FONT_FAMILY, sz: 10, color: { rgb: COLOR_DARK_TEXT } },
        border: BORDER_THIN,
      });
      mergeRange(ws, merges, curRow, 1, curRow, 2, { border: BORDER_THIN });

      setCell(ws, curRow, 3, `  ${row[2]}`, "s", {
        font: { name: FONT_FAMILY, sz: 10, bold: true, color: { rgb: COLOR_MUTED_TEXT } },
        border: BORDER_THIN,
      });
      setCell(ws, curRow, 4, `  ${row[3]}`, "s", {
        font: { name: FONT_FAMILY, sz: 10, color: { rgb: COLOR_DARK_TEXT } },
        border: BORDER_THIN,
      });
      mergeRange(ws, merges, curRow, 4, curRow, 5, { border: BORDER_THIN });

      curRow++;
    });

    curRow++;

    const dcHeaders = [
      { text: "#", wch: 8, align: "center" },
      { text: "Product Description", wch: 36, align: "left" },
      { text: "HSN/SAC", wch: 14, align: "center" },
      { text: "Dispatched Qty", wch: 16, align: "right" },
      { text: "Unit", wch: 12, align: "center" },
      { text: "Remarks", wch: 24, align: "left" },
    ];

    dcHeaders.forEach((h, colIdx) => {
      setCell(ws, curRow, colIdx, h.text, "s", {
        font: { name: FONT_FAMILY, sz: 10.5, bold: true, color: { rgb: COLOR_DARK_TEXT } },
        fill: { fgColor: { rgb: COLOR_TABLE_HEADER } },
        alignment: { horizontal: h.align, vertical: "center" },
        border: BORDER_THIN,
      });
    });
    curRow++;

    setCell(ws, curRow, 0, 1, "n", {
      font: { name: FONT_FAMILY, sz: 10 },
      alignment: { horizontal: "center", vertical: "center" },
      border: BORDER_THIN,
    });
    setCell(ws, curRow, 1, `  ${dc.product || "—"}`, "s", {
      font: { name: FONT_FAMILY, sz: 10 },
      alignment: { horizontal: "left", vertical: "center" },
      border: BORDER_THIN,
    });
    setCell(ws, curRow, 2, dc.hsnCode || "—", "s", {
      font: { name: FONT_FAMILY, sz: 10 },
      alignment: { horizontal: "center", vertical: "center" },
      border: BORDER_THIN,
    });
    setCell(ws, curRow, 3, Number(dc.dispatchedQty) || 0, "n", {
      font: { name: FONT_FAMILY, sz: 10 },
      alignment: { horizontal: "right", vertical: "center" },
      border: BORDER_THIN,
      numFmt: "#,##0.00",
    });
    setCell(ws, curRow, 4, dc.unit || "Nos", "s", {
      font: { name: FONT_FAMILY, sz: 10 },
      alignment: { horizontal: "center", vertical: "center" },
      border: BORDER_THIN,
    });
    setCell(ws, curRow, 5, `  ${dc.notes || "—"}`, "s", {
      font: { name: FONT_FAMILY, sz: 10 },
      alignment: { horizontal: "left", vertical: "center" },
      border: BORDER_THIN,
    });
    curRow += 2;

    if (dc.notes) {
      setCell(ws, curRow, 0, `  Notes:  ${dc.notes}`, "s", {
        font: { name: FONT_FAMILY, sz: 9.5, italic: true },
        border: BORDER_THIN,
      });
      mergeRange(ws, merges, curRow, 0, curRow, 5, { border: BORDER_THIN });
      curRow += 2;
    }

    setCell(ws, curRow, 0, `For ${(co.companyName || "Your Company").toUpperCase()}`, "s", {
      font: { name: FONT_FAMILY, sz: 10, bold: true },
    });
    mergeRange(ws, merges, curRow, 0, curRow, 5);
    curRow += 3;

    setCell(ws, curRow, 0, "Authorized Signatory", "s", {
      font: { name: FONT_FAMILY, sz: 10, bold: true, color: { rgb: COLOR_MUTED_TEXT } },
    });
    mergeRange(ws, merges, curRow, 0, curRow, 5);

    ws["!ref"] = `A1:F${curRow + 2}`;
    ws["!merges"] = merges;
    ws["!cols"] = dcHeaders.map((h) => ({ wch: h.wch }));

    const cleanSheetName =
      copyLabel
        .replace(/[\\/?*[\]:]/g, "")
        .trim()
        .slice(0, 31) || "DC";
    XLSX.utils.book_append_sheet(wb, ws, cleanSheetName);
  });

  wb.Workbook = { Views: [{ ActiveTab: 0 }] };
  downloadWorkbook(wb, `delivery-challan-${dc.id}.xlsx`);
}

/**
 * Builds and downloads an Excel workbook for Purchase Orders.
 */
export function exportPurchaseOrderExcel({
  po,
  supplier,
  settings = {},
  intraState = true,
  copyLabels = ["ORIGINAL COPY"],
}) {
  if (!po) return;
  const wb = XLSX.utils.book_new();
  const split = taxSplit(po, intraState);
  const items = po.items || [];
  const co = settings || {};
  const stateCode = getStateCode(supplier?.state);

  copyLabels.forEach((copyLabel) => {
    const ws = {};
    const merges = [];
    let curRow = 0;

    setCell(ws, curRow, 0, (co.companyName || "Your Company").toUpperCase(), "s", {
      font: { name: FONT_FAMILY, sz: 16, bold: true, color: { rgb: COLOR_DARK_TEXT } },
      alignment: { horizontal: "left", vertical: "center" },
    });
    mergeRange(ws, merges, curRow, 0, curRow, 7);
    curRow++;

    if (co.address || co.gstin) {
      setCell(
        ws,
        curRow,
        0,
        [co.address, co.gstin ? `GSTIN: ${co.gstin}` : ""].filter(Boolean).join("  |  "),
        "s",
        {
          font: { name: FONT_FAMILY, sz: 10, color: { rgb: COLOR_MUTED_TEXT } },
          alignment: { horizontal: "left", vertical: "center" },
        }
      );
      mergeRange(ws, merges, curRow, 0, curRow, 7);
      curRow++;
    }

    curRow++;

    setCell(ws, curRow, 0, `PURCHASE ORDER — ${copyLabel.toUpperCase()}`, "s", {
      font: { name: FONT_FAMILY, sz: 13, bold: true, color: { rgb: COLOR_WHITE } },
      fill: { fgColor: { rgb: COLOR_DARK_NAVY } },
      alignment: { horizontal: "center", vertical: "center" },
      border: BORDER_THIN,
    });
    mergeRange(ws, merges, curRow, 0, curRow, 7, {
      fill: { fgColor: { rgb: COLOR_DARK_NAVY } },
      border: BORDER_THIN,
    });
    curRow += 2;

    const poHeaders = [
      { text: "#", wch: 8, align: "center" },
      { text: "Description of Goods", wch: 36, align: "left" },
      { text: "HSN/SAC", wch: 14, align: "center" },
      { text: "Qty", wch: 12, align: "right" },
      { text: "Unit", wch: 12, align: "center" },
      { text: "Unit Price (₹)", wch: 16, align: "right" },
      { text: "Tax %", wch: 12, align: "center" },
      { text: "Amount (₹)", wch: 18, align: "right" },
    ];

    const metaRows = [
      ["PO Number:", po.id || "—", "PO Date:", po.orderDate || "—"],
      ["Supplier:", po.supplier || "—", "Expected Date:", po.expectedDate || "—"],
      ["Supplier Address:", po.address || supplier?.address || "—", "Payment Terms:", po.paymentTerms || "—"],
      ["Supplier GSTIN:", supplier?.gstNo || "—", "State Code:", stateCode || "—"],
      ["Delivery Location:", po.deliveryLocation || "—", "Status:", po.status || "—"],
    ];

    metaRows.forEach((row) => {
      setCell(ws, curRow, 0, `  ${row[0]}`, "s", {
        font: { name: FONT_FAMILY, sz: 10, bold: true, color: { rgb: COLOR_MUTED_TEXT } },
        border: BORDER_THIN,
      });
      setCell(ws, curRow, 1, `  ${row[1]}`, "s", {
        font: { name: FONT_FAMILY, sz: 10, color: { rgb: COLOR_DARK_TEXT } },
        border: BORDER_THIN,
      });
      mergeRange(ws, merges, curRow, 1, curRow, 3, { border: BORDER_THIN });

      setCell(ws, curRow, 4, `  ${row[2]}`, "s", {
        font: { name: FONT_FAMILY, sz: 10, bold: true, color: { rgb: COLOR_MUTED_TEXT } },
        border: BORDER_THIN,
      });
      setCell(ws, curRow, 5, `  ${row[3]}`, "s", {
        font: { name: FONT_FAMILY, sz: 10, color: { rgb: COLOR_DARK_TEXT } },
        border: BORDER_THIN,
      });
      mergeRange(ws, merges, curRow, 5, curRow, 7, { border: BORDER_THIN });

      curRow++;
    });

    curRow++;

    poHeaders.forEach((h, colIdx) => {
      setCell(ws, curRow, colIdx, h.text, "s", {
        font: { name: FONT_FAMILY, sz: 10.5, bold: true, color: { rgb: COLOR_DARK_TEXT } },
        fill: { fgColor: { rgb: COLOR_TABLE_HEADER } },
        alignment: { horizontal: h.align, vertical: "center" },
        border: BORDER_THIN,
      });
    });
    curRow++;

    if (items.length === 0) {
      setCell(ws, curRow, 0, "No items.", "s", {
        font: { name: FONT_FAMILY, sz: 10, italic: true },
        alignment: { horizontal: "center", vertical: "center" },
        border: BORDER_THIN,
      });
      mergeRange(ws, merges, curRow, 0, curRow, 7, { border: BORDER_THIN });
      curRow++;
    } else {
      items.forEach((it, idx) => {
        const itemRowStyle = {
          font: { name: FONT_FAMILY, sz: 10, color: { rgb: COLOR_DARK_TEXT } },
          border: BORDER_THIN,
        };

        setCell(ws, curRow, 0, idx + 1, "n", {
          ...itemRowStyle,
          alignment: { horizontal: "center", vertical: "center" },
        });
        setCell(ws, curRow, 1, `  ${it.product || "—"}`, "s", {
          ...itemRowStyle,
          alignment: { horizontal: "left", vertical: "center" },
        });
        setCell(ws, curRow, 2, it.hsnCode || "—", "s", {
          ...itemRowStyle,
          alignment: { horizontal: "center", vertical: "center" },
        });
        setCell(ws, curRow, 3, Number(it.quantity) || 0, "n", {
          ...itemRowStyle,
          alignment: { horizontal: "right", vertical: "center" },
          numFmt: "#,##0.00",
        });
        setCell(ws, curRow, 4, it.unit || "—", "s", {
          ...itemRowStyle,
          alignment: { horizontal: "center", vertical: "center" },
        });
        setCell(ws, curRow, 5, Number(it.unitPrice) || 0, "n", {
          ...itemRowStyle,
          alignment: { horizontal: "right", vertical: "center" },
          numFmt: "₹#,##0.00",
        });
        setCell(ws, curRow, 6, `${it.taxPercent || 0}%`, "s", {
          ...itemRowStyle,
          alignment: { horizontal: "center", vertical: "center" },
        });
        setCell(ws, curRow, 7, Number(it.amount) || 0, "n", {
          ...itemRowStyle,
          alignment: { horizontal: "right", vertical: "center" },
          numFmt: "₹#,##0.00",
        });
        curRow++;
      });
    }

    curRow++;

    const addPoTotal = (label, val, isGrand) => {
      const cellStyle = {
        font: {
          name: FONT_FAMILY,
          sz: isGrand ? 11 : 10,
          bold: true,
          color: { rgb: isGrand ? COLOR_WHITE : COLOR_DARK_TEXT },
        },
        fill: { fgColor: { rgb: isGrand ? COLOR_DARK_NAVY : COLOR_LIGHT_ZEBRA } },
        border: BORDER_THIN,
      };

      setCell(ws, curRow, 5, `${label}  `, "s", {
        ...cellStyle,
        alignment: { horizontal: "right", vertical: "center" },
      });
      mergeRange(ws, merges, curRow, 5, curRow, 6, cellStyle);

      setCell(ws, curRow, 7, Number(val) || 0, "n", {
        ...cellStyle,
        alignment: { horizontal: "right", vertical: "center" },
        numFmt: "₹#,##0.00",
      });
      curRow++;
    };

    addPoTotal("Sub Total:", split.taxableTotal);
    if (intraState) {
      addPoTotal(`CGST (${split.cgstRate.toFixed(1)}%):`, split.cgstAmount);
      addPoTotal(`SGST (${split.sgstRate.toFixed(1)}%):`, split.sgstAmount);
    } else {
      addPoTotal(`IGST (${split.igstRate.toFixed(1)}%):`, split.igstAmount);
    }
    if (po.freightCharges > 0) {
      addPoTotal("Freight Charges:", Number(po.freightCharges) || 0);
    }
    addPoTotal("TOTAL AMOUNT (₹):", Number(po.amount) || 0, true);

    curRow += 2;

    setCell(ws, curRow, 0, `For ${(co.companyName || "Your Company").toUpperCase()}`, "s", {
      font: { name: FONT_FAMILY, sz: 10, bold: true },
    });
    mergeRange(ws, merges, curRow, 0, curRow, 7);
    curRow += 3;

    setCell(ws, curRow, 0, "Authorized Signatory", "s", {
      font: { name: FONT_FAMILY, sz: 10, bold: true, color: { rgb: COLOR_MUTED_TEXT } },
    });
    mergeRange(ws, merges, curRow, 0, curRow, 7);

    ws["!ref"] = `A1:H${curRow + 2}`;
    ws["!merges"] = merges;
    ws["!cols"] = poHeaders.map((h) => ({ wch: h.wch }));

    const cleanSheetName =
      copyLabel
        .replace(/[\\/?*[\]:]/g, "")
        .trim()
        .slice(0, 31) || "PO";
    XLSX.utils.book_append_sheet(wb, ws, cleanSheetName);
  });

  wb.Workbook = { Views: [{ ActiveTab: 0 }] };
  downloadWorkbook(wb, `purchase-order-${po.id}.xlsx`);
}
