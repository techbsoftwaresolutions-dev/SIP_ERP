import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import { getStateCode } from "../../utils/gstStateCodes";
import { buildPdfBlob, downloadBlob, shareDocument } from "../../utils/share";
import Icon from "../../components/ui/Icon";
import Loader from "../../components/ui/Loader";
import SendWhatsAppButton from "../../components/share/SendWhatsAppButton";
import CopiesPicker from "../../components/share/CopiesPicker";
import { buildDocCsv, copyCount, copyLabelList, downloadCsvText } from "../../utils/docExport";

const COPY_LABELS = ["ORIGINAL — FOR CONSIGNEE", "DUPLICATE — FOR TRANSPORTER", "TRIPLICATE — FOR CONSIGNOR"];

const FORMATS = [
  { key: "default", label: "Default" },
  { key: "portrait", label: "Portrait" },
  { key: "color", label: "Color Challan" },
];

function DefaultChallanSheet({ copyLabel, dc, customer, settings, sheetRef }) {
  const stateCode = getStateCode(customer?.state);
  const qty = Number(dc.dispatchedQty) || 0;

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
                <span><Icon name="phone" size={13} /> {settings.phone}</span>
              )}
              {settings.email && (
                <span><Icon name="mail" size={13} /> {settings.email}</span>
              )}
              {settings.website && <span>🌐 {settings.website}</span>}
            </div>
          </div>
        </div>
        <div className="gst-header-right">
          <div className="gst-title">DELIVERY CHALLAN</div>
          <div className="gst-copy-tag">{copyLabel}</div>
        </div>
      </div>

      {settings.gstin && <div className="gst-gstin-row">GSTIN: {settings.gstin}</div>}
      <div className="gst-divider" />

      <div className="gst-meta-grid">
        <div className="gst-billing-box">
          <div className="gst-box-label"><Icon name="user" size={13} /> Ship To</div>
          <div className="gst-buyer-name">{dc.customer}</div>
          {customer?.address && <div>{customer.address}</div>}
          <div>
            {[customer?.city, customer?.state].filter(Boolean).join(", ")}
            {customer?.pincode ? ` - ${customer.pincode}` : ""}
          </div>
          {customer?.phone && <div>Phone: {customer.phone}</div>}
        </div>
        <table className="gst-details-table">
          <tbody>
            <tr><th>DC Number</th><td>{dc.id}</td></tr>
            <tr><th>DC Date</th><td>{dc.date || "—"}</td></tr>
            <tr><th>Sales Order No</th><td>{dc.salesOrder || "—"}</td></tr>
            <tr><th>Transporter</th><td>{dc.transporter || "—"}</td></tr>
            <tr><th>Vehicle No.</th><td>{dc.vehicleNo || "—"}</td></tr>
            <tr><th>Warehouse</th><td>{dc.warehouse || "—"}</td></tr>
            <tr><th>State Code</th><td>{stateCode || "—"}</td></tr>
          </tbody>
        </table>
      </div>

      <table className="gst-items-table">
        <thead>
          <tr>
            <th style={{ width: "40px" }}>#</th>
            <th>Description of Goods</th>
            <th style={{ width: "100px" }}>Qty</th>
            <th style={{ width: "80px" }}>Unit</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>{dc.product || "—"}</td>
            <td>{qty.toLocaleString("en-IN")}</td>
            <td>{dc.unit || "Nos"}</td>
          </tr>
        </tbody>
      </table>

      <div className="gst-totals-row">
        <div className="gst-notes-col">
          <div className="gst-box-label">Remarks</div>
          <div>Goods dispatched in good condition. Please verify quantity on receipt.</div>
        </div>
        <table className="gst-totals-table">
          <tbody>
            <tr><th>Total Dispatched Qty</th><td>{qty.toLocaleString("en-IN")} {dc.unit || "Nos"}</td></tr>
            <tr><th>No. of Items</th><td>{dc.items || 1}</td></tr>
            <tr className="gst-total-row"><th>Delivery Status</th><td>{dc.status || "Pending"}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="gst-footer-row">
        <div className="gst-bank-box">
          <div className="gst-box-label"><Icon name="user" size={13} /> Received By</div>
          <div>Name: ______________________</div>
          <div>Signature: ______________________</div>
          <div>Date: ______________________</div>
        </div>
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

