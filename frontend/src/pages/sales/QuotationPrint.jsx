import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import { getStateCode, isIntraState } from "../../utils/gstStateCodes";
import { amountInWords } from "../../utils/numberToWords";
import { buildPdfBlob, downloadBlob, shareDocument } from "../../utils/share";
import { formatPhone } from "../../utils/formatPhone";
import Icon from "../../components/ui/Icon";
import Loader from "../../components/ui/Loader";
import SendWhatsAppButton from "../../components/share/SendWhatsAppButton";
import CopiesPicker from "../../components/share/CopiesPicker";
import { buildDocCsv, buildWordDocument, copyCount, copyLabelList, downloadCsvText, downloadWord, escHtml } from "../../utils/docExport";


const inr = (n) => `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n) => (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// CGST+SGST vs IGST is worked out at print time from the actual states, never
// stored — the same approach the invoice and purchase order prints take.
function taxSplit(items, intraState, discount = 0) {
  const subTotal = items.reduce((a, i) => a + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const rawTax = items.reduce((a, i) => a + ((i.amount || 0) - (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0)), 0);
  // The discount comes off before tax, so tax shrinks by the same ratio.
  const taxable = Math.max(subTotal - discount, 0);
  const tax = subTotal > 0 ? rawTax * (taxable / subTotal) : rawTax;
  const rate = taxable > 0 ? (tax / taxable) * 100 : 0;
  return intraState
    ? { subTotal, taxable, tax, cgstRate: rate / 2, cgst: tax / 2, sgstRate: rate / 2, sgst: tax / 2, igstRate: 0, igst: 0 }
    : { subTotal, taxable, tax, cgstRate: 0, cgst: 0, sgstRate: 0, sgst: 0, igstRate: rate, igst: tax };
}

export default function QuotationPrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [q, setQ] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [settings, setSettings] = useState(null);
  const [fieldLabels, setFieldLabels] = useState({});
  const [error, setError] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(""); // "" | "whatsapp" | "email"
  const sheetRefs = useRef([]);
  // Copies for Print / PDF / Word: Settings -> General gives the starting
  // value, the picker changes it for this preview.
  // Which copies are ticked (indexes into the label set); null = the default count from Settings.
  const [picked, setPicked] = useState(null);
  const labelSet = copyLabelList(settings);
  const selectedCopies = picked ?? labelSet.map((_, i) => i).slice(0, copyCount(settings, "quotationCopies", 1));
  const copyLabels = selectedCopies.map((i) => labelSet[i]);
  const nCopies = copyLabels.length;
  
  const activeSheets = () => sheetRefs.current.slice(0, nCopies);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [quotation, s] = await Promise.all([
          api.get(`/api/sales/quotations/${encodeURIComponent(id)}`),
          api.get("/api/settings"),
        ]);
        if (cancelled) return;
        setQ(quotation);
        setSettings(s);
        // Custom field values are stored by key; show them under their labels.
        api
          .get("/api/custom-fields?entity=quotation")
          .then((r) => !cancelled && setFieldLabels(Object.fromEntries((r.fields || []).map((f) => [f.key, f.label]))))
          .catch(() => {});
        const list = await api.get("/api/customers?page=1&pageSize=500");
        if (cancelled) return;
        setCustomer((list.data || []).find((c) => c.name === quotation.customer) || null);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load quotation.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    if (!q || !activeSheets().length || pdfBusy) return;
    setPdfBusy(true);
    try {
      downloadBlob(await buildPdfBlob(activeSheets()), `quotation-${q.id}.pdf`);
    } catch (err) {
      window.alert("Could not generate PDF: " + (err.message || "unknown error"));
    } finally {
      setPdfBusy(false);
    }
  };

  const shareSummaryText = () =>
    [
      `Quotation ${q.id}`,
      `Customer: ${q.customer || "—"}`,
      `Date: ${q.date || "—"}`,
      q.validTill ? `Valid till: ${q.validTill}` : null,
      `Total: ${inr(q.amount)}`,
      `From: ${settings.companyName || "—"}`,
    ]
      .filter(Boolean)
      .join("\n");

  const handleShare = async (channel) => {
    if (!q || !activeSheets().length || shareBusy) return;
    setShareBusy(channel);
    try {
      await shareDocument({
        sheetEl: activeSheets(),
        filename: `quotation-${q.id}.pdf`,
        title: `Quotation ${q.id}`,
        text: shareSummaryText(),
        channel,
      });
    } catch (err) {
      window.alert("Could not share: " + (err.message || "unknown error"));
    } finally {
      setShareBusy("");
    }
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

  if (!q || !settings) {
    return (
      <div className="invoice-print-page">
        <div className="loading-row"><Loader /></div>
      </div>
    );
  }

  const items = q.items || [];
  const state = q.placeOfSupply || customer?.state;
  const intraState = isIntraState(settings.gstin, state);
  const discount = Number(q.discountAmount) || 0;
  const split = taxSplit(items, intraState, discount);
  const freight = Number(q.freightCharges) || 0;
  const hasBank = settings.bankName || settings.bankAccountNumber || settings.bankIfsc;
  const address = q.address || customer?.address;
  const phone = q.phone || customer?.phone;
  const noteLines = String(q.notes || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const customFieldRows = Object.entries(q.customFields || {}).filter(([k, v]) => fieldLabels[k] && v !== "" && v != null);

  const downloadName = `quotation-${q.id}`;

  const handleDownloadWord = () => {
    const cell = "border:1px solid #ccc;padding:6px;";
    const section = (label) => `
      <h2 style="margin-bottom:0;">QUOTATION <span style="font-size:12px;color:#17b6d9;">${escHtml(label)}</span></h2>
      <p style="color:#666;margin-top:2px;">${escHtml(settings.companyName || "Your Company")}</p>
      <table style="border-collapse:collapse;width:100%;margin:12px 0;">
        ${[
          ["Quotation No", q.id],
          ["Date", q.date],
          ["Valid Till", q.validTill],
          ["Quotation To", q.customer],
          ["Address", address],
          ["Phone", phone],
          ["Place of Supply", state],
          q.referenceNo && ["Your Reference", q.referenceNo],
          q.paymentTerms && ["Payment Terms", q.paymentTerms],
          q.deliveryTerms && ["Delivery Terms", q.deliveryTerms],
        ]
          .filter(Boolean)
          .map(([k, v]) => `<tr><td style="${cell}font-weight:bold;width:35%;">${escHtml(k)}</td><td style="${cell}">${escHtml(v || "-")}</td></tr>`)
          .join("")}
      </table>
      ${q.subject ? `<p><strong>Subject:</strong> ${escHtml(q.subject)}</p>` : ""}
      <table style="border-collapse:collapse;width:100%;margin:12px 0;">
        <tr>
          ${["#", "Description", "HSN/SAC", "Qty", "Unit", "Price/Unit", "Tax %", "Amount"]
            .map((h, i) => `<th style="${cell}text-align:${i >= 3 && i !== 4 ? "right" : "left"};">${h}</th>`)
            .join("")}
        </tr>
        ${items
          .map(
            (it, i) => `<tr>
          <td style="${cell}">${i + 1}</td>
          <td style="${cell}">${escHtml(it.product)}</td>
          <td style="${cell}">${escHtml(it.hsnCode || "-")}</td>
          <td style="${cell}text-align:right;">${Number(it.quantity) || 0}</td>
          <td style="${cell}">${escHtml(it.unit || "-")}</td>
          <td style="${cell}text-align:right;">${num(it.unitPrice)}</td>
          <td style="${cell}text-align:right;">${it.taxPercent || 0}%</td>
          <td style="${cell}text-align:right;">${num(it.amount)}</td>
        </tr>`
          )
          .join("")}
      </table>
      <p><strong>Amount in Words:</strong> ${escHtml(amountInWords(q.amount))}</p>
      <table style="border-collapse:collapse;width:45%;margin-left:auto;">
        <tr><td style="padding:4px;">Sub Total</td><td style="padding:4px;text-align:right;">${inr(split.subTotal)}</td></tr>
        ${discount > 0 ? `<tr><td style="padding:4px;">Discount</td><td style="padding:4px;text-align:right;">- ${inr(discount)}</td></tr>` : ""}
        ${
          intraState
            ? `<tr><td style="padding:4px;">CGST (${split.cgstRate.toFixed(1)}%)</td><td style="padding:4px;text-align:right;">${inr(split.cgst)}</td></tr>
             <tr><td style="padding:4px;">SGST (${split.sgstRate.toFixed(1)}%)</td><td style="padding:4px;text-align:right;">${inr(split.sgst)}</td></tr>`
            : `<tr><td style="padding:4px;">IGST (${split.igstRate.toFixed(1)}%)</td><td style="padding:4px;text-align:right;">${inr(split.igst)}</td></tr>`
        }
        ${freight > 0 ? `<tr><td style="padding:4px;">Freight / Other</td><td style="padding:4px;text-align:right;">${inr(freight)}</td></tr>` : ""}
        <tr><td style="padding:4px;font-weight:bold;">Total Amount</td><td style="padding:4px;text-align:right;font-weight:bold;">${inr(q.amount)}</td></tr>
      </table>
      ${noteLines.length ? `<p><strong>Terms &amp; Conditions</strong></p><ol>${noteLines.map((l) => `<li>${escHtml(l)}</li>`).join("")}</ol>` : ""}
    `;
    downloadWord(buildWordDocument(`Quotation ${q.id}`, copyLabels.map(section)), `${downloadName}.doc`);
  };

  // One copy only: a CSV is data, not a printout, so copies make no sense.
  const handleDownloadCsv = () => {
    const csv = buildDocCsv({
      title: `Quotation ${q.id}`,
      meta: [
        ["Quotation No", q.id],
        ["Date", q.date],
        ["Valid Till", q.validTill],
        ["Customer", q.customer],
        ["Address", address],
        ["Phone", phone],
        ["Place of Supply", state],
        ["Subject", q.subject],
        ["Your Reference", q.referenceNo],
        ["Payment Terms", q.paymentTerms],
        ["Delivery Terms", q.deliveryTerms],
        ["Status", q.status],
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
        ["Sub Total", split.subTotal],
        ["Discount", discount],
        ["Tax", split.tax],
        ["Freight / Other", freight],
        ["Total", q.amount],
      ],
    });
    downloadCsvText(csv, `${downloadName}.csv`);
  };

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
                documentType="quotation"
                documentLabel="Quotation"
                documentId={q.id}
                partyName={q.customer}
                amount={q.amount}
                defaultPhone={phone}
                filename={`quotation-${q.id}.pdf`}
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
                <div className="gst-title" style={{ fontSize: "21px" }}>QUOTATION</div>
                <div className="gst-copy-tag">{copyLabel}</div>
              </div>
            </div>

            {settings.gstin && <div className="gst-gstin-row">GSTIN: {settings.gstin}</div>}
            <div className="gst-divider" />

            <div className="gst-meta-grid">
              <div className="gst-billing-box">
                <div className="gst-box-label"><Icon name="user" size={13} /> Quotation To</div>
                <div className="gst-buyer-name">{q.customer}</div>
                {address && <div>{address}</div>}
                {(customer?.city || customer?.state || customer?.pincode) && (
                  <div>
                    {[customer?.city, customer?.state].filter(Boolean).join(", ")}
                    {customer?.pincode ? ` - ${customer.pincode}` : ""}
                  </div>
                )}
                {phone && <div>Phone: {formatPhone(phone)}</div>}
                {customer?.gstNo && <div>GSTIN: {customer.gstNo}</div>}
              </div>
              <table className="gst-details-table">
                <tbody>
                  <tr><th>Quotation No</th><td>{q.id}</td></tr>
                  <tr><th>Date</th><td>{q.date || "—"}</td></tr>
                  <tr><th>Valid Till</th><td>{q.validTill || "—"}</td></tr>
                  {q.referenceNo && <tr><th>Your Reference</th><td>{q.referenceNo}</td></tr>}
                  <tr><th>Place of Supply</th><td>{state ? `${state}${getStateCode(state) ? ` (${getStateCode(state)})` : ""}` : "—"}</td></tr>
                  {q.paymentTerms && <tr><th>Payment Terms</th><td>{q.paymentTerms}</td></tr>}
                  {q.deliveryTerms && <tr><th>Delivery Terms</th><td>{q.deliveryTerms}</td></tr>}
                  {customFieldRows.map(([k, v]) => (
                    <tr key={k}><th>{fieldLabels[k]}</th><td>{String(v)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            {q.subject && (
              <div style={{ margin: "10px 0", fontWeight: 600 }}>Subject: {q.subject}</div>
            )}

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

            <div className="gst-totals-row">
              <div className="gst-notes-col">
                <div className="gst-box-label">Amount in Words</div>
                <div>{amountInWords(q.amount)}</div>
                {noteLines.length > 0 && (
                  <div className="gst-notes">
                    <div className="gst-box-label">Terms &amp; Conditions:</div>
                    <ol>
                      {noteLines.map((line, i) => <li key={i}>{line}</li>)}
                    </ol>
                  </div>
                )}
              </div>
              <table className="gst-totals-table">
                <tbody>
                  <tr><th>Sub Total</th><td>{inr(split.subTotal)}</td></tr>
                  {discount > 0 && (
                    <>
                      <tr>
                        <th>Discount{q.discountType === "percent" ? ` (${Number(q.discountValue) || 0}%)` : ""}</th>
                        <td>− {inr(discount)}</td>
                      </tr>
                      <tr><th>Taxable Amount</th><td>{inr(split.taxable)}</td></tr>
                    </>
                  )}
                  {intraState ? (
                    <>
                      <tr><th>CGST ({split.cgstRate.toFixed(1)}%)</th><td>{inr(split.cgst)}</td></tr>
                      <tr><th>SGST ({split.sgstRate.toFixed(1)}%)</th><td>{inr(split.sgst)}</td></tr>
                    </>
                  ) : (
                    <tr><th>IGST ({split.igstRate.toFixed(1)}%)</th><td>{inr(split.igst)}</td></tr>
                  )}
                  {freight > 0 && <tr><th>Freight / Other</th><td>{inr(freight)}</td></tr>}
                  <tr className="gst-total-row"><th>Total Amount</th><td>{inr(q.amount)}</td></tr>
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

            <div className="gst-thankyou-bar">Thank you for your enquiry!</div>
          </div>
          ))}
        </div>
      </div>
    </div>
  );
}
