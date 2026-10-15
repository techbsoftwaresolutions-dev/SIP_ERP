import { useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon";
import { shareTable } from "../../utils/exportDoc";

// "Share" button with a WhatsApp / Email dropdown — builds the same tabular
// PDF the Download button produces and hands it off via the native share
// sheet (or downloads it + opens the target app with a text summary when
// file-sharing isn't supported). Mirrors ExportButtons' look.
export default function ShareButtons({ columns, rows, title, filenameBase, summaryText }) {
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const run = async (channel) => {
    if (busy) return;
    setBusy(channel);
    try {
      const filename = `${filenameBase}-${new Date().toISOString().slice(0, 10)}.pdf`;
      await shareTable({ columns, rows, title, filename, text: summaryText || title, channel });
    } catch (err) {
      window.alert("Could not share: " + (err.message || "unknown error"));
    } finally {
      setBusy("");
      setOpen(false);
    }
  };

  return (
    <div className="export-btn-group" ref={wrapRef}>
      <button type="button" className="btn" onClick={() => setOpen((o) => !o)} disabled={!!busy} title="Share">
        <Icon name="share" size={15} /> <Icon name="chevronDown" size={14} />
      </button>
      {open && (
        <div className="topbar-dropdown export-dropdown">
          <button type="button" className="topbar-dropdown-item" onClick={() => run("whatsapp")}>
            <Icon name="whatsapp" size={15} /> {busy === "whatsapp" ? "Preparing…" : "WhatsApp"}
          </button>
          <button type="button" className="topbar-dropdown-item" onClick={() => run("email")}>
            <Icon name="mail" size={15} /> {busy === "email" ? "Preparing…" : "Email"}
          </button>
        </div>
      )}
    </div>
  );
}
