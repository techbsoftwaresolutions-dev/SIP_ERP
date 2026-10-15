import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import { getStateCode, isIntraState } from "../../utils/gstStateCodes";
import { amountInWords } from "../../utils/numberToWords";
import { buildPdfBlob, downloadBlob, shareDocument } from "../../utils/share";
import { formatPhone } from "../../utils/formatPhone";
import Icon from "../../components/ui/Icon";
import { inr, num, taxSplit, groupByHsn, shippingLines } from "../../print/invoiceCalc";
import ThemedInvoiceSheet from "../../print/ThemedInvoiceSheet";
import Loader from "../../components/ui/Loader";
import SendWhatsAppButton from "../../components/share/SendWhatsAppButton";
import CopiesPicker from "../../components/share/CopiesPicker";
import { buildDocCsv, copyCount, copyLabelList, downloadCsvText } from "../../utils/docExport";


function DefaultInvoiceSheet({ copyLabel, invoice, customer, settings, intraState, sheetRef }) {
  // The invoice's own Place of Supply, not necessarily the customer's
  // registered state — see the note on the intraState computation below.
  const placeOfSupply = invoice.placeOfSupply || customer?.state || "";
  const stateCode = getStateCode(placeOfSupply);
  const hasBank = settings.bankName || settings.bankAccountNumber || settings.bankIfsc;
  const items = invoice.items || [];
  const split = taxSplit(invoice, intraState);
  const hsnRows = groupByHsn(items);
  const shipping = shippingLines(invoice, customer);

  return (
    <div ref={sheetRef} className="invoice-sheet format-default invoice-gst-sheet">
      <div className="gst-header">
        <div className="gst-header-left">
          {settings.logo && (
            <div className="gst-logo">
              <img src={settings.logo} alt="Company Logo" />
            </div>
          )}
          <div className="gst-company-info">
            <div className="gst-company-name">{(settings.companyName || "Your Company").toUpperCase()}</div>
            {settings.legalName && <div className="gst-company-legal">{settings.legalName}</div>}
            {settings.address && <div className="gst-company-address">{settings.address}</div>}
            <div className="gst-contact-row">
              {settings.phone && (
                <span><Icon name="phone" size={13} /> {formatPhone(settings.phone)}</span>
              )}
              {settings.email && (
                <span><Icon name="mail" size={13} /> {settings.email}</span>
              )}
              {settings.website && <span>🌐 {settings.website}</span>}
            </div>
          </div>
        </div>
        <div className="gst-header-right">
          <div className="gst-title">TAX INVOICE</div>
          <div className="gst-copy-tag">{copyLabel}</div>
        </div>
      </div>

      {settings.gstin && <div className="gst-gstin-row">GSTIN: {settings.gstin}</div>}
      <div className="gst-divider" />

      <div className="gst-meta-grid">
        <div className="gst-address-col">
          <div className="gst-billing-box">
            <div className="gst-box-label"><Icon name="user" size={13} /> Billing Address</div>
            <div className="gst-buyer-name">{invoice.customer}</div>
            {(invoice.address || customer?.address) && <div>{invoice.address || customer.address}</div>}
            <div>
              {[customer?.city, customer?.state].filter(Boolean).join(", ")}
              {customer?.pincode ? ` - ${customer.pincode}` : ""}
            </div>
            {(invoice.phone || customer?.phone) && <div>Phone: {formatPhone(invoice.phone || customer.phone)}</div>}
          </div>
          <div className="gst-shipping-box">
            <div className="gst-box-label"><Icon name="truck" size={13} /> Shipping Address</div>
            <div className="gst-buyer-name">{shipping.name}</div>
            {shipping.freeform ? (
              <div style={{ whiteSpace: "pre-line" }}>{shipping.freeform}</div>
            ) : (
              <>
                {shipping.line1 && <div>{shipping.line1}</div>}
                <div>{shipping.line2}</div>
                {shipping.phone && <div>Phone: {formatPhone(shipping.phone)}</div>}
              </>
            )}
          </div>
        </div>
        <table className="gst-details-table">
          <tbody>
            <tr><th>Invoice No</th><td>{invoice.id}</td></tr>
            <tr><th>Invoice Date</th><td>{invoice.date || "—"}</td></tr>
            <tr><th>Place of Supply</th><td>{placeOfSupply ? `${stateCode ? stateCode + "-" : ""}${placeOfSupply}` : "—"}</td></tr>
            <tr><th>PO Number</th><td>{invoice.poNumber || "—"}</td></tr>
            <tr><th>PO Date</th><td>{invoice.poDate || "—"}</td></tr>
            <tr><th>Transport Name</th><td>{invoice.transportName || "—"}</td></tr>
            <tr><th>Vehicle Number</th><td>{invoice.vehicleNo || "—"}</td></tr>
            <tr><th>Delivery Date</th><td>{invoice.deliveryDate || "—"}</td></tr>
            <tr><th>Delivery Location</th><td>{invoice.deliveryLocation || "—"}</td></tr>
            {invoice.eWayBillNo && <tr><th>E-Way Bill No</th><td>{invoice.eWayBillNo}</td></tr>}
            <tr><th>Due Date</th><td>{invoice.dueDate || "—"}</td></tr>
            <tr><th>Buyer's GSTIN</th><td>{customer?.gstNo || "—"}</td></tr>
          </tbody>
        </table>
      </div>

      <table className="gst-items-table">
        <thead>
          <tr>
            <th style={{ width: "30px" }}>#</th>
            <th>Description of Goods / Services</th>
            <th style={{ width: "62px" }}>HSN/SAC</th>
            <th style={{ width: "42px" }}>Qty</th>
            <th style={{ width: "42px" }}>Unit</th>
            <th style={{ width: "78px" }}>Rate (₹)</th>
            <th style={{ width: "46px" }}>Tax %</th>
            <th style={{ width: "96px" }}>Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr><td colSpan={8}>No items.</td></tr>
          ) : (
            items.map((it, idx) => (
              <tr key={idx}>
                <td>{idx + 1}</td>
                <td>{it.product}</td>
                <td>{it.hsnCode || "—"}</td>
                <td>{Number(it.quantity) || 0}</td>
                <td>{it.unit || "—"}</td>
                <td style={{ textAlign: "right" }}>{num(it.unitPrice)}</td>
                <td>{it.taxPercent || 0}%</td>
                <td style={{ textAlign: "right" }}>{num(it.amount)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {hsnRows.length > 0 && (
        <table className="gst-hsn-table">
          <thead>
            <tr>
              <th rowSpan={2}>HSN/SAC</th>
              <th rowSpan={2}>Taxable Amount</th>
              {intraState ? (
                <>
                  <th colSpan={2}>CGST</th>
                  <th colSpan={2}>SGST</th>
                </>
              ) : (
                <th colSpan={2}>IGST</th>
              )}
              <th rowSpan={2}>Total Tax</th>
            </tr>
            <tr>
              {intraState ? (
                <>
                  <th>Rate</th><th>Amount</th><th>Rate</th><th>Amount</th>
                </>
              ) : (
                <><th>Rate</th><th>Amount</th></>
              )}
            </tr>
          </thead>
          <tbody>
            {hsnRows.map((row) => (
              <tr key={row.hsnCode}>
                <td>{row.hsnCode}</td>
                <td style={{ textAlign: "right" }}>{num(row.taxable)}</td>
                {intraState ? (
                  <>
                    <td>{(row.rate / 2).toFixed(1)}%</td>
                    <td style={{ textAlign: "right" }}>{num(row.tax / 2)}</td>
                    <td>{(row.rate / 2).toFixed(1)}%</td>
                    <td style={{ textAlign: "right" }}>{num(row.tax / 2)}</td>
                  </>
                ) : (
                  <>
                    <td>{row.rate.toFixed(1)}%</td>
                    <td style={{ textAlign: "right" }}>{num(row.tax)}</td>
                  </>
                )}
                <td style={{ textAlign: "right" }}>{num(row.tax)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="gst-totals-row">
        <div className="gst-notes-col">
          <div className="gst-box-label">Amount in Words</div>
          <div>{amountInWords(invoice.amount)}</div>
          {invoice.paymentMode && <div style={{ marginTop: 8 }}><strong>Payment Mode:</strong> {invoice.paymentMode}
              {invoice.paymentReference ? ` (${invoice.paymentReference})` : ""}</div>}
          {invoice.notes && (
            <div className="gst-notes">
              <div className="gst-box-label">Notes:</div>
              <ol>
                {invoice.notes.split("\n").filter(Boolean).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
        <table className="gst-totals-table">
          <tbody>
            <tr><th>Sub Total</th><td>{inr(split.taxableTotal)}</td></tr>
            {intraState ? (
              <>
                <tr><th>CGST ({split.cgstRate.toFixed(1)}%)</th><td>{inr(split.cgstAmount)}</td></tr>
                <tr><th>SGST ({split.sgstRate.toFixed(1)}%)</th><td>{inr(split.sgstAmount)}</td></tr>
              </>
            ) : (
              <tr><th>IGST ({split.igstRate.toFixed(1)}%)</th><td>{inr(split.igstAmount)}</td></tr>
            )}
            {invoice.freightCharges > 0 && <tr><th>Freight Charges</th><td>{inr(invoice.freightCharges)}</td></tr>}
            <tr className="gst-total-row"><th>Total Amount</th><td>{inr(invoice.amount)}</td></tr>
            <tr><th>Paid Amount</th><td>{inr(invoice.paidAmount)}</td></tr>
            <tr className="gst-balance-row"><th>Balance Due</th><td>{inr(invoice.balance)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="gst-footer-row">
        {hasBank ? (
          <div className="gst-bank-box">
            <div className="gst-box-label"><Icon name="wallet" size={13} /> Bank Details</div>
            {settings.bankName && <div>Bank Name : {settings.bankName}</div>}
            {settings.bankAccountNumber && <div>Account No. : {settings.bankAccountNumber}</div>}
            {settings.bankIfsc && <div>IFSC Code : {settings.bankIfsc}</div>}
            {settings.bankAccountName && <div>Account Holder Name : {settings.bankAccountName}</div>}
          </div>
        ) : (
          <div />
        )}
        <div className="gst-signature-box">
          <div>For {settings.companyName || "Your Company"}</div>
          <div className="invoice-signature-stamp">
            {settings.seal && <img src={settings.seal} alt="Company Seal" className="invoice-seal" />}
            {settings.signature && <img src={settings.signature} alt="Authorized Signature" className="invoice-signature" />}
          </div>
          <div className="gst-signatory-label">Authorized Signatory</div>
        </div>
      </div>

      <div className="gst-thankyou-bar">Thank you for your business!</div>
    </div>
  );
}

export default function InvoicePrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");
  // Catalogue + which themes this client’s plan unlocks, and the theme they
  // saved. Seeding from the saved value is what stops the picker resetting to
  // the default on every print.
  const [themeInfo, setThemeInfo] = useState(null);
  const [theme, setTheme] = useState("billbook");
  const [showAllThemes, setShowAllThemes] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(""); // "" | "whatsapp" | "email"
  const sheetRefs = useRef([]);
  // How many copies Print / PDF / Word / Excel produce: Settings → General
  // sets the starting value, and the picker changes it for this preview.
  // Which copies are ticked (indexes into the label set); null = the default count from Settings.
  const [picked, setPicked] = useState(null);
  const labelSet = copyLabelList(settings);
  const selectedCopies = picked ?? labelSet.map((_, i) => i).slice(0, copyCount(settings, "invoiceCopies", 3));
  const copyLabels = selectedCopies.map((i) => labelSet[i]);
  const nCopies = copyLabels.length;
  
  const activeSheets = () => sheetRefs.current.slice(0, nCopies);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [inv, s, themes] = await Promise.all([
          api.get(`/api/sales/invoices/${encodeURIComponent(id)}`),
          api.get("/api/settings"),
          // Never let a theme lookup failure block printing an invoice.
          api.get("/api/invoice-themes").catch(() => null),
        ]);
        if (cancelled) return;
        setInvoice(inv);
        setSettings(s);
        if (themes) {
          setThemeInfo(themes);
          setTheme(themes.theme);
        }
        const custList = await api.get(`/api/customers?page=1&pageSize=500`);
        if (cancelled) return;
        const match = (custList.data || []).find((c) => c.name === inv.customer);
        setCustomer(match || null);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load invoice.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    if (!invoice || pdfBusy) return;
    setPdfBusy(true);
    try {
      const blob = await buildPdfBlob(activeSheets());
      downloadBlob(blob, `invoice-${invoice.id}.pdf`);
    } catch (err) {
      window.alert("Could not generate PDF: " + (err.message || "unknown error"));
    } finally {
      setPdfBusy(false);
    }
  };

  // Plain-text summary used when the target app can't take the PDF directly
  // (WhatsApp Web/desktop, mailto — neither accepts a file via URL), so the
  // recipient sees the key details while the user attaches the PDF that was
  // just downloaded for them.
  const shareSummaryText = () =>
    [
      `Tax Invoice ${invoice.id}`,
      `Customer: ${invoice.customer || "—"}`,
      `Date: ${invoice.date || "—"}`,
      `Total: ${inr(invoice.amount)}`,
      `From: ${settings?.companyName || "—"}`,
    ].join("\n");

  const handleShare = async (channel) => {
    if (!invoice || shareBusy) return;
    setShareBusy(channel);
    try {
      await shareDocument({
        sheetEl: activeSheets(),
        filename: `invoice-${invoice.id}.pdf`,
        title: `Tax Invoice ${invoice.id}`,
        text: shareSummaryText(),
        channel,
      });
    } catch (err) {
      window.alert("Could not share: " + (err.message || "unknown error"));
    } finally {
      setShareBusy("");
    }
  };

  // The invoice's own Place of Supply is what actually governs CGST+SGST vs
  // IGST — falls back to the customer's master state only for an invoice
  // saved before that field existed (see models/Invoice.js on the backend).
  // `invoice` is still null on the first render or two before it loads, so
  // this — unlike the same line inside DefaultInvoiceSheet, which only
  // mounts once `invoice` is guaranteed present — has to guard it too.
  const placeOfSupply = invoice?.placeOfSupply || customer?.state || "";
  const intraState = settings ? isIntraState(settings.gstin, placeOfSupply) : true;

  // Ten themes make the side panel taller than the invoice, so the list
  // collapses to the first few. The theme currently in use is always shown
  // even when it sits further down, otherwise the panel would hide what you
  // are actually looking at.
  const THEMES_COLLAPSED = 5;
  const allThemes = themeInfo ? themeInfo.themes : [];
  const canCollapseThemes = allThemes.length > THEMES_COLLAPSED;
  const visibleThemes = (() => {
    if (showAllThemes || !canCollapseThemes) return allThemes;
    const head = allThemes.slice(0, THEMES_COLLAPSED);
    if (head.some((t) => t.key === theme)) return head;
    const active = allThemes.find((t) => t.key === theme);
    return active ? [...head, active] : head;
  })();

  const handleDownloadWord = () => {
    if (!invoice) return;
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const stateCode = getStateCode(invoice.placeOfSupply || customer?.state || "");
    const items = invoice.items || [];
    const split = taxSplit(invoice, intraState);
    const hsnRows = groupByHsn(items);
    const shipping = shippingLines(invoice, customer);
    const shipText = shipping.freeform || [shipping.line1, shipping.line2].filter(Boolean).join(", ");
    const co = settings || {};
    const B = "1px solid #b4bec9";

    const td = (t, align = "left", extra = "") =>
      `<td style="border:${B};padding:5px 7px;text-align:${align};vertical-align:top;${extra}">${esc(t)}</td>`;
    const th = (t, align = "left") =>
      `<td style="border:${B};background:#eaf1fb;color:#14283f;font-weight:bold;padding:5px 7px;text-align:${align};">${esc(t)}</td>`;
    const lbl = (t) =>
      `<td style="border:${B};background:#f4f7fb;color:#333;font-weight:bold;padding:5px 7px;width:26%;vertical-align:top;">${esc(t)}</td>`;

    // ---- invoice meta (label / value) ----
    const meta = [
      ["Invoice No", invoice.id],
      ["Invoice Date", invoice.date || "—"],
      ["Place of Supply", invoice.placeOfSupply || customer?.state ? `${stateCode ? stateCode + "-" : ""}${invoice.placeOfSupply || customer.state}` : "—"],
      ["PO Number", invoice.poNumber || "—"],
      ["PO Date", invoice.poDate || "—"],
      ["Transport / Vehicle", [invoice.transportName, invoice.vehicleNo].filter(Boolean).join(" / ") || "—"],
      ["Delivery Date", invoice.deliveryDate || "—"],
      ["Due Date", invoice.dueDate || "—"],
      ["Buyer's GSTIN", customer?.gstNo || "—"],
    ];
    if (invoice.eWayBillNo) meta.push(["E-Way Bill No", invoice.eWayBillNo]);
    const metaTable = `<table style="border-collapse:collapse;width:100%;table-layout:fixed;font-size:9pt;margin:8pt 0;">
      ${meta.map(([k, v]) => `<tr>${lbl(k)}${td(v)}</tr>`).join("")}
    </table>`;

    // ---- line items ----
    const itemsTable = `<table style="border-collapse:collapse;width:100%;table-layout:fixed;font-size:9pt;margin:8pt 0;">
      <colgroup><col style="width:4%"><col style="width:30%"><col style="width:11%"><col style="width:8%"><col style="width:8%"><col style="width:13%"><col style="width:8%"><col style="width:18%"></colgroup>
      <tr>${th("#", "center")}${th("Description of Goods / Services")}${th("HSN/SAC")}${th("Qty", "right")}${th("Unit", "center")}${th("Rate", "right")}${th("Tax %", "right")}${th("Amount", "right")}</tr>
      ${
        items.length === 0
          ? `<tr><td colspan="8" style="border:${B};padding:8px;text-align:center;font-style:italic;color:#666;">No items.</td></tr>`
          : items
              .map(
                (it, i) =>
                  `<tr>${td(i + 1, "center")}${td(it.product || "—")}${td(it.hsnCode || "—")}` +
                  `${td(Number(it.quantity) || 0, "right")}${td(it.unit || "—", "center")}` +
                  `${td(num(it.unitPrice), "right")}${td(`${it.taxPercent || 0}%`, "right")}${td(num(it.amount), "right")}</tr>`
              )
              .join("")
      }
    </table>`;

    // ---- HSN-wise tax breakdown ----
    const hsnTable = hsnRows.length
      ? `<table style="border-collapse:collapse;width:100%;table-layout:fixed;font-size:9pt;margin:8pt 0;">
          ${
            intraState
              ? `<tr>${th("HSN/SAC")}${th("Taxable Amount", "right")}${th("CGST Rate", "right")}${th("CGST Amt", "right")}${th("SGST Rate", "right")}${th("SGST Amt", "right")}${th("Total Tax", "right")}</tr>`
              : `<tr>${th("HSN/SAC")}${th("Taxable Amount", "right")}${th("IGST Rate", "right")}${th("IGST Amt", "right")}${th("Total Tax", "right")}</tr>`
          }
          ${hsnRows
            .map((r) =>
              intraState
                ? `<tr>${td(r.hsnCode)}${td(num(r.taxable), "right")}${td(`${(r.rate / 2).toFixed(1)}%`, "right")}${td(num(r.tax / 2), "right")}${td(`${(r.rate / 2).toFixed(1)}%`, "right")}${td(num(r.tax / 2), "right")}${td(num(r.tax), "right")}</tr>`
                : `<tr>${td(r.hsnCode)}${td(num(r.taxable), "right")}${td(`${r.rate.toFixed(1)}%`, "right")}${td(num(r.tax), "right")}${td(num(r.tax), "right")}</tr>`
            )
            .join("")}
        </table>`
      : "";

    // ---- amount-in-words + totals side by side ----
    const totRow = (k, v, strong) =>
      `<tr><td style="border:${B};padding:5px 7px;${strong ? "font-weight:bold;background:#eaf1fb;" : ""}">${esc(k)}</td>` +
      `<td style="border:${B};padding:5px 7px;text-align:right;${strong ? "font-weight:bold;background:#eaf1fb;" : ""}">${esc(v)}</td></tr>`;
    const totalsTable = `<table style="border-collapse:collapse;width:100%;table-layout:fixed;font-size:9pt;">
      <colgroup><col style="width:55%"><col style="width:45%"></colgroup>
      ${totRow("Sub Total", inr(split.taxableTotal))}
      ${
        intraState
          ? totRow(`CGST (${split.cgstRate.toFixed(1)}%)`, inr(split.cgstAmount)) + totRow(`SGST (${split.sgstRate.toFixed(1)}%)`, inr(split.sgstAmount))
          : totRow(`IGST (${split.igstRate.toFixed(1)}%)`, inr(split.igstAmount))
      }
      ${invoice.freightCharges > 0 ? totRow("Freight Charges", inr(invoice.freightCharges)) : ""}
      ${totRow("Total Amount", inr(invoice.amount), true)}
      ${totRow("Paid Amount", inr(invoice.paidAmount))}
      ${totRow("Balance Due", inr(invoice.balance), true)}
    </table>`;

    const notesHtml = invoice.notes
      ? `<div style="font-weight:bold;margin-top:6pt;">Notes:</div><ol style="margin:2pt 0 0;padding-left:16pt;">${invoice.notes
          .split("\n")
          .filter(Boolean)
          .map((l) => `<li>${esc(l)}</li>`)
          .join("")}</ol>`
      : "";

    const summaryBlock = `<table style="border-collapse:collapse;width:100%;table-layout:fixed;font-size:9pt;margin:8pt 0;">
      <colgroup><col style="width:52%"><col style="width:48%"></colgroup>
      <tr>
        <td style="vertical-align:top;padding-right:12pt;">
          <div style="font-weight:bold;">Amount in Words</div>
          <div>${esc(amountInWords(invoice.amount))}</div>
          ${invoice.paymentMode ? `<div style="margin-top:6pt;"><b>Payment Mode:</b> ${esc(invoice.paymentMode)}${invoice.paymentReference ? ` (${esc(invoice.paymentReference)})` : ""}</div>` : ""}
          ${notesHtml}
        </td>
        <td style="vertical-align:top;">${totalsTable}</td>
      </tr>
    </table>`;

    const hasBank = co.bankName || co.bankAccountNumber || co.bankIfsc;
    const footerBlock = `<table style="border-collapse:collapse;width:100%;table-layout:fixed;font-size:9pt;margin-top:10pt;">
      <colgroup><col style="width:60%"><col style="width:40%"></colgroup>
      <tr>
        <td style="vertical-align:top;">
          ${
            hasBank
              ? `<div style="font-weight:bold;">Bank Details</div>` +
                (co.bankName ? `<div>Bank Name : ${esc(co.bankName)}</div>` : "") +
                (co.bankAccountNumber ? `<div>Account No. : ${esc(co.bankAccountNumber)}</div>` : "") +
                (co.bankIfsc ? `<div>IFSC Code : ${esc(co.bankIfsc)}</div>` : "") +
                (co.bankAccountName ? `<div>Account Holder : ${esc(co.bankAccountName)}</div>` : "")
              : ""
          }
        </td>
        <td style="vertical-align:top;text-align:right;">
          <div>For ${esc(co.companyName || "Your Company")}</div>
          <div style="height:44pt;"></div>
          <div>Authorized Signatory</div>
        </td>
      </tr>
    </table>`;

    const billLine1 = invoice.address || customer?.address || "";
    const billLine2 = [customer?.city, customer?.state].filter(Boolean).join(", ") + (customer?.pincode ? ` - ${customer.pincode}` : "");
    const billPhone = invoice.phone || customer?.phone ? `<br>Phone: ${esc(formatPhone(invoice.phone || customer.phone))}` : "";
    const addrCell = (heading, lines) =>
      `<td style="border:${B};padding:5px 7px;vertical-align:top;"><b>${esc(heading)}</b><br>${lines
        .filter(Boolean)
        .map((l) => esc(l))
        .join("<br>")}${heading === "Billing Address" ? billPhone : ""}</td>`;
    const addressBlock = `<table style="border-collapse:collapse;width:100%;table-layout:fixed;font-size:9pt;margin:6pt 0;">
      <colgroup><col style="width:50%"><col style="width:50%"></colgroup>
      <tr>
        ${addrCell("Billing Address", [invoice.customer, billLine1, billLine2])}
        ${addrCell("Shipping Address", [shipping.name, shipText || billLine1])}
      </tr>
    </table>`;

    const copySection = (label) => `
      <table style="border-collapse:collapse;width:100%;table-layout:fixed;">
        <colgroup><col style="width:64%"><col style="width:36%"></colgroup>
        <tr>
          <td style="vertical-align:top;">
            <div style="font-size:14pt;font-weight:bold;color:#14283f;">${esc((co.companyName || "Your Company").toUpperCase())}</div>
            ${co.legalName ? `<div>${esc(co.legalName)}</div>` : ""}
            ${co.address ? `<div>${esc(co.address)}</div>` : ""}
            <div>${[co.phone ? `Contact: ${formatPhone(co.phone)}` : "", co.email ? `Email: ${esc(co.email)}` : ""].filter(Boolean).join("  |  ")}</div>
            ${co.gstin ? `<div>GSTIN: ${esc(co.gstin)}</div>` : ""}
          </td>
          <td style="vertical-align:top;text-align:right;">
            <div style="font-size:16pt;font-weight:bold;color:#14283f;">TAX INVOICE</div>
            <div style="color:#17b6d9;font-weight:bold;">${esc(label)}</div>
          </td>
        </tr>
      </table>
      <hr style="border:none;border-top:2px solid #14283f;margin:6pt 0;">
      ${addressBlock}
      ${metaTable}
      ${itemsTable}
      ${hsnTable}
      ${summaryBlock}
      ${footerBlock}`;

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <title>Invoice ${esc(invoice.id)}</title>
        <style>
          @page Section1 { size:21cm 29.7cm; mso-page-orientation:portrait; margin:1.4cm 1.3cm; }
          div.Section1 { page:Section1; }
          body { font-family:Arial, sans-serif; font-size:10pt; color:#1e1e1e; }
          table, td { mso-border-alt:solid #b4bec9 .5pt; }
        </style>
      </head>
      <body>
        ${copyLabels.map(
          (label, i) =>
            `<div class="Section1"${i > 0 ? ' style="page-break-before:always;"' : ""}>${copySection(label)}</div>`
        ).join("")}
      </body>
      </html>`;
    const blob = new Blob(["﻿", html], { type: "application/msword" });
    downloadBlob(blob, `invoice-${invoice.id}.doc`);
  };

  // One copy only: a CSV is data, not a printout, so copies make no sense.
  const handleDownloadCsv = () => {
    if (!invoice) return;
    const csv = buildDocCsv({
      title: `Tax Invoice ${invoice.id}`,
      meta: [
        ["Invoice No", invoice.id],
        ["Date", invoice.date],
        ["Due Date", invoice.dueDate],
        ["Customer", invoice.customer],
        ["Address", invoice.address],
        ["Phone", invoice.phone],
        ["Place of Supply", placeOfSupply],
        ["PO Number", invoice.poNumber],
        ["Payment Mode", invoice.paymentMode],
        ["Status", invoice.status],
      ],
      columns: [
        { header: "#", get: (_, i) => i + 1 },
        { header: "Item", get: (it) => it.product },
        { header: "HSN/SAC", get: (it) => it.hsnCode },
        { header: "Qty", get: (it) => it.quantity },
        { header: "Unit", get: (it) => it.unit },
        { header: "Unit Price", get: (it) => it.unitPrice },
        { header: "Tax %", get: (it) => it.taxPercent },
        { header: "Amount", get: (it) => it.amount },
      ],
      items: invoice.items || [],
      totals: [
        ["Sub Total", invoice.subTotal],
        ["Tax", invoice.taxTotal],
        ["Freight", invoice.freightCharges],
        ["Total", invoice.amount],
        ["Paid", invoice.paidAmount],
        ["Balance", invoice.balance],
      ],
    });
    downloadCsvText(csv, `invoice-${invoice.id}.csv`);
  };

  const handleDownloadExcel = () => {
    if (!invoice) return;
    const stateCode = getStateCode(invoice.placeOfSupply || customer?.state || "");
    const items = invoice.items || [];
    const split = taxSplit(invoice, intraState);
    const shipping = shippingLines(invoice, customer);
    const shippingAddressText = shipping.freeform || [shipping.line1, shipping.line2].filter(Boolean).join(", ");

    const cell = (value, opts = {}) => {
      const { bold, right, colspan, bg } = opts;
      const isNum = typeof value === "number";
      const styles = [
        "border:1px solid #cccccc",
        "padding:5px 10px",
        "font-family:Arial,sans-serif",
        "font-size:12px",
        right || isNum ? "text-align:right" : "text-align:left",
        bold ? "font-weight:bold" : "",
        bg ? `background:${bg}` : "",
        isNum ? "mso-number-format:'\\#\\,\\#\\#0.00'" : "mso-number-format:'\\@'",
      ]
        .filter(Boolean)
        .join(";");
      return `<td${colspan ? ` colspan="${colspan}"` : ""} style="${styles}">${value ?? ""}</td>`;
    };
    const row = (cells) => `<tr>${cells}</tr>`;
    const labelRow = (k, v) => row(cell(k, { bold: true }) + cell(v, { colspan: 2 }));
    const blankRow = () => row(cell("", { colspan: 3 }));

    const copySection = (label) => {
      const parts = [];
      parts.push(row(cell(`TAX INVOICE — ${label}`, { bold: true, colspan: 3, bg: "#1c222c" })));
      parts.push(blankRow());
      parts.push(labelRow("Invoice No", invoice.id));
      parts.push(labelRow("Invoice Date", invoice.date || "—"));
      parts.push(labelRow("Customer", invoice.customer || "—"));
      parts.push(labelRow("Billing Address", invoice.address || customer?.address || "—"));
      parts.push(labelRow("Shipping Address", shippingAddressText || "—"));
      parts.push(labelRow("PO Number", invoice.poNumber || "—"));
      parts.push(labelRow("Transport Name", invoice.transportName || "—"));
      parts.push(labelRow("Vehicle Number", invoice.vehicleNo || "—"));
      parts.push(labelRow("Due Date", invoice.dueDate || "—"));
      parts.push(labelRow("Buyer's GSTIN", customer?.gstNo || "—"));
      parts.push(labelRow("State Code", stateCode || "—"));
      parts.push(blankRow());
      parts.push(
        row(
          cell("#", { bold: true, bg: "#eef4ff" }) +
            cell("Description", { bold: true, bg: "#eef4ff" }) +
            cell("HSN/SAC", { bold: true, bg: "#eef4ff" }) +
            cell("Qty", { bold: true, right: true, bg: "#eef4ff" }) +
            cell("Unit Price", { bold: true, right: true, bg: "#eef4ff" }) +
            cell("Amount", { bold: true, right: true, bg: "#eef4ff" })
        )
      );
      items.forEach((it, i) => {
        parts.push(
          row(
            cell(i + 1) +
              cell(it.product || "—") +
              cell(it.hsnCode || "—") +
              cell(it.quantity || 0, { right: true }) +
              cell(it.unitPrice || 0, { right: true }) +
              cell(it.amount || 0, { right: true })
          )
        );
      });
      parts.push(blankRow());
      parts.push(row(cell("Sub Total", { colspan: 2 }) + cell(split.taxableTotal, { right: true })));
      if (intraState) {
        parts.push(row(cell(`CGST (${split.cgstRate.toFixed(1)}%)`, { colspan: 2 }) + cell(split.cgstAmount, { right: true })));
        parts.push(row(cell(`SGST (${split.sgstRate.toFixed(1)}%)`, { colspan: 2 }) + cell(split.sgstAmount, { right: true })));
      } else {
        parts.push(row(cell(`IGST (${split.igstRate.toFixed(1)}%)`, { colspan: 2 }) + cell(split.igstAmount, { right: true })));
      }
      if (invoice.freightCharges > 0) {
        parts.push(row(cell("Freight Charges", { colspan: 2 }) + cell(invoice.freightCharges, { right: true })));
      }
      parts.push(row(cell("Total Amount", { bold: true, colspan: 2 }) + cell(invoice.amount || 0, { right: true, bold: true })));
      parts.push(row(cell("Paid Amount", { colspan: 2 }) + cell(invoice.paidAmount || 0, { right: true })));
      parts.push(row(cell("Balance Due", { bold: true, colspan: 2, bg: "#17b6d9" }) + cell(invoice.balance || 0, { right: true, bold: true, bg: "#17b6d9" })));
      if (invoice.notes) {
        parts.push(blankRow());
        parts.push(row(cell("Notes", { bold: true, colspan: 3 })));
        invoice.notes.split("\n").filter(Boolean).forEach((line) => {
          parts.push(row(cell(`• ${line}`, { colspan: 3 })));
        });
      }
      parts.push(blankRow());
      parts.push(blankRow());
      return parts.join("");
    };

    const colgroup = `<colgroup><col style="width:180px"><col style="width:280px"><col style="width:160px"></colgroup>`;
    const table = `<table style="border-collapse:collapse;">${colgroup}${copyLabels.map(copySection).join("")}</table>`;
    const html = `<html><head><meta charset="utf-8"></head><body>${table}</body></html>`;
    const blob = new Blob(["﻿", html], { type: "application/vnd.ms-excel" });
    downloadBlob(blob, `invoice-${invoice.id}.xls`);
  };

  if (error) {
    return (
      <div className="invoice-print-page">
        <div className="invoice-toolbar no-print">
          <button type="button" className="btn" onClick={() => navigate(-1)}>‹ Back</button>
        </div>
        <div className="loading-row">{error}</div>
      </div>
    );
  }

  if (!invoice || !settings) {
    return (
      <div className="invoice-print-page">
        <div className="loading-row"><Loader /></div>
      </div>
    );
  }

  return (
    <div className="invoice-print-page">
      <div className="invoice-toolbar no-print">
        <button type="button" className="btn" onClick={() => navigate(-1)}>‹ Back</button>
      </div>

      <div className="invoice-print-layout">
        <div className="invoice-side-panel no-print">
          <div>
            <div className="invoice-side-panel-title">Invoice Theme</div>
            <div className="invoice-format-list">
              {visibleThemes.map((t) => {
                const locked = !themeInfo.allowed.includes(t.key);
                return (
                  <button
                    key={t.key}
                    type="button"
                    className={`invoice-format-option${theme === t.key ? " active" : ""}${locked ? " locked" : ""}`}
                    onClick={() => !locked && setTheme(t.key)}
                    disabled={locked}
                    title={locked ? `${t.label} needs a higher plan` : t.description}
                  >
                    <span className={`invoice-format-swatch fam-${t.family}`} />
                    <span className="invoice-format-label">{t.label}</span>
                    {locked && <Icon name="lock" size={13} />}
                  </button>
                );
              })}
            </div>
            {canCollapseThemes && (
              <button
                type="button"
                className="invoice-theme-toggle"
                onClick={() => setShowAllThemes((v) => !v)}
              >
                <Icon name={showAllThemes ? "chevronUp" : "chevronDown"} size={14} />
                {showAllThemes ? "Show less" : `Show all ${allThemes.length} themes`}
              </button>
            )}
            {themeInfo && themeInfo.allowed.length < themeInfo.themes.length && (
              <div className="invoice-theme-upsell">
                {themeInfo.themes.length - themeInfo.allowed.length} more themes on a higher plan.
              </div>
            )}
          </div>

          <div className="invoice-side-divider" />

          <CopiesPicker labels={labelSet} selected={selectedCopies} onChange={setPicked} />

          <div className="invoice-side-divider" />

          <div>
            <div className="invoice-side-panel-title">Print</div>
            <div className="invoice-action-group">
              <button type="button" className="btn btn-primary invoice-print-btn" onClick={handlePrint}>
                <Icon name="printer" size={16} /> Print ({nCopies} {nCopies === 1 ? "copy" : "copies"})
              </button>
            </div>
          </div>

          <div className="invoice-side-divider" />

          <div>
            <div className="invoice-side-panel-title">Download</div>
            <div className="invoice-action-group">
              <button type="button" className="btn invoice-download-btn" onClick={handleDownloadPDF} disabled={pdfBusy}>
                {pdfBusy ? "Generating…" : <><Icon name="download" size={15} /> PDF</>}
              </button>
              <button type="button" className="btn invoice-download-btn" onClick={handleDownloadWord}><Icon name="download" size={15} /> Word</button>
              <button type="button" className="btn invoice-download-btn" onClick={handleDownloadExcel}><Icon name="download" size={15} /> Excel</button>
              <button type="button" className="btn invoice-download-btn" onClick={handleDownloadCsv}><Icon name="download" size={15} /> CSV</button>
            </div>
          </div>

          <div className="invoice-side-divider" />

          <div>
            <div className="invoice-side-panel-title">Share</div>
            <div className="invoice-action-group">
              <button type="button" className="btn invoice-download-btn" onClick={() => handleShare("whatsapp")} disabled={!!shareBusy}>
                {shareBusy === "whatsapp" ? "Preparing…" : <><Icon name="whatsapp" size={15} /> WhatsApp</>}
              </button>
              <button type="button" className="btn invoice-download-btn" onClick={() => handleShare("email")} disabled={!!shareBusy}>
                {shareBusy === "email" ? "Preparing…" : <><Icon name="mail" size={15} /> Email</>}
              </button>
              <SendWhatsAppButton
                settings={settings}
                getSheet={() => activeSheets()}
                documentType="invoice"
                documentLabel="Invoice"
                documentId={invoice.id}
                partyName={invoice.customer}
                amount={invoice.amount}
                defaultPhone={invoice.phone || customer?.phone}
                filename={`invoice-${invoice.id}.pdf`}
              />
            </div>
          </div>
        </div>

        <div className="invoice-sheets-col">
          {copyLabels.map((label, i) => {
            const common = {
              copyLabel: label,
              invoice,
              customer,
              settings,
              intraState,
              sheetRef: (el) => (sheetRefs.current[i] = el),
            };
            // Billbook keeps its original, battle-tested renderer because it is
            // what clients already print. Everything else, Simple included, goes
            // through the parametric sheet.
            if (theme === "billbook") return <DefaultInvoiceSheet key={label} {...common} />;
            const desc = themeInfo && themeInfo.themes.find((t) => t.key === theme);
            if (!desc) return <DefaultInvoiceSheet key={label} {...common} />;
            return <ThemedInvoiceSheet key={label} {...common} theme={desc} accent={themeInfo.accent} />;
          })}
        </div>
      </div>
    </div>
  );
}
