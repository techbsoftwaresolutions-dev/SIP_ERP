import { useEffect, useState } from "react";
import api, { clearSwrCache } from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/ui/Icon";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Loader from "../../components/ui/Loader";
import Toast from "../../components/ui/Toast";
import Select from "../../components/forms/Select";

// Grouped so the picker can use <optgroup> — this list is also the single
// source of truth for which entities support custom fields on the frontend.
// (Warehouse has no Add/Edit page of its own — only a name-only quick-create
// — so there is nowhere for a Warehouse field to show up, and it is left out
// here on purpose.)
const ENTITY_GROUPS = [
  {
    group: "Master Data",
    entities: [
      { key: "customer", label: "Customers" },
      { key: "supplier", label: "Suppliers" },
      { key: "item", label: "Items" },
      { key: "category", label: "Categories" },
      { key: "brand", label: "Brands" },
    ],
  },
  {
    group: "Sales",
    entities: [
      { key: "enquiry", label: "Enquiries" },
      { key: "quotation", label: "Quotations" },
      { key: "sales-order", label: "Sales Orders" },
      { key: "delivery-challan", label: "Delivery Challan" },
      { key: "sales-invoice", label: "Sales Invoices" },
      { key: "sales-return", label: "Sales Return" },
    ],
  },
  {
    group: "Purchase",
    entities: [
      { key: "purchase-order", label: "Purchase Orders" },
      { key: "goods-receipt", label: "Goods Receipt" },
      { key: "purchase-invoice", label: "Purchase Invoices" },
      { key: "purchase-return", label: "Purchase Return" },
    ],
  },
  {
    group: "Manufacturing",
    entities: [
      { key: "bom", label: "Bill of Materials" },
      { key: "work-order", label: "Work Orders" },
      { key: "job-card", label: "Job Cards" },
      { key: "work-center", label: "Work Centers" },
      { key: "machine", label: "Machines" },
    ],
  },
  {
    group: "Other",
    entities: [{ key: "maintenance-task", label: "Maintenance Tasks" }],
  },
];
const ENTITIES = ENTITY_GROUPS.flatMap((g) => g.entities);

const TYPE_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Long Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
];

const TYPE_LABEL = Object.fromEntries(TYPE_OPTIONS.map((t) => [t.value, t.label]));

const blankForm = { label: "", type: "text", options: "", required: false };

