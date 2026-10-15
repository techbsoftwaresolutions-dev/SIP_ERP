import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import { buildPdfBlob, downloadBlob } from "../../utils/share";
import { formatPhone } from "../../utils/formatPhone";
import { buildDocCsv, buildWordDocument, copyCount, copyLabelList, downloadCsvText, downloadWord, escHtml } from "../../utils/docExport";
import { enquiryItemsFor } from "./enquiryFields";
import Icon from "../../components/ui/Icon";
import Loader from "../../components/ui/Loader";
import CopiesPicker from "../../components/share/CopiesPicker";


// Preview / print / download for an Enquiry — the same flow as every other
// document. An enquiry is an internal record of what a customer asked for, so
// it carries no prices or tax.
export default function EnquiryPrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [enquiry, setEnquiry] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const sheetRefs = useRef([]);
  // Which copies are ticked (indexes into the label set); null = the default count from Settings.
  const [picked, setPicked] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [e, s] = await Promise.all([
          api.get(`/api/sales/enquiries/${encodeURIComponent(id)}`),
          api.get("/api/settings"),
        ]);
        if (cancelled) return;
        setEnquiry(e);
        setSettings(s);
        const list = await api.get("/api/customers?page=1&pageSize=500");
        if (cancelled) return;
        setCustomer((list.data || []).find((c) => c.name === e.customer) || null);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load enquiry.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const labelSet = copyLabelList(settings);
  const selectedCopies = picked ?? labelSet.map((_, i) => i).slice(0, copyCount(settings, "enquiryCopies", 1));
  const copyLabels = selectedCopies.map((i) => labelSet[i]);
  const nCopies = copyLabels.length;
  
  const activeSheets = () => sheetRefs.current.slice(0, nCopies);

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
  if (!enquiry || !settings) {
    return (
      <div className="invoice-print-page">
        <div className="loading-row"><Loader /></div>
      </div>
    );
  }

  const items = enquiryItemsFor(enquiry);
  const phone = customer?.phone;
  const detailRows = [
    ["Enquiry No", enquiry.id],
    ["Enquiry Date", enquiry.date],
    ["Required Date", enquiry.requiredDate],
    ["Source", enquiry.source],
    ["Priority", enquiry.priority],
    ["Status", enquiry.status],
    enquiry.estValue ? ["Est. Value", `₹${Number(enquiry.estValue).toLocaleString("en-IN")}`] : null,
  ].filter(Boolean);

  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    if (pdfBusy || !activeSheets().length) return;
    setPdfBusy(true);
    try {
      downloadBlob(await buildPdfBlob(activeSheets()), `enquiry-${enquiry.id}.pdf`);
    } catch (err) {
      window.alert("Could not generate PDF: " + (err.message || "unknown error"));
    } finally {
      setPdfBusy(false);
    }
  };

  const handleDownloadWord = () => {
    const cell = "border:1px solid #ccc;padding:6px;";
    const section = (label) => `
      <h2 style="margin-bottom:0;">ENQUIRY <span style="font-size:12px;color:#17b6d9;">${escHtml(label)}</span></h2>
      <p style="color:#666;margin-top:2px;">${escHtml(settings.companyName || "Your Company")}</p>
      <table style="border-collapse:collapse;width:100%;margin:12px 0;">
        ${[["Customer", enquiry.customer], ["Contact Person", enquiry.contactPerson], ["Phone", phone], ...detailRows]
          .map(([k, v]) => `<tr><td style="${cell}font-weight:bold;width:35%;">${escHtml(k)}</td><td style="${cell}">${escHtml(v || "-")}</td></tr>`)
          .join("")}
      </table>
      <table style="border-collapse:collapse;width:100%;margin:12px 0;">
        <tr>${["#", "Product", "Qty", "Unit", "Remarks"].map((h) => `<th style="${cell}text-align:left;">${h}</th>`).join("")}</tr>
        ${items
          .map(
            (it, i) => `<tr>
          <td style="${cell}">${i + 1}</td>
          <td style="${cell}">${escHtml(it.product)}</td>
          <td style="${cell}">${Number(it.qty) || 0}</td>
          <td style="${cell}">${escHtml(it.unit || "-")}</td>
          <td style="${cell}">${escHtml(it.remarks || "")}</td>
        </tr>`
          )
          .join("")}
      </table>`;
    downloadWord(buildWordDocument(`Enquiry ${enquiry.id}`, copyLabels.map(section)), `enquiry-${enquiry.id}.doc`);
  };

  // One copy only: a CSV is data, not a printout, so copies make no sense.
  const handleDownloadCsv = () => {
    const csv = buildDocCsv({
      title: `Enquiry ${enquiry.id}`,
      meta: [["Customer", enquiry.customer], ["Contact Person", enquiry.contactPerson], ["Phone", phone], ...detailRows],
      columns: [
        { header: "#", get: (_, i) => i + 1 },
        { header: "Product", get: (it) => it.product },
        { header: "Qty", get: (it) => it.qty },
        { header: "Unit", get: (it) => it.unit },
        { header: "Remarks", get: (it) => it.remarks },
      ],
      items,
    });
    downloadCsvText(csv, `enquiry-${enquiry.id}.csv`);
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
        </div>

        <div className="invoice-sheets-col">
          {copyLabels.map((copyLabel, copyIdx) => (
            <div
              key={copyLabel}
              ref={(el) => (sheetRefs.current[copyIdx] = el)}
              className="invoice-sheet format-default invoice-gst-sheet"
            >
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
                    </div>
                  </div>
                </div>
                <div className="gst-header-right">
                  <div className="gst-title" style={{ fontSize: "21px" }}>ENQUIRY</div>
                  <div className="gst-copy-tag">{copyLabel}</div>
                </div>
              </div>

              <div className="gst-divider" />

              <div className="gst-meta-grid">
                <div className="gst-billing-box">
                  <div className="gst-box-label"><Icon name="user" size={13} /> Customer</div>
                  <div className="gst-buyer-name">{enquiry.customer}</div>
                  {enquiry.contactPerson && <div>Contact: {enquiry.contactPerson}</div>}
                  {customer?.address && <div>{customer.address}</div>}
                  {phone && <div>Phone: {formatPhone(phone)}</div>}
                </div>
                <table className="gst-details-table">
                  <tbody>
                    {detailRows.map(([k, v]) => (
                      <tr key={k}><th>{k}</th><td>{v || "—"}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <table className="gst-items-table">
                <thead>
                  <tr>
                    <th style={{ width: "40px" }}>#</th>
                    <th>Product</th>
                    <th style={{ width: "80px" }}>Qty</th>
                    <th style={{ width: "80px" }}>Unit</th>
                    <th style={{ width: "30%" }}>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={5}>No products listed.</td></tr>
                  ) : (
                    items.map((it, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>{it.product}</td>
                        <td>{Number(it.qty) || 0}</td>
                        <td>{it.unit || "—"}</td>
                        <td>{it.remarks || ""}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div className="gst-footer-row">
                <div />
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
