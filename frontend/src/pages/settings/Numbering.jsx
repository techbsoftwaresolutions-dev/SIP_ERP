import { useEffect, useState } from "react";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import Loader from "../../components/ui/Loader";

// One row per document type instead of 18 fields in a flat grid — the three
// parts of a number belong together, and the live preview removes any doubt
// about what will actually be generated.
const DOC_TYPES = [
  { key: "invoice", label: "Invoice", example: "SIS/26-27/" },
  { key: "salesOrder", label: "Sales Order", example: "SO/26-27/" },
  { key: "purchaseOrder", label: "Purchase Order", example: "PO/26-27/" },
  { key: "quotation", label: "Quotation", example: "RFQ/26-27/" },
  { key: "deliveryChallan", label: "Delivery Challan", example: "DC/26-27/" },
  { key: "customerCode", label: "Customer Code", example: "CUST-" },
  { key: "supplierCode", label: "Supplier Code", example: "SUP-" },
];

const DEFAULT_NEXT = 1;
const DEFAULT_DIGITS = 4;

function preview(prefix, next, digits) {
  const n = Number(next);
  const d = Math.min(Math.max(Number(digits) || DEFAULT_DIGITS, 1), 12);
  const serial = String(Number.isFinite(n) && n > 0 ? n : DEFAULT_NEXT).padStart(d, "0");
  return `${prefix || ""}${serial}`;
}

export default function NumberingSettings() {
  const [settings, setSettings] = useState(null);
  const [savedSettings, setSavedSettings] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/settings").then((s) => {
      // Older Settings documents predate the serial fields — fill them in so
      // the inputs show the value that will actually be used, never blank.
      const filled = { ...s };
      DOC_TYPES.forEach(({ key }) => {
        if (filled[`${key}NextNumber`] == null) filled[`${key}NextNumber`] = DEFAULT_NEXT;
        if (filled[`${key}Digits`] == null) filled[`${key}Digits`] = DEFAULT_DIGITS;
      });
      setSettings(filled);
      setSavedSettings(filled);
    });
  }, []);

  if (!settings) {
    return (
      <div>
        <PageHeader title="Numbering Settings" crumbs={["Dashboard", "Settings", "Numbering Settings"]} />
        <div className="loading-row"><Loader /></div>
      </div>
    );
  }

  const set = (key) => (e) => {
    setSettings((s) => ({ ...s, [key]: e.target.value }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (saving) return;
    setError("");
    setSaving(true);
    try {
      const payload = { ...settings };
      DOC_TYPES.forEach(({ key }) => {
        payload[`${key}NextNumber`] = Number(payload[`${key}NextNumber`]) || DEFAULT_NEXT;
        payload[`${key}Digits`] = Number(payload[`${key}Digits`]) || DEFAULT_DIGITS;
      });
      await api.put("/api/settings", payload);
      setSettings(payload);
      setSavedSettings(payload);
      setSaved(true);
    } catch (err) {
      setError(err.message || "Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Numbering Settings" crumbs={["Dashboard", "Settings", "Numbering Settings"]} />

      <div className="list-card">
        <div className="section-title">Document Numbering</div>
        {error && <div className="login-error">{error}</div>}

        <div className="numbering-list">
          {DOC_TYPES.map(({ key, label, example }) => {
            const prefix = settings[`${key}Prefix`] ?? "";
            const next = settings[`${key}NextNumber`];
            const digits = settings[`${key}Digits`];
            return (
              <div className="numbering-row" key={key}>
                <div className="numbering-row-title">{label}</div>
                <div className="numbering-row-fields">
                  <div className="field">
                    <label><span>Prefix</span></label>
                    <input type="text" value={prefix} placeholder={example} onChange={set(`${key}Prefix`)} />
                  </div>
                  <div className="field">
                    <label><span>Start Number</span></label>
                    <input type="number" min="1" value={next} onChange={set(`${key}NextNumber`)} />
                  </div>
                  <div className="field">
                    <label><span>Digits</span></label>
                    <input type="number" min="1" max="12" value={digits} onChange={set(`${key}Digits`)} />
                  </div>
                  <div className="numbering-preview">
                    <span>Next number</span>
                    <strong>{preview(prefix, next, digits)}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="add-form-actions">
          <button type="button" className="btn" onClick={() => { setSettings(savedSettings); setSaved(false); }} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