export default function CustomFields() {
  const [entity, setEntity] = useState("customer");
  const [fields, setFields] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [editing, setEditing] = useState(null); // field being edited, or {} for a new one
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [movingId, setMovingId] = useState("");

  const load = () => {
    setFields(null);
    setError("");
    api
      .get(`/api/custom-fields?entity=${entity}`)
      .then((r) => setFields(r.fields || []))
      .catch((err) => setError(err.message || "Could not load custom fields."));
  };

  useEffect(load, [entity]);

  const flash = (m) => {
    setToast(m);
    setTimeout(() => setToast(""), 3000);
  };

  const openAdd = () => {
    setForm(blankForm);
    setFormError("");
    setEditing({});
  };

  const openEdit = (f) => {
    setForm({ label: f.label, type: f.type, options: (f.options || []).join(", "), required: f.required });
    setFormError("");
    setEditing(f);
  };

  const save = async () => {
    const label = form.label.trim();
    if (!label) return setFormError("Label is required.");
    if (form.type === "select" && !form.options.trim()) {
      return setFormError("Add at least one option, separated by commas.");
    }
    setSaving(true);
    setFormError("");
    const payload = {
      label,
      type: form.type,
      required: form.required,
      options: form.type === "select" ? form.options.split(",").map((o) => o.trim()).filter(Boolean) : [],
    };
    try {
      if (editing.id) {
        await api.put(`/api/custom-fields/${encodeURIComponent(editing.id)}`, payload);
      } else {
        await api.post("/api/custom-fields", { ...payload, entity });
      }
      clearSwrCache();
      setEditing(null);
      load();
      flash(editing.id ? "Field updated." : "Field added.");
    } catch (err) {
      setFormError(err.message || "Could not save this field.");
    } finally {
      setSaving(false);
    }
  };

  // Swaps this field's `order` with its neighbor — moves one position
  // without renumbering the rest of the list, same as the admin's Payment
  // Methods reordering.
  const move = async (row, delta) => {
    const i = fields.findIndex((f) => f.id === row.id);
    const swap = fields[i + delta];
    if (!swap) return;
    setMovingId(row.id);
    try {
      await api.put(`/api/custom-fields/${encodeURIComponent(row.id)}`, { order: swap.order });
      await api.put(`/api/custom-fields/${encodeURIComponent(swap.id)}`, { order: row.order });
      clearSwrCache();
      load();
    } catch (err) {
      setError(err.message || "Could not reorder that field.");
    } finally {
      setMovingId("");
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/api/custom-fields/${encodeURIComponent(deleteTarget.id)}`);
      clearSwrCache();
      setDeleteTarget(null);
      load();
      flash(`Removed "${deleteTarget.label}".`);
    } catch (err) {
      setError(err.message || "Could not remove this field.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader title="Settings" crumbs={["Dashboard", "Settings", "Custom Fields"]} />
      {toast && <Toast message={toast} />}

      <div className="list-card">
        <div className="section-title">Custom Fields</div>

        <div className="cf-entity-picker">
          <label>Menu</label>
          <Select value={entity} onChange={(e) => setEntity(e.target.value)}>
            {ENTITY_GROUPS.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.entities.map((e) => (
                  <option key={e.key} value={e.key}>{e.label}</option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>

        {error && <div className="login-error">{error}</div>}

        {fields === null ? (
          <div className="loading-row"><Loader /></div>
        ) : fields.length === 0 ? (
          <div className="sub-price-card empty">No custom fields on {ENTITIES.find((e) => e.key === entity).label} yet.</div>
        ) : (
          <div className="tpl-list">
            {fields.map((f, i) => {
              const busy = Boolean(movingId);
              return (
                <div key={f.id} className="tpl-row">
                  <span className="tpl-row-main">
                    <span className="tpl-row-head">
                      {f.label}
                      <code>{f.key}</code>
                      <span className="tpl-row-paper">{TYPE_LABEL[f.type] || f.type}</span>
                      {f.required && <span className="tpl-row-paper">Required</span>}
                    </span>
                    {f.type === "select" && f.options.length > 0 && <em>Options: {f.options.join(", ")}</em>}
                  </span>
                  <span className="tpl-row-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      title="Move up"
                      disabled={busy || i === 0}
                      onClick={() => move(f, -1)}
                    >
                      <Icon name="chevronUp" />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Move down"
                      disabled={busy || i === fields.length - 1}
                      onClick={() => move(f, 1)}
                    >
                      <Icon name="chevronDown" />
                    </button>
                    <button type="button" className="icon-btn" title="Edit" disabled={busy} onClick={() => openEdit(f)}>
                      <Icon name="edit" />
                    </button>
                    <button
                      type="button"
                      className="icon-btn danger"
                      title="Delete"
                      disabled={busy}
                      onClick={() => setDeleteTarget(f)}
                    >
                      <Icon name="trash" />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} onClick={openAdd}>
          <Icon name="edit" size={15} /> + Add Field
        </button>
      </div>

      {editing && (
        <Modal title={editing.id ? "Edit Field" : "Add Field"} onClose={() => setEditing(null)}>
          <div className="add-form" style={{ padding: 0 }}>
            {formError && <div className="login-error">{formError}</div>}
            <div className="field">
              <label>Label</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. PAN Number"
                autoFocus
              />
            </div>
            <div className="field">
              <label>Field Type</label>
              <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
            </div>
            {form.type === "select" && (
              <div className="field">
                <label>Options (comma separated)</label>
                <input
                  type="text"
                  value={form.options}
                  onChange={(e) => setForm((f) => ({ ...f, options: e.target.value }))}
                  placeholder="e.g. Individual, Company, Trust"
                />
              </div>
            )}
            <label className="menu-override-toggle">
              <input
                type="checkbox"
                checked={form.required}
                onChange={(e) => setForm((f) => ({ ...f, required: e.target.checked }))}
              />
              <span>Required on the form</span>
            </label>
            <div className="add-form-actions">
              <button type="button" className="btn" onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? "Saving…" : editing.id ? "Save Changes" : "Add Field"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this field?"
          message={`Remove "${deleteTarget.label}" from the ${ENTITIES.find((e) => e.key === entity).label} form. Values already saved under it stay on existing records, but won't be shown or editable anymore.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirming={deleting}
        />
      )}
    </div>
  );
}
