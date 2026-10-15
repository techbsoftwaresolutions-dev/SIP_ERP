import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import { getStateCode, isIntraState } from "../../utils/gstStateCodes";
import { amountInWords } from "../../utils/numberToWords";
import { buildPdfBlob, downloadBlob, shareDocument } from "../../utils/share";
import { formatPhone } from "../../utils/formatPhone";
import Icon from "../../components/ui/Icon";
import { inr } from "./PurchaseOrderForm";
import Loader from "../../components/ui/Loader";
import SendWhatsAppButton from "../../components/share/SendWhatsAppButton";
import CopiesPicker from "../../components/share/CopiesPicker";
import { buildDocCsv, copyCount, copyLabelList, downloadCsvText } from "../../utils/docExport";


function num(n) {
  return (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Same tax-split logic as the Invoice print — computed at print time from
// the actual supplier/company state, never stored, so it's always accurate.
function taxSplit(items, intraState) {
  const taxTotal = items.reduce((a, i) => a + ((i.amount || 0) - (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0)), 0);
  const taxableTotal = items.reduce((a, i) => a + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const avgRate = taxableTotal > 0 ? (taxTotal / taxableTotal) * 100 : 0;
  if (intraState) {
    return { cgstRate: avgRate / 2, cgstAmount: taxTotal / 2, sgstRate: avgRate / 2, sgstAmount: taxTotal / 2, igstRate: 0, igstAmount: 0, taxTotal, taxableTotal };
  }
  return { cgstRate: 0, cgstAmount: 0, sgstRate: 0, sgstAmount: 0, igstRate: avgRate, igstAmount: taxTotal, taxTotal, taxableTotal };
}

function groupByHsn(items) {
  const map = new Map();
  (items || []).forEach((i) => {
    const key = i.hsnCode || "—";
    const taxable = (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0);
    const tax = (i.amount || 0) - taxable;
    const rate = taxable > 0 ? (tax / taxable) * 100 : Number(i.taxPercent) || 0;
    if (!map.has(key)) map.set(key, { hsnCode: key, taxable: 0, tax: 0, rate });
    const row = map.get(key);
    row.taxable += taxable;
    row.tax += tax;
  });
  return Array.from(map.values());
}

export default function PurchaseOrderPrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [po, setPo] = useState(null);
  const [supplier, setSupplier] = useState(null);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(""); // "" | "whatsapp" | "email"
  const sheetRefs = useRef([]);
  // Copies for Print / PDF / Word: Settings → General gives the starting
  // value, the picker changes it for this preview.
  // Which copies are ticked (indexes into the label set); null = the default count from Settings.
  const [picked, setPicked] = useState(null);
  const labelSet = copyLabelList(settings);
  const selectedCopies = picked ?? labelSet.map((_, i) => i).slice(0, copyCount(settings, "purchaseOrderCopies", 1));
  const copyLabels = selectedCopies.map((i) => labelSet[i]);
  const nCopies = copyLabels.length;
  
  const activeSheets = () => sheetRefs.current.slice(0, nCopies);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [order, s] = await Promise.all([
          api.get(`/api/purchase-orders/${encodeURIComponent(id)}`),
          api.get("/api/settings"),
        ]);
        if (cancelled) return;
        setPo(order);
        setSettings(s);
        const supList = await api.get("/api/suppliers?page=1&pageSize=500");
        if (cancelled) return;
        const match = (supList.data || []).find((sp) => sp.name === order.supplier);
        setSupplier(match || null);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load purchase order.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    if (!po || !activeSheets().length || pdfBusy) return;
    setPdfBusy(true);
    try {
      const blob = await buildPdfBlob(activeSheets());
      downloadBlob(blob, `${po.id}.pdf`);
    } catch (err) {
      window.alert("Could not generate PDF: " + (err.message || "unknown error"));
    } finally {
      setPdfBusy(false);
    }
  };

  // Plain-text summary used when the target app can't take the PDF directly
  // (e.g. WhatsApp Web/desktop mailto — neither accepts a file via URL), so
  // the recipient at least sees the key details while the user attaches the
  // PDF that was just downloaded for them.
  const shareSummaryText = () =>
    [
      `Purchase Order ${po.id}`,
      `Supplier: ${po.supplier || "—"}`,
      `Date: ${po.orderDate || "—"}`,
      `Total: ${inr(po.amount)}`,
      `From: ${settings.companyName || "—"}`,
    ].join("\n");

  const handleShare = async (channel) => {
    if (!po || !activeSheets().length || shareBusy) return;
    setShareBusy(channel);
    try {
      await shareDocument({
        sheetEl: activeSheets(),
        filename: `${po.id}.pdf`,
        title: `Purchase Order ${po.id}`,
        text: shareSummaryText(),
        channel,
      });
    } catch (err) {
      window.alert("Could not share: " + (err.message || "unknown error"));
    } finally {
      setShareBusy("");
    }
  };

  const intraState = settings ? isIntraState(settings.gstin, supplier?.state) : true;
  const items = po?.items || [];
  const split = taxSplit(items, intraState);
  const hsnRows = groupByHsn(items);

  const handleDownloadWord = () => {
    if (!po) return;
    const stateCode = getStateCode(supplier?.state);
    const rows = [
      ["PO Number", po.id],
      ["PO Date", po.orderDate || "—"],
      ["Delivery Date", po.expectedDate || "—"],
      ["Payment Terms", po.paymentTerms || "—"],
      ["Supplier's GSTIN", supplier?.gstNo || "—"],
      ["State Code", stateCode || "—"],
    ];
    const taxRows = intraState
      ? `<tr><td style="padding:4px;">CGST (${split.cgstRate.toFixed(1)}%)</td><td style="padding:4px;text-align:right;">${inr(split.cgstAmount)}</td></tr>
         <tr><td style="padding:4px;">SGST (${split.sgstRate.toFixed(1)}%)</td><td style="padding:4px;text-align:right;">${inr(split.sgstAmount)}</td></tr>`
      : `<tr><td style="padding:4px;">IGST (${split.igstRate.toFixed(1)}%)</td><td style="padding:4px;text-align:right;">${inr(split.igstAmount)}</td></tr>`;
    const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>Purchase Order ${po.id}</title></head>
      <body style="font-family:Arial,sans-serif;font-size:13px;color:#111;">
        ${copyLabels.map((label, i) => `${i > 0 ? '<br clear="all" style="page-break-before:always" />' : ""}<div>
        <h2 style="margin-bottom:0;">PURCHASE ORDER <span style="font-size:12px;color:#17b6d9;">${label}</span></h2>
        <p style="color:#666;margin-top:2px;">${settings?.companyName || "Your Company"}</p>
        <table style="border-collapse:collapse;width:100%;margin:12px 0;">
          ${rows.map(([k, v]) => `<tr><td style="border:1px solid #ccc;padding:6px;font-weight:bold;width:40%;">${k}</td><td style="border:1px solid #ccc;padding:6px;">${v}</td></tr>`).join("")}
        </table>
        <table style="border-collapse:collapse;width:100%;margin:12px 0;">
          <tr>
            <th style="border:1px solid #ccc;padding:6px;text-align:left;">#</th>
            <th style="border:1px solid #ccc;padding:6px;text-align:left;">Description</th>
            <th style="border:1px solid #ccc;padding:6px;text-align:left;">HSN/SAC</th>
            <th style="border:1px solid #ccc;padding:6px;text-align:right;">Qty</th>
            <th style="border:1px solid #ccc;padding:6px;text-align:right;">Unit Price</th>
            <th style="border:1px solid #ccc;padding:6px;text-align:right;">Amount</th>
          </tr>
          ${items
            .map(
              (it, i) => `<tr>
            <td style="border:1px solid #ccc;padding:6px;">${i + 1}</td>
            <td style="border:1px solid #ccc;padding:6px;">${it.product || "—"}</td>
            <td style="border:1px solid #ccc;padding:6px;">${it.hsnCode || "—"}</td>
            <td style="border:1px solid #ccc;padding:6px;text-align:right;">${it.quantity || 0}</td>
            <td style="border:1px solid #ccc;padding:6px;text-align:right;">${num(it.unitPrice)}</td>
            <td style="border:1px solid #ccc;padding:6px;text-align:right;">${inr(it.amount)}</td>
          </tr>`
            )
            .join("")}
        </table>
        <p><strong>Amount in Words:</strong> ${amountInWords(po.amount)}</p>
        <table style="border-collapse:collapse;width:50%;margin-left:auto;">
          <tr><td style="padding:4px;">Sub Total</td><td style="padding:4px;text-align:right;">${inr(split.taxableTotal)}</td></tr>
          ${taxRows}
          <tr><td style="padding:4px;font-weight:bold;">Total Amount</td><td style="padding:4px;text-align:right;font-weight:bold;">${inr(po.amount)}</td></tr>
        </table>
        </div>`).join("")}
      </body></html>`;
    const blob = new Blob(["﻿", html], { type: "application/msword" });
    downloadBlob(blob, `${po.id}.doc`);
  };

  // One copy only: a CSV is data, not a printout, so copies make no sense.
  const handleDownloadCsv = () => {
    if (!po) return;
    const csv = buildDocCsv({
      title: `Purchase Order ${po.id}`,
      meta: [
        ["PO Number", po.id],
        ["PO Date", po.orderDate],
        ["Delivery Date", po.expectedDate],
        ["Supplier", po.supplier],
        ["Supplier's GSTIN", supplier?.gstNo],
        ["Payment Terms", po.paymentTerms],
        ["Status", po.status],
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
      items,
      totals: [
        ["Sub Total", split.taxableTotal],
        ["Tax", split.taxTotal],
        ["Total", po.amount],
      ],
    });
    downloadCsvText(csv, `purchase-order-${po.id}.csv`);
  };

  const handleDownloadExcel = () => {
    if (!po) return;
    const stateCode = getStateCode(supplier?.state);
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

    const parts = [];
    parts.push(row(cell(`PURCHASE ORDER — ${po.id}`, { bold: true, colspan: 3, bg: "#1c222c" })));
    parts.push(blankRow());
    parts.push(labelRow("PO Number", po.id));
    parts.push(labelRow("PO Date", po.orderDate || "—"));
    parts.push(labelRow("Supplier", po.supplier || "—"));
    parts.push(labelRow("Delivery Date", po.expectedDate || "—"));
    parts.push(labelRow("Payment Terms", po.paymentTerms || "—"));
    parts.push(labelRow("Supplier's GSTIN", supplier?.gstNo || "—"));
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
          cell(i + 1) + cell(it.product || "—") + cell(it.hsnCode || "—") + cell(it.quantity || 0, { right: true }) + cell(it.unitPrice || 0, { right: true }) + cell(it.amount || 0, { right: true })
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
    parts.push(row(cell("Total Amount", { bold: true, colspan: 2 }) + cell(po.amount || 0, { right: true, bold: true, bg: "#17b6d9" })));

    const colgroup = `<colgroup><col style="width:180px"><col style="width:280px"><col style="width:160px"></colgroup>`;
    const table = `<table style="border-collapse:collapse;">${colgroup}${parts.join("")}</table>`;
    const html = `<html><head><meta charset="utf-8"></head><body>${table}</body></html>`;
    const blob = new Blob(["﻿", html], { type: "application/vnd.ms-excel" });
    downloadBlob(blob, `${po.id}.xls`);
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

  if (!po || !settings) {
    return (
      <div className="invoice-print-page">
        <div className="loading-row"><Loader /></div>
      </div>
    );
  }

  const stateCode = getStateCode(supplier?.state);
  const hasBank = settings.bankName || settings.bankAccountNumber || settings.bankIfsc;

  return (
    <div className="invoice-print-page">
      <div className="invoice-toolbar no-print">
        <button type="button" className="btn" onClick={() => navigate(-1)}>‹ Back</button>
      </div>

      <div className="invoice-print-layout">
        <div className="invoice-side-panel no-print">
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
                documentType="purchase-order"
                documentLabel="Purchase Order"
                documentId={po.id}
                partyName={po.supplier}
                amount={po.amount}
                defaultPhone={supplier?.phone}
                filename={`purchase-order-${po.id}.pdf`}
              />
            </div>
          </div>
        </div>

        <div className="invoice-sheets-col">
          {copyLabels.map((copyLabel, copyIdx) => (
          <div key={copyLabel} ref={(el) => (sheetRefs.current[copyIdx] = el)} className="invoice-sheet format-default invoice-gst-sheet">
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
                    {settings.phone && <span><Icon name="phone" size={13} /> {formatPhone(settings.phone)}</span>}
                    {settings.email && <span><Icon name="mail" size={13} /> {settings.email}</span>}
                    {settings.website && <span>🌐 {settings.website}</span>}
                  </div>
                </div>
              </div>
              <div className="gst-header-right">
                <div className="gst-title" style={{ fontSize: "21px" }}>PURCHASE ORDER</div>
                <div className="gst-copy-tag">{copyLabel}</div>
              </div>
            </div>

            {settings.gstin && <div className="gst-gstin-row">GSTIN: {settings.gstin}</div>}
            <div className="gst-divider" />

            <div className="gst-meta-grid">
              <div className="gst-billing-box">
                <div className="gst-box-label"><Icon name="truck" size={13} /> Supplier</div>
                <div className="gst-buyer-name">{po.supplier}</div>
                {supplier?.address && <div>{supplier.address}</div>}
                <div>
                  {[supplier?.city, supplier?.state].filter(Boolean).join(", ")}
                  {supplier?.pincode ? ` - ${supplier.pincode}` : ""}
                </div>
                {supplier?.phone && <div>Phone: {formatPhone(supplier.phone)}</div>}
              </div>
              <table className="gst-details-table">
                <tbody>
                  <tr><th>PO Number</th><td>{po.id}</td></tr>
                  <tr><th>PO Date</th><td>{po.orderDate || "—"}</td></tr>
                  <tr><th>Delivery Date</th><td>{po.expectedDate || "—"}</td></tr>
                  <tr><th>Payment Terms</th><td>{po.paymentTerms || "—"}</td></tr>
                  <tr><th>Supplier's GSTIN</th><td>{supplier?.gstNo || "—"}</td></tr>
                  <tr><th>State Code</th><td>{stateCode || "—"}</td></tr>
                </tbody>
              </table>
            </div>

            <table className="gst-items-table">
              <thead>
                <tr>
                  <th style={{ width: "34px" }}>#</th>
                  <th>Description of Goods / Services</th>
                  <th style={{ width: "66px" }}>HSN/SAC</th>
                  <th style={{ width: "50px" }}>Qty</th>
                  <th style={{ width: "50px" }}>Unit</th>
                  <th style={{ width: "90px" }}>Price/Unit (₹)</th>
                  <th style={{ width: "60px" }}>Tax %</th>
                  <th style={{ width: "100px" }}>Amount (₹)</th>
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
                      <><th>Rate</th><th>Amount</th><th>Rate</th><th>Amount</th></>
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
                <div>{amountInWords(po.amount)}</div>
                <div className="gst-notes">
                  <div className="gst-box-label">Notes:</div>
                  <ol>
                    <li>Please deliver goods as per the quantity and schedule above.</li>
                    <li>Quote this PO number on your invoice and delivery documents.</li>
                  </ol>
                </div>
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
                  <tr className="gst-total-row"><th>Total Amount</th><td>{inr(po.amount)}</td></tr>
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
          </div>
          ))}
        </div>
      </div>
    </div>
  );
}
