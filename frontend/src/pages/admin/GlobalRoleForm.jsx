import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import Loader from "../../components/ui/Loader";
import PermissionMatrix from "../../components/forms/PermissionMatrix";
import MasterKeyGate, { masterKeyHeader, useRelockOnInvalidKey } from "./MasterKeyGate";
import Select from "../../components/forms/Select";

const STATUS_OPTIONS = ["active", "archived"];

function GlobalRoleFormInner() {
  const { code } = useParams();
  const isEdit = Boolean(code);
  const navigate = useNavigate();
  const relockOnInvalidKey = useRelockOnInvalidKey();
  const [catalogue, setCatalogue] = useState({ modules: [], actions: [] });
  const [form, setForm] = useState(isEdit ? null : { name: "", description: "", status: "active", permissions: [] });
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    api
      .get("/api/admin/permission-catalogue", masterKeyHeader())
      .then(setCatalogue)
      .catch(() => setCatalogue({ modules: [], actions: [] }));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api
      .get("/api/admin/global-roles", masterKeyHeader())
      .then((r) => {
        const found = (r.roles || []).find((x) => x.code === code);
        if (!found) throw new Error("Global role not found.");
        const initial = {
          name: found.name || "",
          description: found.description || "",
          status: found.status || "active",
          permissions: found.permissions || [],
          protected: Boolean(found.protected),
        };
        setForm(initial);
        setSaved(initial);
      })
      .catch((err) => {
        if (relockOnInvalidKey(err)) return;
        setLoadError(err.message || "Could not load that template.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, isEdit]);

  const set = (field) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  if (isEdit && !form) {
    return (
      <div>
        <PageHeader title="Edit Global Role" crumbs={["Admin", "Global Roles", "Edit"]} />
        <div className="loading-row">{loadError ? loadError : <Loader />}</div>
      </div>
    );
  }

  const handleSave = async () => {
    if (saving) return;
    setError("");
    if (!form.name.trim()) return setError("Role name is required.");
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        status: form.status,
        permissions: form.permissions,
      };
      if (isEdit) {
        await api.put(`/api/admin/global-roles/${encodeURIComponent(code)}`, payload, masterKeyHeader());
        navigate("/admin/global-roles", { state: { toast: `"${form.name}" updated.` } });
      } else {
        const created = await api.post("/api/admin/global-roles", payload, masterKeyHeader());
        navigate("/admin/global-roles", { state: { toast: `Template "${created.name}" added.` } });
      }
    } catch (err) {
      if (relockOnInvalidKey(err)) return;
      setError(err.message || "Could not save this template.");
      setSaving(false);
    }
  };

  const title = isEdit ? `Edit Global Role — ${form.name || code}` : "Add Global Role";

  return (
    <div>
      <PageHeader title={title} crumbs={["Admin", "Global Roles", title]} />

      <div className="list-card add-page-card">
        <div className="section-title">Template Details</div>
        {error && <div className="login-error">{error}</div>}
        <p className="field-hint" style={{ marginTop: 0 }}>
          This is a template, not a role anyone signs in with. Saving it changes nothing for existing clients
          until you apply it to them from the Global Roles list.
        </p>

        <div className="settings-form">
          <div className="field">
            <label>Role Name <span style={{ color: "var(--red)" }}>*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={set("name")}
              placeholder="e.g. Sales Executive"
            />
          </div>
          <div className="field">
            <label>Status</label>
            <Select value={form.status} onChange={set("status")}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
          <div className="field full">
            <label>Description</label>
            <input
              type="text"
              value={form.description}
              onChange={set("description")}
              placeholder="What this role is for — copied into each client alongside the permissions"
            />
          </div>
        </div>

        <div className="section-title" style={{ marginTop: 26 }}>Permissions</div>
        {catalogue.modules.length === 0 ? (
          <div className="loading-row"><Loader /></div>
        ) : (
          <PermissionMatrix
            modules={catalogue.modules}
            actions={catalogue.actions}
            value={form.permissions}
            onChange={(next) => setForm((f) => ({ ...f, permissions: next }))}
          />
        )}

        <div className="add-form-actions">
          <button
            type="button"
            className="btn"
            onClick={() => (isEdit ? setForm(saved) : navigate("/admin/global-roles"))}
            disabled={saving}
          >
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Global Role"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GlobalRoleForm() {
  return (
    <MasterKeyGate>
      <GlobalRoleFormInner />
    </MasterKeyGate>
  );
}
