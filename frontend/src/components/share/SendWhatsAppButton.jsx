import { useState } from "react";
import api from "../../api/client";
import Icon from "../ui/Icon";
import Modal from "../ui/Modal";
import Toast from "../ui/Toast";
import { buildPdfBlob, safeFileName } from "../../utils/share";

// True when this client has finished setting up the WhatsApp Business API
// (Settings → WhatsApp Settings) and switched it on.
export function whatsappApiReady(settings) {
  return Boolean(
    settings &&
      settings.waStatus === "Enabled" &&
      settings.waPhoneNumberId &&
      settings.waAccessTokenSet &&
      settings.waTemplateName
  );
}

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Could not read the document."));
    reader.readAsDataURL(blob);
  });

// "Send via WhatsApp": renders the page's document to a PDF, then has the
// server send it through the client's WhatsApp Business account — no
// WhatsApp window, no manual attaching. Renders nothing when the API isn't
// set up, so the existing manual WhatsApp share stays the only option there.
export default function SendWhatsAppButton({ settings, getSheet, documentType, documentId, documentLabel, partyName, amount, defaultPhone, filename }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  if (!whatsappApiReady(settings)) return null;

  const openDialog = () => {
    setPhone(String(defaultPhone || "").replace(/\D/g, ""));
    setError("");
    setOpen(true);
  };

  const send = async () => {
    setError("");
    setBusy(true);
    try {
      const sheet = getSheet();
      if (!sheet || (Array.isArray(sheet) && !sheet.filter(Boolean).length)) throw new Error("The document isn't ready yet. Please try again in a moment.");
      const pdf = await buildPdfBlob(sheet);
      const result = await api.post("/api/whatsapp/send-document", {
        to: phone,
        documentType,
        documentId,
        partyName,
        amount,
        filename: safeFileName(filename || `${documentType}-${documentId}.pdf`),
        pdfBase64: await blobToBase64(pdf),
      });
      setOpen(false);
      setToast(`Sent on WhatsApp to ${result.to}`);
      setTimeout(() => setToast(""), 4000);
    } catch (err) {
      setError(err.message || "Could not send the document.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="btn btn-primary invoice-download-btn" onClick={openDialog}>
        <Icon name="whatsapp" size={15} /> Send via WhatsApp
      </button>

      {open && (
        <Modal title={`Send ${documentLabel} ${documentId} on WhatsApp`} onClose={() => !busy && setOpen(false)}>
          <div className="add-form">
            {error && <div className="login-error">{error}</div>}
            <div className="field">
              <label>WhatsApp number{partyName ? ` — ${partyName}` : ""}</label>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d+\s]/g, ""))}
                placeholder="e.g. 9876543210 (10 digits, India) or 919876543210"
                autoFocus
              />
              <span className="field-hint">A 10-digit number is sent to India (+91). For other countries include the country code.</span>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: "0 0 16px" }}>
              The PDF is sent from your company's WhatsApp Business number.
            </p>
            <div className="add-form-actions">
              <button type="button" className="btn" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={send} disabled={busy || !phone.trim()}>
                {busy ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast} />}
    </>
  );
}
