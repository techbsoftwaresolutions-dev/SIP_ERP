import { useEffect, useState } from "react";
import api, { clearSettingsCache } from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/ui/Icon";
import Loader from "../../components/ui/Loader";
import Toast from "../../components/ui/Toast";

// Colours offered to plans that may pick one. A fixed palette rather than a
// free colour input: these are printed, and a client picking #fdf200 would
// produce an invoice nobody can read.
const ACCENTS = [
  { value: "#2f4a7d", label: "Indigo" },
  { value: "#1f6b63", label: "Teal" },
  { value: "#8c2f39", label: "Maroon" },
  { value: "#1a1a1a", label: "Black" },
  { value: "#2b5d34", label: "Forest" },
  { value: "#7a4a1e", label: "Bronze" },
];

const TIER_LABEL = { basic: "Basic", advanced: "Advanced", premium: "Premium" };

export default function InvoiceTheme() {
  const [info, setInfo] = useState(null);
  const [theme, setTheme] = useState("");
  const [accent, setAccent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const load = () =>
    api
      .get("/api/invoice-themes")
      .then((d) => {
        setInfo(d);
        setTheme(d.theme);
        setAccent(d.accent);
      })
      .catch((err) => setError(err.message || "Could not load invoice themes."));

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const body = { invoiceTheme: theme };
      if (info.canPickAccent) body.invoiceAccent = accent;
      await api.put("/api/settings", body);
      // The settings response is cached for a minute; without this the print
      // page would keep using the previous theme until it expired.
      clearSettingsCache();
      setToast("Invoice theme saved.");
      setTimeout(() => setToast(""), 2500);
    } catch (err) {
      setError(err.message || "Could not save the invoice theme.");
    } finally {
      setSaving(false);
    }
  };

  const crumbs = ["Dashboard", "Settings", "Invoice Theme"];

  if (!info) {
    return (
      <div>
        <PageHeader title="Invoice Theme" crumbs={crumbs} />
        <div className="loading-row">{error ? error : <Loader />}</div>
      </div>
    );
  }

  const dirty = theme !== info.theme || accent !== info.accent;
  const lockedCount = info.themes.length - info.allowed.length;

  return (
    <div>
      <PageHeader title="Invoice Theme" crumbs={crumbs} />
      {toast && <Toast message={toast} />}
      {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="list-card">
        <div className="itheme-head">
          <div className="section-title" style={{ margin: 0 }}>Theme</div>
          <span className="itheme-tier">
            {TIER_LABEL[info.tier] || info.tier}
            {info.planName ? ` · ${info.planName} plan` : ""}
          </span>
        </div>

        <div className="itheme-grid">
          {info.themes.map((t) => {
            const locked = !info.allowed.includes(t.key);
            return (
              <button
                key={t.key}
                type="button"
                className={`itheme-card${theme === t.key ? " active" : ""}${locked ? " locked" : ""}`}
                onClick={() => !locked && setTheme(t.key)}
                disabled={locked}
              >
                <span
                  className={`itheme-preview fam-${t.family} paper-${t.paper}`}
                  style={{ "--inv-accent": info.canPickAccent ? accent : "#2f4a7d" }}
                >
                  <span className="itheme-preview-head" />
                  <span className="itheme-preview-line" />
                  <span className="itheme-preview-line short" />
                  <span className="itheme-preview-line" />
                </span>
                <span className="itheme-name">
                  {t.label}
                  {locked && <Icon name="lock" size={13} />}
                </span>
                <span className="itheme-desc">{t.description}</span>
                {locked && <span className="itheme-badge">{TIER_LABEL[t.tier]}</span>}
              </button>
            );
          })}
        </div>

        {lockedCount > 0 && (
          <div className="itheme-upsell">
            {lockedCount} theme{lockedCount === 1 ? "" : "s"} are available on a higher plan.
            Contact TechB Software Solutions to upgrade.
          </div>
        )}
      </div>

      <div className="list-card" style={{ marginTop: 18 }}>
        <div className="itheme-head">
          <div className="section-title" style={{ margin: 0 }}>Colour</div>
          {!info.canPickAccent && <span className="itheme-tier">Advanced plan</span>}
        </div>
        {info.canPickAccent ? (
          <div className="itheme-accents">
            {ACCENTS.map((a) => (
              <button
                key={a.value}
                type="button"
                className={`itheme-accent${accent === a.value ? " active" : ""}`}
                onClick={() => setAccent(a.value)}
                title={a.label}
              >
                <span style={{ background: a.value }} />
                {a.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="field-hint" style={{ marginTop: 0 }}>
            Invoices print in the standard colour on this plan.
          </p>
        )}
      </div>

      <div className="add-form-actions" style={{ marginTop: 18 }}>
        <button type="button" className="btn" onClick={load} disabled={saving || !dirty}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save Theme"}
        </button>
      </div>
    </div>
  );
}
