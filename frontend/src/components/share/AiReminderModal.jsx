import { useState } from "react";
import api from "../../api/client";
import Modal from "../ui/Modal";
import Icon from "../ui/Icon";
import Select from "../forms/Select";

// Drafts a payment-reminder message for one customer via the backend AI
// route, then lets the user tweak it and open it in WhatsApp / email.
// Nothing is sent automatically — the user reviews and sends it themselves.
export default function AiReminderModal({ customer, phone = "", email = "", onClose }) {
  const [channel, setChannel] = useState("whatsapp");
  const [tone, setTone] = useState("polite");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [meta, setMeta] = useState(null); // { outstanding, invoiceCount }
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const res = await api.post("/api/ai/payment-reminder", { customer, channel, tone });
      setSubject(res.subject || "");
      setMessage(res.message || "");
      setMeta({ outstanding: res.outstanding || 0, invoiceCount: res.invoiceCount || 0 });
    } catch (err) {
      setError(err.message || "Could not generate a reminder.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(subject ? `${subject}\n\n${message}` : message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  };

  const openChannel = () => {
    if (channel === "whatsapp") {
      const num = String(phone || "").replace(/\D/g, "");
      const base = num ? `https://wa.me/${num.length === 10 ? "91" + num : num}` : "https://wa.me/";
      window.open(`${base}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    } else {
      const to = encodeURIComponent(email || "");
      window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    }
  };

  return (
    <Modal title={`Payment reminder — ${customer}`} onClose={onClose}>
      <div className="ai-reminder add-form">
        <div className="ai-reminder-controls">
          <div className="field">
            <label>Channel</label>
            <div className="ai-seg">
              <button type="button" className={channel === "whatsapp" ? "active" : ""} onClick={() => setChannel("whatsapp")}>
                <Icon name="whatsapp" size={14} /> WhatsApp
              </button>
              <button type="button" className={channel === "email" ? "active" : ""} onClick={() => setChannel("email")}>
                <Icon name="mail" size={14} /> Email
              </button>
            </div>
          </div>
          <div className="field">
            <label>Tone</label>
            <Select value={tone} onChange={(e) => setTone(e.target.value)}>
              <option value="polite">Polite</option>
              <option value="friendly">Friendly</option>
              <option value="firm">Firm</option>
            </Select>
          </div>
          <button type="button" className="btn btn-primary" onClick={generate} disabled={busy}>
            {busy ? "Generating…" : message ? "Regenerate" : "Generate"}
          </button>
        </div>

        {error && <div className="login-error" style={{ marginTop: 10 }}>{error}</div>}

        {meta && (
          <div className="ai-meta" style={{ marginTop: 10 }}>
            {meta.invoiceCount} unpaid invoice{meta.invoiceCount === 1 ? "" : "s"} · outstanding ₹
            {Number(meta.outstanding).toLocaleString("en-IN")}
          </div>
        )}

        {(message || busy) && (
          <div style={{ marginTop: 14 }}>
            {channel === "email" && (
              <div className="field">
                <label>Subject</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
            )}
            <div className="field">
              <label>Message</label>
              <textarea rows={channel === "email" ? 9 : 6} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <div className="add-form-actions" style={{ marginTop: 4 }}>
              <button type="button" className="btn" onClick={copy} disabled={!message}>
                {copied ? "Copied!" : "Copy"}
              </button>
              <button type="button" className="btn btn-primary" onClick={openChannel} disabled={!message}>
                <Icon name={channel === "whatsapp" ? "whatsapp" : "mail"} size={14} />{" "}
                Open in {channel === "whatsapp" ? "WhatsApp" : "Email"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
