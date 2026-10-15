import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import Loader from "../../components/ui/Loader";
import Icon from "../../components/ui/Icon";
import MasterKeyGate, { masterKeyHeader, useRelockOnInvalidKey } from "./MasterKeyGate";
import { themeCss, isLight, DEFAULT_THEME } from "../../utils/themeTokens";
import Select from "../../components/forms/Select";

const MODE_LABELS = { light: "Light", dark: "Dark", sepia: "Sepia" };

const COLOURS = [
  ["sidebar", "Sidebar", "The navigation panel's background."],
  ["sidebarActive", "Active menu", "The solid pill behind the page you are on."],
  ["sidebarText", "Sidebar text", "Resting colour of menu labels."],
  ["primary", "Primary", "Buttons, links and focus rings."],
];

// A miniature of the app, painted with the values currently in the form. It
// scopes the generated CSS to its own container, so the preview can show a
// brand without repainting the admin panel around it.
function Preview({ theme }) {
  const css = themeCss(theme).replace(/:root\[data-theme="dark"\][\s\S]*$/, "").replace(":root", ".theme-preview");
  const activeText = isLight(theme.sidebarActive) ? "#111827" : "#ffffff";
  return (
    <>
      <style>{css}</style>
      <div className="theme-preview">
        <div className="theme-preview-side" style={{ background: theme.sidebar }}>
          <span className="theme-preview-brand" style={{ color: theme.sidebarText }}>
            Acme Ltd
          </span>
          <span className="theme-preview-nav" style={{ background: theme.sidebarActive, color: activeText }}>
            <Icon name="home" size={14} /> Dashboard
          </span>
          {["Customers", "Sales"].map((l) => (
            <span key={l} className="theme-preview-nav" style={{ color: theme.sidebarText }}>
              <Icon name="users" size={14} /> {l}
            </span>
          ))}
        </div>
        <div className="theme-preview-main">
          <div className="theme-preview-card" style={{ borderRadius: `${theme.radius}px` }}>
            <div className="theme-preview-title">Invoice #1042</div>
            <div className="theme-preview-row" />
            <div className="theme-preview-row short" />
            <div className="theme-preview-actions">
              <span className="theme-preview-btn ghost" style={{ borderRadius: `${theme.radius}px` }}>
                Cancel
              </span>
              <span
                className="theme-preview-btn"
                style={{ background: theme.primary, borderRadius: `${theme.radius}px` }}
              >
                Save
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ThemeFormInner() {
  const { code } = useParams();
  const isEdit = Boolean(code);
  const navigate = useNavigate();
  const relockOnInvalidKey = useRelockOnInvalidKey();
  const [modes, setModes] = useState(["light", "dark", "sepia"]);
  const [form, setForm] = useState(
    isEdit ? null : { ...DEFAULT_THEME, name: "", description: "", status: "active", modes: ["light", "dark"] }
  );
  const [saved, setSaved] = useState(null);
  const [usedBy, setUsedBy] = useState([]);
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    api
      .get("/api/admin/themes", masterKeyHeader())
      .then((r) => {
        if (r.modes) setModes(r.modes);
        if (!isEdit) return;
        const found = (r.themes || []).find((t) => t.code === code);
        if (!found) throw new Error("Theme not found.");
        const initial = {
          name: found.name || "",
          description: found.description || "",
          sidebar: found.sidebar,
          sidebarActive: found.sidebarActive,
          sidebarText: found.sidebarText,
          primary: found.primary,
          radius: found.radius,
          modes: found.modes || ["light"],
          defaultMode: found.defaultMode || "light",
          status: found.status || "active",
        };
        setForm(initial);
        setSaved(initial);
        setUsedBy(found.usedBy || []);
        setIsDefault(Boolean(found.isDefault));
      })
      .catch((err) => {
        if (relockOnInvalidKey(err)) return;
        setLoadError(err.message || "Could not load that theme.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, isEdit]);

  const set = (field) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  const toggleMode = (id, on) =>
    setForm((f) => {
      const next = new Set(f.modes || []);
      if (on) next.add(id);
      else next.delete(id);
      const list = modes.filter((m) => next.has(m));
      // Never leave a theme with nothing to render: unticking the last mode
      // is simply not applied.
      if (list.length === 0) return f;
      return { ...f, modes: list, defaultMode: list.includes(f.defaultMode) ? f.defaultMode : list[0] };
    });

  if (isEdit && !form) {
    return (
      <div>
        <PageHeader title="Edit Theme" crumbs={["Admin", "Theme Management", "Edit"]} />
        <div className="loading-row">{loadError ? loadError : <Loader />}</div>
      </div>
    );
  }

  const handleSave = async () => {
    if (saving) return;
    setError("");
    if (!form.name.trim()) return setError("Theme name is required.");
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        sidebar: form.sidebar,
        sidebarActive: form.sidebarActive,
        sidebarText: form.sidebarText,
        primary: form.primary,
        radius: Number(form.radius),
        modes: form.modes,
        defaultMode: form.defaultMode,
        status: form.status,
      };
      if (isEdit) {
        await api.put(`/api/admin/themes/${encodeURIComponent(code)}`, payload, masterKeyHeader());
        navigate("/admin/themes", { state: { toast: `"${form.name}" updated.` } });
      } else {
        const created = await api.post("/api/admin/themes", payload, masterKeyHeader());
        navigate("/admin/themes", { state: { toast: `Theme "${created.name}" added.` } });
      }
    } catch (err) {
      if (relockOnInvalidKey(err)) return;
      setError(err.message || "Could not save this theme.");
      setSaving(false);
    }
  };

  const title = isEdit ? `Edit Theme — ${form.name || code}` : "Add Theme";

  return (
    <div>
      <PageHeader title={title} crumbs={["Admin", "Theme Management", title]} />

      <div className="list-card add-page-card">
        <div className="section-title">Theme Details</div>
        {error && <div className="login-error">{error}</div>}

        {usedBy.length > 0 && (
          <div className="sub-price-card empty" style={{ marginBottom: 16 }}>
            In use by <strong>{usedBy.join(", ")}</strong>
            {isDefault ? " — and by anyone without a theme of their own, since this is the platform default." : "."}{" "}
            Saving repaints their app the next time it loads.
          </div>
        )}

        <div className="settings-form">
          <div className="field">
            <label>Theme Name <span style={{ color: "var(--red)" }}>*</span></label>
            <input type="text" value={form.name} onChange={set("name")} placeholder="e.g. Ocean" />
          </div>
          <div className="field">
            <label>Status</label>
            <Select value={form.status} onChange={set("status")} disabled={isDefault}>
              <option value="active">active</option>
              <option value="archived">archived</option>
            </Select>
            {isDefault && <span className="field-hint">The platform default stays active.</span>}
          </div>
          <div className="field full">
            <label>Description</label>
            <input
              type="text"
              value={form.description}
              onChange={set("description")}
              placeholder="Who this brand is for"
            />
          </div>
        </div>

        <div className="section-title" style={{ marginTop: 26 }}>Colours</div>
        <p className="field-hint" style={{ marginTop: 0 }}>
          Four colours, not forty. Hover shades, soft backgrounds and the dark-mode variants are worked out from
          these, so a brand cannot end up with unreadable buttons or green error messages.
        </p>

        <div className="theme-colours">
          {COLOURS.map(([key, label, hint]) => (
            <label key={key} className="theme-colour">
              <input type="color" value={form[key]} onChange={set(key)} />
              <span className="theme-colour-body">
                <span className="theme-colour-head">
                  {label}
                  <code>{form[key]}</code>
                </span>
                <em>{hint}</em>
              </span>
            </label>
          ))}
        </div>

        <div className="settings-form" style={{ marginTop: 6 }}>
          <div className="field">
            <label>Corner Radius ({form.radius}px)</label>
            <input type="range" min="0" max="24" value={form.radius} onChange={set("radius")} />
          </div>
        </div>

        <div className="section-title" style={{ marginTop: 26 }}>Modes On Offer</div>
        <p className="field-hint" style={{ marginTop: 0 }}>
          Which surfaces a client on this theme can switch between from their profile menu, and which one they
          start on.
        </p>

        <div className="addon-picker">
          {modes.map((id) => {
            const on = (form.modes || []).includes(id);
            return (
              <label key={id} className={`addon-option${on ? " is-on" : ""}`}>
                <input type="checkbox" checked={on} onChange={(e) => toggleMode(id, e.target.checked)} />
                <span className="addon-option-body">
                  <span className="addon-option-head">{MODE_LABELS[id] || id}</span>
                  <em>
                    {on && form.defaultMode === id ? (
                      "Starts here"
                    ) : on ? (
                      <button
                        type="button"
                        className="linklike"
                        onClick={() => setForm((f) => ({ ...f, defaultMode: id }))}
                      >
                        Make the starting mode
                      </button>
                    ) : (
                      "Not offered"
                    )}
                  </em>
                </span>
              </label>
            );
          })}
        </div>

        <div className="section-title" style={{ marginTop: 26 }}>Preview</div>
        <Preview theme={form} />

        <div className="add-form-actions">
          <button
            type="button"
            className="btn"
            onClick={() => (isEdit ? setForm(saved) : navigate("/admin/themes"))}
            disabled={saving}
          >
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Theme"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ThemeForm() {
  return (
    <MasterKeyGate>
      <ThemeFormInner />
    </MasterKeyGate>
  );
}
