import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import api from "../api/client";
import { getStateCode, isIntraState } from "../utils/gstStateCodes";
import { amountInWords } from "../utils/numberToWords";
import { formatPhone } from "../utils/formatPhone";
import { groupByHsn, inr, num, shippingLines, taxSplit } from "./invoiceCalc";

// Printable documents for the phone: the same content as the web print pages
// (InvoicePrint "billbook" layout, DeliveryChallanPrint, PurchaseOrderPrint),
// rendered to HTML and turned into a PDF by expo-print. From there the system
// share sheet sends it to WhatsApp, email, Drive, a printer — anything.

const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const dash = (v) => (v === undefined || v === null || v === "" ? "—" : esc(v));

const CSS = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: #1f2937; margin: 0; padding: 18px; }
  .sheet { border: 1px solid #cfd6df; padding: 16px; page-break-after: always; }
  .sheet:last-child { page-break-after: auto; }
  .head { display: flex; justify-content: space-between; gap: 12px; }
  .brand { display: flex; gap: 10px; }
  .brand img { max-width: 80px; max-height: 60px; object-fit: contain; }
  .cname { font-size: 16px; font-weight: 800; }
  .muted { color: #6b7280; }
  .title { font-size: 18px; font-weight: 800; text-align: right; letter-spacing: .5px; }
  .copy { text-align: right; font-size: 10px; color: #6b7280; margin-top: 4px; }
  .gstin { margin-top: 8px; font-weight: 700; }
  hr { border: 0; border-top: 2px solid #1f2937; margin: 8px 0 10px; }
  .grid { display: flex; gap: 12px; }
  .box { flex: 1; border: 1px solid #e5e9ef; padding: 8px; border-radius: 4px; }
  .label { font-size: 9px; text-transform: uppercase; color: #6b7280; font-weight: 700; margin-bottom: 3px; }
  .bname { font-weight: 800; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; }
  .meta th, .meta td { text-align: left; padding: 3px 6px; border-bottom: 1px solid #eef0f3; font-size: 10.5px; }
  .meta th { color: #6b7280; font-weight: 600; width: 45%; }
  .items { margin-top: 12px; }
  .items th { background: #f3f5f8; font-size: 10px; text-align: left; }
  .items th, .items td { border: 1px solid #d9dee5; padding: 5px 6px; }
  .r { text-align: right; }
  .totals { display: flex; gap: 12px; margin-top: 12px; }
  .totals .words { flex: 1; }
  .totals table { width: 48%; }
  .totals th, .totals td { padding: 4px 6px; border-bottom: 1px solid #eef0f3; }
  .totals th { text-align: left; font-weight: 600; color: #4b5563; }
  .totals td { text-align: right; }
  .grand th, .grand td { font-weight: 800; font-size: 12px; color: #111827; border-top: 1px solid #1f2937; }
  .foot { display: flex; justify-content: space-between; gap: 12px; margin-top: 16px; }
  .sign { text-align: right; min-width: 180px; }
  .sign img { max-height: 50px; max-width: 120px; object-fit: contain; }
  .thanks { margin-top: 12px; text-align: center; background: #1f2937; color: #fff; padding: 6px; font-weight: 700; }
  ol { margin: 4px 0 0 16px; padding: 0; }
`;

function companyHeader(settings, title, copyLabel) {
  return `
  <div class="head">
    <div class="brand">
      ${settings.logo ? `<img src="${settings.logo}" />` : ""}
      <div>
        <div class="cname">${esc((settings.companyName || "Your Company").toUpperCase())}</div>
        ${settings.legalName ? `<div>${esc(settings.legalName)}</div>` : ""}
        ${settings.address ? `<div class="muted">${esc(settings.address)}</div>` : ""}
        <div class="muted">${[settings.phone && `Ph: ${esc(formatPhone(settings.phone))}`, settings.email && esc(settings.email), settings.website && esc(settings.website)].filter(Boolean).join(" · ")}</div>
      </div>
    </div>
    <div>
      <div class="title">${esc(title)}</div>
      ${copyLabel ? `<div class="copy">${esc(copyLabel)}</div>` : ""}
    </div>
  </div>
  ${settings.gstin ? `<div class="gstin">GSTIN: ${esc(settings.gstin)}</div>` : ""}
  <hr/>`;
}

// `left` replaces the bank-details column (the challan puts the receiver's
// signature there instead).
function signatureBlock(settings, left) {
  const hasBank = settings.bankName || settings.bankAccountNumber || settings.bankIfsc;
  return `
  <div class="foot">
    <div>${
      left !== undefined
        ? left
        : hasBank
        ? `<div class="label">Bank Details</div>
           ${settings.bankName ? `<div>Bank: ${esc(settings.bankName)}</div>` : ""}
           ${settings.bankAccountNumber ? `<div>A/c No.: ${esc(settings.bankAccountNumber)}</div>` : ""}
           ${settings.bankIfsc ? `<div>IFSC: ${esc(settings.bankIfsc)}</div>` : ""}
           ${settings.bankAccountName ? `<div>Holder: ${esc(settings.bankAccountName)}</div>` : ""}`
        : ""
    }</div>
    <div class="sign">
      <div>For ${esc(settings.companyName || "Your Company")}</div>
      <div style="height:54px">${settings.seal ? `<img src="${settings.seal}"/>` : ""}${settings.signature ? `<img src="${settings.signature}"/>` : ""}</div>
      <div class="muted">Authorized Signatory</div>
    </div>
  </div>`;
}

const wrap = (body) => `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><style>${CSS}</style></head><body>${body}</body></html>`;

// ---------- Sales invoice (GST tax invoice) ----------

export function invoiceHtml({ invoice, customer, settings, copies = ["ORIGINAL COPY"] }) {
  const placeOfSupply = invoice.placeOfSupply || customer?.state || "";
  const intraState = isIntraState(settings.gstin, placeOfSupply);
  const stateCode = getStateCode(placeOfSupply);
  const items = invoice.items || [];
  const split = taxSplit(invoice, intraState);
  const hsnRows = groupByHsn(items);
  const shipping = shippingLines(invoice, customer);

  const sheet = (copyLabel) => `
  <div class="sheet">
    ${companyHeader(settings, "TAX INVOICE", copyLabel)}
    <div class="grid">
      <div style="flex:1;display:flex;flex-direction:column;gap:8px">
        <div class="box">
          <div class="label">Billing Address</div>
          <div class="bname">${esc(invoice.customer)}</div>
          ${invoice.address || customer?.address ? `<div>${esc(invoice.address || customer.address)}</div>` : ""}
          <div>${esc([customer?.city, customer?.state].filter(Boolean).join(", "))}${customer?.pincode ? ` - ${esc(customer.pincode)}` : ""}</div>
          ${invoice.phone || customer?.phone ? `<div>Phone: ${esc(formatPhone(invoice.phone || customer.phone))}</div>` : ""}
        </div>
        <div class="box">
          <div class="label">Shipping Address</div>
          <div class="bname">${esc(shipping.name)}</div>
          ${shipping.freeform ? `<div style="white-space:pre-line">${esc(shipping.freeform)}</div>` : `${shipping.line1 ? `<div>${esc(shipping.line1)}</div>` : ""}<div>${esc(shipping.line2)}</div>`}
        </div>
      </div>
      <table class="meta" style="flex:1">
        <tr><th>Invoice No</th><td>${dash(invoice.id)}</td></tr>
        <tr><th>Invoice Date</th><td>${dash(invoice.date)}</td></tr>
        <tr><th>Place of Supply</th><td>${placeOfSupply ? `${stateCode ? `${stateCode}-` : ""}${esc(placeOfSupply)}` : "—"}</td></tr>
        <tr><th>PO Number</th><td>${dash(invoice.poNumber)}</td></tr>
        <tr><th>PO Date</th><td>${dash(invoice.poDate)}</td></tr>
        <tr><th>Transport Name</th><td>${dash(invoice.transportName)}</td></tr>
        <tr><th>Vehicle Number</th><td>${dash(invoice.vehicleNo)}</td></tr>
        <tr><th>Delivery Date</th><td>${dash(invoice.deliveryDate)}</td></tr>
        <tr><th>Delivery Location</th><td>${dash(invoice.deliveryLocation)}</td></tr>
        ${invoice.eWayBillNo ? `<tr><th>E-Way Bill No</th><td>${esc(invoice.eWayBillNo)}</td></tr>` : ""}
        <tr><th>Due Date</th><td>${dash(invoice.dueDate)}</td></tr>
        <tr><th>Buyer's GSTIN</th><td>${dash(customer?.gstNo)}</td></tr>
      </table>
    </div>

    <table class="items">
      <tr><th>#</th><th>Description of Goods / Services</th><th>HSN/SAC</th><th class="r">Qty</th><th>Unit</th><th class="r">Rate (₹)</th><th class="r">Tax %</th><th class="r">Amount (₹)</th></tr>
      ${
        items.length === 0
          ? `<tr><td colspan="8">No items.</td></tr>`
          : items
              .map(
                (it, i) =>
                  `<tr><td>${i + 1}</td><td>${esc(it.product)}</td><td>${dash(it.hsnCode)}</td><td class="r">${Number(it.quantity) || 0}</td><td>${dash(it.unit)}</td><td class="r">${num(it.unitPrice)}</td><td class="r">${it.taxPercent || 0}%</td><td class="r">${num(it.amount)}</td></tr>`
              )
              .join("")
      }
    </table>

    ${
      hsnRows.length
        ? `<table class="items">
        <tr><th>HSN/SAC</th><th class="r">Taxable</th>${intraState ? `<th class="r">CGST</th><th class="r">SGST</th>` : `<th class="r">IGST</th>`}<th class="r">Total Tax</th></tr>
        ${hsnRows
          .map(
            (r) =>
              `<tr><td>${esc(r.hsnCode)}</td><td class="r">${num(r.taxable)}</td>${
                intraState
                  ? `<td class="r">${(r.rate / 2).toFixed(1)}% · ${num(r.tax / 2)}</td><td class="r">${(r.rate / 2).toFixed(1)}% · ${num(r.tax / 2)}</td>`
                  : `<td class="r">${r.rate.toFixed(1)}% · ${num(r.tax)}</td>`
              }<td class="r">${num(r.tax)}</td></tr>`
          )
          .join("")}
      </table>`
        : ""
    }

    <div class="totals">
      <div class="words">
        <div class="label">Amount in Words</div>
        <div>${esc(amountInWords(invoice.amount))}</div>
        ${invoice.paymentMode ? `<div style="margin-top:6px"><b>Payment Mode:</b> ${esc(invoice.paymentMode)}${invoice.paymentReference ? ` (${esc(invoice.paymentReference)})` : ""}</div>` : ""}
        ${
          invoice.notes
            ? `<div style="margin-top:6px"><div class="label">Notes</div><ol>${invoice.notes
                .split("\n")
                .filter(Boolean)
                .map((l) => `<li>${esc(l)}</li>`)
                .join("")}</ol></div>`
            : ""
        }
      </div>
      <table>
        <tr><th>Sub Total</th><td>${inr(split.taxableTotal)}</td></tr>
        ${
          intraState
            ? `<tr><th>CGST (${split.cgstRate.toFixed(1)}%)</th><td>${inr(split.cgstAmount)}</td></tr><tr><th>SGST (${split.sgstRate.toFixed(1)}%)</th><td>${inr(split.sgstAmount)}</td></tr>`
            : `<tr><th>IGST (${split.igstRate.toFixed(1)}%)</th><td>${inr(split.igstAmount)}</td></tr>`
        }
        ${invoice.freightCharges > 0 ? `<tr><th>Freight Charges</th><td>${inr(invoice.freightCharges)}</td></tr>` : ""}
        <tr class="grand"><th>Total Amount</th><td>${inr(invoice.amount)}</td></tr>
        <tr><th>Paid Amount</th><td>${inr(invoice.paidAmount)}</td></tr>
        <tr class="grand"><th>Balance Due</th><td>${inr(invoice.balance)}</td></tr>
      </table>
    </div>
    ${signatureBlock(settings)}
    <div class="thanks">Thank you for your business!</div>
  </div>`;

  return wrap(copies.map(sheet).join(""));
}

// ---------- Delivery challan ----------

export function challanHtml({ dc, customer, settings }) {
  const qty = Number(dc.dispatchedQty) || 0;
  const stateCode = getStateCode(customer?.state);
  return wrap(`
  <div class="sheet">
    ${companyHeader(settings, "DELIVERY CHALLAN")}
    <div class="grid">
      <div class="box">
        <div class="label">Consignee</div>
        <div class="bname">${esc(dc.customer)}</div>
        ${customer?.address ? `<div>${esc(customer.address)}</div>` : ""}
        <div>${esc([customer?.city, customer?.state].filter(Boolean).join(", "))}${customer?.pincode ? ` - ${esc(customer.pincode)}` : ""}</div>
        ${customer?.phone ? `<div>Phone: ${esc(formatPhone(customer.phone))}</div>` : ""}
        ${customer?.gstNo ? `<div>GSTIN: ${esc(customer.gstNo)}</div>` : ""}
      </div>
      <table class="meta" style="flex:1">
        <tr><th>DC Number</th><td>${dash(dc.id)}</td></tr>
        <tr><th>DC Date</th><td>${dash(dc.date)}</td></tr>
        <tr><th>Sales Order No</th><td>${dash(dc.salesOrder)}</td></tr>
        <tr><th>Transporter</th><td>${dash(dc.transporter)}</td></tr>
        <tr><th>Vehicle No.</th><td>${dash(dc.vehicleNo)}</td></tr>
        <tr><th>Warehouse</th><td>${dash(dc.warehouse)}</td></tr>
        <tr><th>State Code</th><td>${dash(stateCode)}</td></tr>
      </table>
    </div>
    <table class="items">
      <tr><th>#</th><th>Description of Goods</th><th class="r">Qty</th><th>Unit</th></tr>
      <tr><td>1</td><td>${dash(dc.product)}</td><td class="r">${qty.toLocaleString("en-IN")}</td><td>${esc(dc.unit || "Nos")}</td></tr>
    </table>
    <div class="totals">
      <div class="words"><div class="label">Remarks</div><div>Goods dispatched in good condition. Please verify quantity on receipt.</div></div>
      <table>
        <tr><th>Total Dispatched Qty</th><td>${qty.toLocaleString("en-IN")} ${esc(dc.unit || "Nos")}</td></tr>
        <tr><th>No. of Items</th><td>${esc(dc.items || 1)}</td></tr>
        <tr class="grand"><th>Delivery Status</th><td>${esc(dc.status || "Pending")}</td></tr>
      </table>
    </div>
    ${signatureBlock(settings, `<div class="label">Receiver's Signature</div><div style="height:50px"></div>`)}
  </div>`);
}

// ---------- Purchase order ----------

export function purchaseOrderHtml({ po, supplier, settings }) {
  const intraState = isIntraState(settings.gstin, supplier?.state);
  const items = po.items || [];
  const split = taxSplit(po, intraState);
  const stateCode = getStateCode(supplier?.state);
  return wrap(`
  <div class="sheet">
    ${companyHeader(settings, "PURCHASE ORDER")}
    <div class="grid">
      <div class="box">
        <div class="label">Supplier</div>
        <div class="bname">${esc(po.supplier)}</div>
        ${supplier?.address ? `<div>${esc(supplier.address)}</div>` : ""}
        <div>${esc([supplier?.city, supplier?.state].filter(Boolean).join(", "))}${supplier?.pincode ? ` - ${esc(supplier.pincode)}` : ""}</div>
        ${supplier?.phone ? `<div>Phone: ${esc(formatPhone(supplier.phone))}</div>` : ""}
      </div>
      <table class="meta" style="flex:1">
        <tr><th>PO Number</th><td>${dash(po.id)}</td></tr>
        <tr><th>PO Date</th><td>${dash(po.orderDate)}</td></tr>
        <tr><th>Delivery Date</th><td>${dash(po.expectedDate)}</td></tr>
        <tr><th>Payment Terms</th><td>${dash(po.paymentTerms)}</td></tr>
        <tr><th>Supplier's GSTIN</th><td>${dash(supplier?.gstNo)}</td></tr>
        <tr><th>State Code</th><td>${dash(stateCode)}</td></tr>
      </table>
    </div>
    <table class="items">
      <tr><th>#</th><th>Description of Goods / Services</th><th>HSN/SAC</th><th class="r">Qty</th><th>Unit</th><th class="r">Price/Unit (₹)</th><th class="r">Tax %</th><th class="r">Amount (₹)</th></tr>
      ${
        items.length === 0
          ? `<tr><td colspan="8">No items.</td></tr>`
          : items
              .map(
                (it, i) =>
                  `<tr><td>${i + 1}</td><td>${esc(it.product)}</td><td>${dash(it.hsnCode)}</td><td class="r">${Number(it.quantity) || 0}</td><td>${dash(it.unit)}</td><td class="r">${num(it.unitPrice)}</td><td class="r">${it.taxPercent || 0}%</td><td class="r">${num(it.amount)}</td></tr>`
              )
              .join("")
      }
    </table>
    <div class="totals">
      <div class="words"><div class="label">Amount in Words</div><div>${esc(amountInWords(po.amount))}</div></div>
      <table>
        <tr><th>Sub Total</th><td>${inr(split.taxableTotal)}</td></tr>
        ${
          intraState
            ? `<tr><th>CGST (${split.cgstRate.toFixed(1)}%)</th><td>${inr(split.cgstAmount)}</td></tr><tr><th>SGST (${split.sgstRate.toFixed(1)}%)</th><td>${inr(split.sgstAmount)}</td></tr>`
            : `<tr><th>IGST (${split.igstRate.toFixed(1)}%)</th><td>${inr(split.igstAmount)}</td></tr>`
        }
        <tr class="grand"><th>Total Amount</th><td>${inr(po.amount)}</td></tr>
      </table>
    </div>
    ${signatureBlock(settings)}
  </div>`);
}

// ---------- Actions ----------

// Render to a PDF file; returns { uri }. On the web preview, expo-print
// can only open the browser print dialog.
export async function makePdf(html) {
  if (Platform.OS === "web") {
    await Print.printAsync({ html });
    return null;
  }
  return Print.printToFileAsync({ html, base64: false });
}

export async function printHtml(html) {
  await Print.printAsync({ html });
}

// Opens the system share sheet with the PDF (WhatsApp, Gmail, Drive, …).
export async function sharePdf(html, filename) {
  const file = await makePdf(html);
  if (!file) return;
  let uri = file.uri;
  try {
    // Give the file a readable name instead of expo-print's random one.
    const FS = require("expo-file-system/legacy");
    const target = `${FS.cacheDirectory}${filename.replace(/[^\w.-]+/g, "-")}`;
    await FS.deleteAsync(target, { idempotent: true });
    await FS.moveAsync({ from: file.uri, to: target });
    uri = target;
  } catch (_) {
    // keep the original name
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: filename, UTI: "com.adobe.pdf" });
  }
}

// True when the client finished WhatsApp Business API setup (same test as
// the web SendWhatsAppButton).
export function whatsappApiReady(settings) {
  return Boolean(settings && settings.waStatus === "Enabled" && settings.waPhoneNumberId && settings.waAccessTokenSet && settings.waTemplateName);
}

// Sends the PDF through the client's WhatsApp Business account (server side).
export async function sendViaWhatsAppApi({ html, to, documentType, documentId, partyName, amount, filename }) {
  const file = await Print.printToFileAsync({ html, base64: true });
  return api.post("/api/whatsapp/send-document", {
    to,
    documentType,
    documentId,
    partyName,
    amount,
    filename,
    pdfBase64: file.base64,
  });
}

// Loads the settings + party record a document needs.
export async function loadDocContext(partyEndpoint, partyName) {
  const [settings, parties] = await Promise.all([
    api.get("/api/settings"),
    api.get(`${partyEndpoint}?page=1&pageSize=500`).catch(() => ({ data: [] })),
  ]);
  const party = ((parties && parties.data) || []).find((p) => p.name === partyName) || null;
  return { settings: settings || {}, party };
}
