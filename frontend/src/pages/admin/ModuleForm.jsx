import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import Loader from "../../components/ui/Loader";
import MasterKeyGate, { masterKeyHeader, useRelockOnInvalidKey } from "./MasterKeyGate";
import Select from "../../components/forms/Select";

// Edit-only: a module's identity comes from the code catalogue, so there is
// no create or delete here. `key` is what every plan, add-on and per-client
// override points at, which is why it is shown read-only.
function ModuleFormInner() {
  const { key } = useParams();
  const navigate = useNavigate();
  const relockOnInvalidKey = useRelockOnInvalidKey();
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    api
      .get("/api/admin/modules", masterKeyHeader())
      .then((r) => {
        const found = (r.modules || []).find((m) => m.key === key);
        if (!found) throw new Error("Module not found.");
        const initial = {
          label: found.label || "",
          description: found.description || "",
          order: found.order ?? 0,
          core: Boolean(found.core),
          addOnOnly: Boolean(found.addOnOnly),
          status: found.status || "active",
        };
        setForm(initial);
        setSaved(initial);
      })
      .catch((err) => {
        if (relockOnInvalidKey(err)) return;
        setLoadError(err.message || "Could not load that module.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  if (!form) {
    return (
      <div>
        <PageHeader title="Edit Module" crumbs={["Admin", "Modules", "Edit Module"]} />
        <div className="loading-row">{loadError ? loadError : <Loader />}</div>
      </div>
    );
  }

  const handleSave = async () => {
    if (saving) return;
    setError("");
    setSaving(true);
    try {
      await api.put(
        `/api/admin/modules/${encodeURIComponent(key)}`,
        {
          description: form.description,
          core: form.core,
          addOnOnly: form.addOnOnly,
          status: form.status,
        },
        masterKeyHeader()
      );
      navigate("/admin/modules", { state: { toast: `${form.label || key} updated.` } });
    } catch (err) {
      if (relockOnInvalidKey(err)) return;
      setError(err.message || "Could not save this module.");
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={`Edit Module — ${form.label || key}`}
        crumbs={["Admin", "Modules", form.label || key]}
      />

      <div className="list-card add-page-card">
        <div className="section-title">Module Details</div>
        {error && <div className="login-error">{error}</div>}

        <div className="settings-form">
          <div className="field">
            <label>Display Name</label>
            <input type="text" value={form.label} readOnly className="field-readonly" />
            <span className="field-hint">Rename it in Menu Management.</span>
          </div>
          <div className="field">
            <label>Key</label>
            <input type="text" value={key} readOnly className="field-readonly" />
          </div>
          <div className="field full">
            <label>Description</label>
            <input
              type="text"
              value={form.description}
              onChange={set("description")}
              placeholder="What this module covers — shown on plan and add-on screens"
            />
          </div>

          <div className="field">
            <label>Status</label>
            <Select value={form.status} onChange={set("status")}>
              <option value="active">active</option>
              <option value="disabled">disabled</option>
            </Select>
          </div>
        </div>

        <div className="section-title" style={{ marginTop: 26 }}>How It Is Sold</div>

        <label className="menu-override-toggle">
          <input type="checkbox" checked={form.core} onChange={set("core")} />
          <span>
            Core module
            <em>Always available to every client — no plan, add-on or per-client limit can take it away.</em>
          </span>
        </label>

        <label className="menu-override-toggle">
          <input type="checkbox" checked={form.addOnOnly} onChange={set("addOnOnly")} />
          <span>
            Sold as an add-on only
            <em>Kept out of the plan menu picker, so access can only come from an add-on.</em>
          </span>
        </label>

        {form.status === "disabled" && (
          <div className="sub-price-card empty">
            Switched off for <strong>every client</strong>, whatever their plan says. Use this to withdraw a module,
            not to tailor one client — that is the menu limit on their own record.
          </div>
        )}

        <div className="add-form-actions">
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

export default function ModuleForm() {
  return (
    <MasterKeyGate>
      <ModuleFormInner />
    </MasterKeyGate>
  );
}