function ChallanSheet({ copyLabel, dc, customer, settings, format, sheetRef }) {
  const stateCode = getStateCode(customer?.state);
  const qty = Number(dc.dispatchedQty) || 0;

  return (
    <div ref={sheetRef} className={`invoice-sheet format-${format}`}>
      <div className="invoice-sheet-topband">
        <div className="invoice-company-row">
          {settings.logo && (
            <div className="invoice-logo">
              <img src={settings.logo} alt="Company Logo" />
            </div>
          )}
          <div className="invoice-company-info">
            <div className="invoice-company-name">{settings.companyName || "Your Company"}</div>
            {settings.legalName && <div className="invoice-company-legal">{settings.legalName}</div>}
            {settings.address && <div>{settings.address}</div>}
            <div className="invoice-company-meta">
              {settings.phone && <span>Contact: {settings.phone}</span>}
              {settings.email && <span>Email: {settings.email}</span>}
            </div>
            {settings.gstin && <div className="invoice-gstin">GSTIN: {settings.gstin}</div>}
          </div>
        </div>

        <div className="invoice-sheet-header">
          <div className="invoice-title">DELIVERY CHALLAN</div>
          <div className="invoice-copy-tag">{copyLabel}</div>
        </div>
      </div>

      <div className="invoice-body">
      <div className="invoice-meta-grid">
        <div className="invoice-billing-box">
          <div className="invoice-box-label">Ship To</div>
          <div className="invoice-buyer-name">{dc.customer}</div>
          {customer?.address && <div>{customer.address}</div>}
          <div>
            {[customer?.city, customer?.state, customer?.pincode].filter(Boolean).join(", ") || "—"}
          </div>
          {customer?.phone && <div>Phone: {customer.phone}</div>}
        </div>
        <table className="invoice-details-table">
          <tbody>
            <tr><th>DC Number</th><td>{dc.id}</td></tr>
            <tr><th>DC Date</th><td>{dc.date || "—"}</td></tr>
            <tr><th>Sales Order No</th><td>{dc.salesOrder || "—"}</td></tr>
            <tr><th>Transporter</th><td>{dc.transporter || "—"}</td></tr>
            <tr><th>Vehicle No.</th><td>{dc.vehicleNo || "—"}</td></tr>
            <tr><th>Warehouse</th><td>{dc.warehouse || "—"}</td></tr>
            <tr><th>State Code</th><td>{stateCode || "—"}</td></tr>
          </tbody>
        </table>
      </div>

      <table className="invoice-items-table">
        <thead>
          <tr>
            <th style={{ width: "60px" }}>#</th>
            <th>Description of Goods</th>
            <th style={{ width: "160px", textAlign: "right" }}>Qty / Unit</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>{dc.product || "—"}</td>
            <td style={{ textAlign: "right" }}>{qty.toLocaleString("en-IN")} {dc.unit || "Nos"}</td>
          </tr>
        </tbody>
      </table>

      <div className="invoice-totals-row">
        <div className="invoice-amount-words">
          <div className="invoice-box-label">Remarks</div>
          <div>Goods dispatched in good condition. Please verify quantity on receipt.</div>
        </div>
        <table className="invoice-totals-table">
          <tbody>
            <tr><th>Total Dispatched Qty</th><td>{qty.toLocaleString("en-IN")} {dc.unit || "Nos"}</td></tr>
            <tr><th>No. of Items</th><td>{dc.items || 1}</td></tr>
            <tr className="grand"><th>Delivery Status</th><td>{dc.status || "Pending"}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="invoice-footer-row">
        <div className="invoice-bank-box">
          <div className="invoice-box-label">Received By</div>
          <div>Name: ______________________</div>
          <div>Signature: ______________________</div>
          <div>Date: ______________________</div>
        </div>
        <div className="invoice-signature-box">
          <div>For {settings.companyName || "Your Company"}</div>
          <div className="invoice-signature-stamp">
            {settings.seal && <img src={settings.seal} alt="Company Seal" className="invoice-seal" />}
            {settings.signature && <img src={settings.signature} alt="Authorized Signature" className="invoice-signature" />}
          </div>
          <div className="invoice-signatory-label">Authorized Signatory</div>
        </div>
      </div>
      </div>

      <div className="invoice-contact-band">
        {settings.phone && <span>📞 {settings.phone}</span>}
        {settings.email && <span>✉️ {settings.email}</span>}
        {settings.address && <span>📍 {settings.address}</span>}
      </div>
    </div>
  );
}

