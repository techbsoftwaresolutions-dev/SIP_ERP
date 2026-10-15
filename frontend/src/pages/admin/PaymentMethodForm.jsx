import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import Loader from "../../components/ui/Loader";
import MasterKeyGate, { masterKeyHeader, useRelockOnInvalidKey } from "./MasterKeyGate";
import Select from "../../components/forms/Select";

const BLANK = {
  label: "",
  description: "",
  requiresReference: false,
  referenceLabel: "",
  status: "active",
};

function PaymentMethodFormInner() {
  const { code } = useParams();
  const isEdit = Boolean(code);
  const navigate = useNavigate();
  const relockOnInvalidKey = useRelockOnInvalidKey();
  const [form, setForm] = useState(isEdit ? null : { ...BLANK });
  const [saved, setSaved] = useState(null);
  const [builtIn, setBuiltIn] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!isEdit) return;
    api
      .get("/api/admin/payment-methods", masterKeyHeader())
      .then((r) => {
        const found = (r.methods || []).find((m) => m.code === code);
        if (!found) throw new Error("Payment method not found.");
        const initial = {
          label: found.label || "",
          description: found.description || "",
          requiresReference: Boolean(found.requiresReference),
          referenceLabel: found.referenceLabel || "",
          status: found.status || "active",
        };
        setForm(initial);
        setSaved(initial);
        setBuiltIn(Boolean(found.builtIn));
        setIsDefault(Boolean(found.isDefault));
      })
      .catch((err) => {
        if (relockOnInvalidKey(err)) return;
        setLoadError(err.message || "Could not load that payment method.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, isEdit]);

  const set = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  if (isEdit && !form) {
    return (
      <div>
        <PageHeader title="Payment Method" crumbs={["Admin", "Payment Methods", "Edit"]} />
        <div className="loading-row">{loadError ? loadError : <Loader />}</div>
      </div>
    );
  }

  const handleSave = async () => {
    if (saving) return;
    setError("");
    if (!form.label.trim()) return setError("A name is required.");
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/api/admin/payment-methods/${encodeURIComponent(code)}`, form, masterKeyHeader());
        navigate("/admin/payment-methods", { state: { toast: `"${form.label}" updated.` } });
      } else {
        await api.post("/api/admin/payment-methods", form, masterKeyHeader());
        navigate("/admin/payment-methods", { state: { toast: `"${form.label}" added.` } });
      }
    } catch (err) {
      if (relockOnInvalidKey(err)) return;
      setError(err.message || "Could not save this payment method.");
      setSaving(false);
    }
  };

  const title = isEdit ? `Edit Payment Method — ${form.label || code}` : "Add Payment Method";

  return (
    <div>
      <PageHeader title={title} crumbs={["Admin", "Payment Methods", title]} />

      <div className="list-card add-page-card">
        <div className="section-title">Method Details</div>
        {error && <div className="login-error">{error}</div>}
        <p className="field-hint" style={{ marginTop: 0 }}>
          Invoices record the <strong>name</strong> set here, so renaming this never rewrites what past invoices
          say — an invoice already filed under the old name keeps it.
        </p>

        <div className="settings-form">
          <div className="field">
            <label>Name <span style={{ color: "var(--red)" }}>*</span></label>
            <input type="text" value={form.label} onChange={set("label")} placeholder="e.g. NEFT / RTGS" />
          </div>
          {isEdit && (
            <div className="field">
              <label>Code</label>
              <input type="text" value={code} readOnly className="field-readonly" />
            </div>
          )}
          <div className="field">
            <label>Status</label>
            <Select value={form.status} onChange={set("status")} disabled={isDefault}>
              <option value="active">active</option>
              <option value="disabled">disabled</option>
            </Select>
            {isDefault && (
              <span className="field-hint">
                New invoices start on this one, so it stays available. Move the default first.
              </span>
            )}
          </div>
          <div className="field full">
            <label>Description</label>
            <input
              type="text"
              value={form.description}
              onChange={set("description")}
              placeholder="Shown to super admins only, not on the invoice"
            />
          </div>
        </div>

        <div className="section-title" style={{ marginTop: 26 }}>Reference</div>

        <label className="menu-override-toggle">
          <input type="checkbox" checked={form.requiresReference} onChange={set("requiresReference")} />
          <span>
            Needs a reference
            <em>The invoice form asks for a number alongside the payment, and will not save without it.</em>
          </span>
        </label>

        {form.requiresReference && (
          <div className="settings-form">
            <div className="field">
              <label>What to ask for</label>
              <input
                type="text"
                value={form.referenceLabel}
                onChange={set("referenceLabel")}
                placeholder="e.g. Cheque number — defaults to “Reference”"
              />
            </div>
          </div>
        )}

        {builtIn && (
          <div className="sub-price-card empty" style={{ marginTop: 16 }}>
            This method ships with the platform. It can be renamed, reordered and switched off, but not deleted —
            the names invoices were filed under should keep existing somewhere.
          </div>
        )}

        <div className="add-form-actions">
          <button
            type="button"
            className="btn"
            onClick={() => (isEdit ? setForm(saved) : navigate("/admin/payment-methods"))}
            disabled={saving}
          >
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Method"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentMethodForm() {
  return (
    <MasterKeyGate>
      <PaymentMethodFormInner />
    </MasterKeyGate>
  );
}
