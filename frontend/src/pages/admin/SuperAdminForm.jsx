import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import adminApi from "../../api/adminClient";
import PageHeader from "../../components/layout/PageHeader";
import Loader from "../../components/ui/Loader";
import { useAdminAuth } from "../../context/AdminAuthContext";
import Select from "../../components/forms/Select";
import PasswordInput from "../../components/forms/PasswordInput";

const ROLES = ["operator", "owner"];

const ROLE_NOTE = {
  operator: "Can run the platform — clients, plans, menus, themes — but cannot add or change super admins.",
  owner: "Everything an operator can do, plus managing who else has access to this panel.",
};

export default function SuperAdminForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { admin } = useAdminAuth();
  const isOwner = admin?.role === "owner";

  const [form, setForm] = useState(
    isEdit ? null : { name: "", email: "", password: "", role: "operator", status: "active" }
  );
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!isEdit) return;
    adminApi
      .get("/api/admin/super-admins")
      .then((r) => {
        const found = (r.data || []).find((a) => a.id === id);
        if (!found) throw new Error("Super admin not found.");
        const initial = {
          name: found.name || "",
          email: found.email || "",
          // Blank means "leave the existing password alone" — it is never
          // sent back from the server, so there is nothing to prefill.
          password: "",
          role: found.role || "operator",
          status: found.status || "active",
        };
        setForm(initial);
        setSaved(initial);
      })
      .catch((err) => setLoadError(err.message || "Could not load that account."));
  }, [id, isEdit]);

  const set = (field) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  if (!isOwner) {
    return (
      <div>
        <PageHeader title="Super Admins" crumbs={["Admin", "Super Admins"]} />
        <div className="list-card">
          <div className="sub-price-card empty">
            Only an <strong>owner</strong> account can add or change super admins. You are signed in as an
            operator.
          </div>
        </div>
      </div>
    );
  }

  if (isEdit && !form) {
    return (
      <div>
        <PageHeader title="Super Admin" crumbs={["Admin", "Super Admins", "Edit"]} />
        <div className="loading-row">{loadError ? loadError : <Loader />}</div>
      </div>
    );
  }

  const isSelf = isEdit && admin && admin.id === id;

  const handleSave = async () => {
    if (saving) return;
    setError("");
    if (!form.name.trim()) return setError("A name is required.");
    if (!isEdit) {
      if (!form.email.trim()) return setError("An email is required.");
      if (form.password.length < 10) return setError("The password must be at least 10 characters.");
    } else if (form.password && form.password.length < 10) {
      return setError("A new password must be at least 10 characters.");
    }
    setSaving(true);
    try {
      if (isEdit) {
        const payload = { name: form.name, role: form.role, status: form.status };
        if (form.password) payload.password = form.password;
        await adminApi.put(`/api/admin/super-admins/${encodeURIComponent(id)}`, payload);
        navigate("/admin/super-admins", { state: { toast: `${form.name} updated.` } });
      } else {
        await adminApi.post("/api/admin/super-admins", {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
        });
        navigate("/admin/super-admins", { state: { toast: "Super admin added." } });
      }
    } catch (err) {
      setError(err.message || "Could not save this account.");
      setSaving(false);
    }
  };

  const title = isEdit ? `Edit Super Admin — ${form.name || ""}` : "Add Super Admin";

  return (
    <div>
      <PageHeader title={title} crumbs={["Admin", "Super Admins", isEdit ? form.name : "Add"]} />

      <div className="list-card add-page-card">
        <div className="section-title">Account</div>
        {error && <div className="login-error">{error}</div>}
        <p className="field-hint" style={{ marginTop: 0 }}>
          This account can reach <strong>every client’s data</strong>. Add one only for staff who need it.
        </p>

        <div className="settings-form">
          <div className="field">
            <label>Name <span style={{ color: "var(--red)" }}>*</span></label>
            <input type="text" value={form.name} onChange={set("name")} placeholder="Full name" />
          </div>
          <div className="field">
            <label>Email {!isEdit && <span style={{ color: "var(--red)" }}>*</span>}</label>
            <input
              type="email"
              value={form.email}
              onChange={set("email")}
              readOnly={isEdit}
              className={isEdit ? "field-readonly" : undefined}
              placeholder="you@example.com"
            />
            {isEdit && (
              <span className="field-hint">
                Sign-in address and audit trail — fixed for the life of the account.
              </span>
            )}
          </div>
          <div className="field">
            <label>Role</label>
            <Select value={form.role} onChange={set("role")} disabled={isSelf}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
            <span className="field-hint">{isSelf ? "You cannot change your own role." : ROLE_NOTE[form.role]}</span>
          </div>
          {isEdit && (
            <div className="field">
              <label>Status</label>
              <Select value={form.status} onChange={set("status")} disabled={isSelf}>
                <option value="active">active</option>
                <option value="disabled">disabled</option>
              </Select>
              <span className="field-hint">
                {isSelf ? "You cannot disable your own access." : "A disabled account cannot sign in."}
              </span>
            </div>
          )}
        </div>

        <div className="section-title" style={{ marginTop: 26 }}>Password</div>

        <div className="settings-form">
          <div className="field">
            <label>
              {isEdit ? "New Password" : "Password"}
              {!isEdit && <span style={{ color: "var(--red)" }}> *</span>}
            </label>
            <PasswordInput
              value={form.password}
              onChange={set("password")}
              placeholder="At least 10 characters"
              autoComplete="new-password"
            />
            <span className="field-hint">
              {isEdit
                ? "Leave blank to keep the current password. Setting one here is the in-app alternative to npm run create-admin."
                : "At least 10 characters. Stored hashed — never in plain text."}
            </span>
          </div>
        </div>

        <div className="add-form-actions">
          <button
            type="button"
            className="btn"
            onClick={() => (isEdit ? setForm(saved) : navigate("/admin/super-admins"))}
            disabled={saving}
          >
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Super Admin"}
          </button>
        </div>
      </div>
    </div>
  );
}