export default function DeliveryChallanPrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dc, setDc] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");
  const [format, setFormat] = useState("default");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(""); // "" | "whatsapp" | "email"
  const sheetRefs = useRef([]);
  // Copies for Print / PDF / Word / Excel: Settings → General gives the
  // starting value, the picker changes it for this preview.
  // Which copies are ticked (indexes into the label set); null = the default count from Settings.
  const [picked, setPicked] = useState(null);
  const labelSet = copyLabelList(settings, COPY_LABELS);
  const selectedCopies = picked ?? labelSet.map((_, i) => i).slice(0, copyCount(settings, "challanCopies", 3));
  const copyLabels = selectedCopies.map((i) => labelSet[i]);
  const nCopies = copyLabels.length;
  
  const activeSheets = () => sheetRefs.current.slice(0, nCopies);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [dcRes, s] = await Promise.all([
          api.get(`/api/sales/delivery-challans/${encodeURIComponent(id)}`),
          api.get("/api/settings"),
        ]);
        if (cancelled) return;
        setDc(dcRes);
        setSettings(s);
        const custList = await api.get(`/api/customers?page=1&pageSize=500`);
        if (cancelled) return;
        const match = (custList.data || []).find((c) => c.name === dcRes.customer);
        setCustomer(match || null);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load delivery challan.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    if (!dc || pdfBusy) return;
    setPdfBusy(true);
    try {
      const blob = await buildPdfBlob(activeSheets());
      downloadBlob(blob, `delivery-challan-${dc.id}.pdf`);
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
  const shareSummaryText = () => {
    const qty = Number(dc.dispatchedQty) || 0;
    return [
      `Delivery Challan ${dc.id}`,
      `Customer: ${dc.customer || "—"}`,
      `Date: ${dc.date || "—"}`,
      `Product: ${dc.product || "—"} (${qty.toLocaleString("en-IN")} ${dc.unit || "Nos"})`,
      `Status: ${dc.status || "Pending"}`,
      `From: ${settings?.companyName || "—"}`,
    ].join("\n");
  };

  const handleShare = async (channel) => {
    if (!dc || shareBusy) return;
    setShareBusy(channel);
    try {
      await shareDocument({
        sheetEl: activeSheets(),
        filename: `delivery-challan-${dc.id}.pdf`,
        title: `Delivery Challan ${dc.id}`,
        text: shareSummaryText(),
        channel,
      });
    } catch (err) {
      window.alert("Could not share: " + (err.message || "unknown error"));
    } finally {
      setShareBusy("");
    }
  };

  const handleDownloadWord = () => {
    if (!dc) return;
    const stateCode = getStateCode(customer?.state);
    const qty = Number(dc.dispatchedQty) || 0;
    const rows = [
      ["DC Number", dc.id],
      ["DC Date", dc.date || "—"],
      ["Sales Order No", dc.salesOrder || "—"],
      ["Transporter", dc.transporter || "—"],
      ["Vehicle No.", dc.vehicleNo || "—"],
      ["Warehouse", dc.warehouse || "—"],
      ["State Code", stateCode || "—"],
    ];
    const copySection = (label) => `
        <h2 style="margin-bottom:0;">DELIVERY CHALLAN <span style="font-size:12px;color:#17b6d9;border:1px solid #17b6d9;border-radius:12px;padding:2px 10px;">${label}</span></h2>
        <p style="color:#666;margin-top:2px;">${settings?.companyName || "Your Company"}</p>
        <table style="border-collapse:collapse;width:100%;margin:12px 0;">
          ${rows.map(([k, v]) => `<tr><td style="border:1px solid #ccc;padding:6px;font-weight:bold;width:40%;">${k}</td><td style="border:1px solid #ccc;padding:6px;">${v}</td></tr>`).join("")}
        </table>
        <table style="border-collapse:collapse;width:100%;margin:12px 0;">
          <tr>
            <th style="border:1px solid #ccc;padding:6px;text-align:left;">#</th>
            <th style="border:1px solid #ccc;padding:6px;text-align:left;">Description</th>
            <th style="border:1px solid #ccc;padding:6px;text-align:right;">Qty / Unit</th>
          </tr>
          <tr>
            <td style="border:1px solid #ccc;padding:6px;">1</td>
            <td style="border:1px solid #ccc;padding:6px;">${dc.product || "—"}</td>
            <td style="border:1px solid #ccc;padding:6px;text-align:right;">${qty.toLocaleString("en-IN")} ${dc.unit || "Nos"}</td>
          </tr>
        </table>
        <p><strong>Delivery Status:</strong> ${dc.status || "Pending"}</p>`;
    const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>Delivery Challan ${dc.id}</title></head>
      <body style="font-family:Arial,sans-serif;font-size:13px;color:#111;">
        ${copyLabels.map((label, i) => `${copySection(label)}${i < copyLabels.length - 1 ? '<br clear="all" style="page-break-before:always" />' : ""}`).join("")}
      </body></html>`;
    const blob = new Blob(["﻿", html], { type: "application/msword" });
    downloadBlob(blob, `delivery-challan-${dc.id}.doc`);
  };

  // One copy only: a CSV is data, not a printout, so copies make no sense.
  const handleDownloadCsv = () => {
    if (!dc) return;
    const csv = buildDocCsv({
      title: `Delivery Challan ${dc.id}`,
      meta: [
        ["DC Number", dc.id],
        ["DC Date", dc.date],
        ["Customer", dc.customer],
        ["Sales Order No", dc.salesOrder],
        ["Transporter", dc.transporter],
        ["Vehicle No.", dc.vehicleNo],
        ["Warehouse", dc.warehouse],
        ["Delivery Status", dc.status],
      ],
      columns: [
        { header: "#", get: (_, i) => i + 1 },
        { header: "Description of Goods", get: (it) => it.product },
        { header: "Qty", get: (it) => it.qty },
        { header: "Unit", get: (it) => it.unit },
      ],
      items: [{ product: dc.product, qty: Number(dc.dispatchedQty) || 0, unit: dc.unit || "Nos" }],
      totals: [["Total Dispatched Qty", Number(dc.dispatchedQty) || 0]],
    });
    downloadCsvText(csv, `delivery-challan-${dc.id}.csv`);
  };

  const handleDownloadExcel = () => {
    if (!dc) return;
    const stateCode = getStateCode(customer?.state);
    const qty = Number(dc.dispatchedQty) || 0;

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
      parts.push(row(cell(`DELIVERY CHALLAN — ${label}`, { bold: true, colspan: 3, bg: "#1c222c" })));
      parts.push(blankRow());
      parts.push(labelRow("DC Number", dc.id));
      parts.push(labelRow("DC Date", dc.date || "—"));
      parts.push(labelRow("Customer", dc.customer || "—"));
      parts.push(labelRow("Sales Order No", dc.salesOrder || "—"));
      parts.push(labelRow("Transporter", dc.transporter || "—"));
      parts.push(labelRow("Vehicle No.", dc.vehicleNo || "—"));
      parts.push(labelRow("State Code", stateCode || "—"));
      parts.push(blankRow());
      parts.push(
        row(
          cell("#", { bold: true, bg: "#eef4ff" }) +
            cell("Description", { bold: true, bg: "#eef4ff" }) +
            cell("Qty / Unit", { bold: true, right: true, bg: "#eef4ff" })
        )
      );
      parts.push(row(cell("1") + cell(dc.product || "—") + cell(`${qty} ${dc.unit || "Nos"}`, { right: true })));
      parts.push(blankRow());
      parts.push(row(cell("Delivery Status", { bold: true, colspan: 2, bg: "#17b6d9" }) + cell(dc.status || "Pending", { right: true, bold: true, bg: "#17b6d9" })));
      parts.push(blankRow());
      parts.push(blankRow());
      return parts.join("");
    };

    const colgroup = `<colgroup><col style="width:180px"><col style="width:280px"><col style="width:160px"></colgroup>`;
    const table = `<table style="border-collapse:collapse;">${colgroup}${copyLabels.map(copySection).join("")}</table>`;
    const html = `<html><head><meta charset="utf-8"></head><body>${table}</body></html>`;
    const blob = new Blob(["﻿", html], { type: "application/vnd.ms-excel" });
    downloadBlob(blob, `delivery-challan-${dc.id}.xls`);
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

  if (!dc || !settings) {
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
            <div className="invoice-side-panel-title">Challan Format</div>
            <div className="invoice-format-list">
              {FORMATS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`invoice-format-option${format === f.key ? " active" : ""}`}
                  onClick={() => setFormat(f.key)}
                >
                  <span className={`invoice-format-swatch ${f.key}`} />
                  {f.label}
                </button>
              ))}
            </div>
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
                documentType="delivery-challan"
                documentLabel="Delivery Challan"
                documentId={dc.id}
                partyName={dc.customer}
                defaultPhone={dc.phone || customer?.phone}
                filename={`delivery-challan-${dc.id}.pdf`}
              />
            </div>
          </div>
        </div>

        <div className="invoice-sheets-col">
          {copyLabels.map((label, i) =>
            format === "default" ? (
              <DefaultChallanSheet
                key={label}
                copyLabel={label}
                dc={dc}
                customer={customer}
                settings={settings}
                sheetRef={(el) => (sheetRefs.current[i] = el)}
              />
            ) : (
              <ChallanSheet
                key={label}
                copyLabel={label}
                dc={dc}
                customer={customer}
                settings={settings}
                format={format}
                sheetRef={(el) => (sheetRefs.current[i] = el)}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}
