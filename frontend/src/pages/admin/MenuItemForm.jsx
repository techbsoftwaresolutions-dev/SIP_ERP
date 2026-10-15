import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import Loader from "../../components/ui/Loader";
import Icon from "../../components/ui/Icon";
import MasterKeyGate, { masterKeyHeader, useRelockOnInvalidKey } from "./MasterKeyGate";

// Edit-only: which menu items exist is decided by the catalogue in
// backend/menuCatalogue.js, so there is no create or delete here — only what
// an existing item is called and which icon it carries.
function MenuItemFormInner() {
  const { key } = useParams();
  const navigate = useNavigate();
  const relockOnInvalidKey = useRelockOnInvalidKey();
  const [icons, setIcons] = useState([]);
  const [item, setItem] = useState(null);
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    api
      .get("/api/admin/menus", masterKeyHeader())
      .then((r) => {
        setIcons(r.icons || []);
        const found = (r.menu || []).find((m) => m.key === key);
        if (!found) throw new Error("Menu item not found.");
        setItem(found);
        const initial = { label: found.label, icon: found.icon, hidden: Boolean(found.hidden) };
        setForm(initial);
        setSaved(initial);
      })
      .catch((err) => {
        if (relockOnInvalidKey(err)) return;
        setLoadError(err.message || "Could not load that menu item.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!form) {
    return (
      <div>
        <PageHeader title="Menu Item" crumbs={["Admin", "Menu Management", "Edit"]} />
        <div className="loading-row">{loadError ? loadError : <Loader />}</div>
      </div>
    );
  }

  const save = async (body, toast) => {
    setSaving(true);
    setError("");
    try {
      await api.put(`/api/admin/menus/${encodeURIComponent(key)}`, body, masterKeyHeader());
      navigate("/admin/menus", { state: { toast } });
    } catch (err) {
      if (relockOnInvalidKey(err)) return;
      setError(err.message || "Could not save this menu item.");
      setSaving(false);
    }
  };

  const handleSave = () =>
    save({ label: form.label, icon: form.icon, hidden: form.hidden }, `${form.label || key} updated.`);

  const handleReset = async () => {
    setSaving(true);
    setError("");
    try {
      await api.delete(`/api/admin/menus/${encodeURIComponent(key)}`, masterKeyHeader());
      navigate("/admin/menus", { state: { toast: `${item.defaultLabel} is back to its shipped label and icon.` } });
    } catch (err) {
      if (relockOnInvalidKey(err)) return;
      setError(err.message || "Could not reset this menu item.");
      setSaving(false);
    }
  };

  const changed = form.label !== item.defaultLabel || form.icon !== item.defaultIcon || form.hidden;
  const title = `Edit Menu — ${item.defaultLabel}`;

  return (
    <div>
      <PageHeader title={title} crumbs={["Admin", "Menu Management", item.defaultLabel]} />

      <div className="list-card add-page-card">
        <div className="section-title">Menu Item</div>
        {error && <div className="login-error">{error}</div>}

        <div className="settings-form">
          <div className="field">
            <label>Label</label>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder={item.defaultLabel}
            />
            {form.label !== item.defaultLabel && (
              <span className="field-hint">Ships as “{item.defaultLabel}”.</span>
            )}
          </div>
          <div className="field">
            <label>Key</label>
            <input type="text" value={item.key} readOnly className="field-readonly" />
          </div>
          {item.module && (
            <div className="field">
              <label>Gated By Module</label>
              <input type="text" value={item.module} readOnly className="field-readonly" />
            </div>
          )}
        </div>

        <div className="section-title" style={{ marginTop: 26 }}>Icon</div>
        <div className="icon-picker">
          {icons.map((name) => (
            <button
              key={name}
              type="button"
              className={`icon-choice${form.icon === name ? " is-on" : ""}`}
              title={name}
              onClick={() => setForm((f) => ({ ...f, icon: name }))}
            >
              <Icon name={name} size={17} />
            </button>
          ))}
        </div>

        <div className="section-title" style={{ marginTop: 26 }}>Visibility</div>
        <label className="menu-override-toggle">
          <input
            type="checkbox"
            checked={form.hidden}
            onChange={(e) => setForm((f) => ({ ...f, hidden: e.target.checked }))}
          />
          <span>
            Hide from the sidebar
            <em>
              Presentation only — the pages behind it keep working for anyone with the URL. To actually withdraw
              it, disable the module in Modules or narrow that client’s menus on their own record.
            </em>
          </span>
        </label>

        <div className="add-form-actions">
          {changed && (
            <button type="button" className="btn" onClick={handleReset} disabled={saving}>
              Reset to default
            </button>
          )}
          <button type="button" className="btn" onClick={() => setForm(saved)} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MenuItemForm() {
  return (
    <MasterKeyGate>
      <MenuItemFormInner />
    </MasterKeyGate>
  );
}
