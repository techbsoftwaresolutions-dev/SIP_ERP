import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import Loader from "../../components/ui/Loader";
import MasterKeyGate, { masterKeyHeader, useRelockOnInvalidKey } from "./MasterKeyGate";
import Select from "../../components/forms/Select";

const BLANK = {
  name: "",
  description: "",
  documentType: "sales:invoices",
  condition: "amount_above",
  threshold: 50000,
  approverRoles: [],
  appliesTo: "all",
  planCodes: [],
  subdomains: [],
  status: "active",
};

const SCOPE_LABELS = {
  all: "Every client",
  plans: "Clients on certain plans",
  clients: "Specific clients",
};

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

function ApprovalRuleFormInner() {
  const { code } = useParams();
  const isEdit = Boolean(code);
  const navigate = useNavigate();
  const relockOnInvalidKey = useRelockOnInvalidKey();
  const [meta, setMeta] = useState(null);
  const [globalRoles, setGlobalRoles] = useState([]);
  const [form, setForm] = useState(isEdit ? null : { ...BLANK });
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get("/api/admin/approval-rules", masterKeyHeader()),
      api.get("/api/admin/global-roles", masterKeyHeader()).catch(() => ({ roles: [] })),
    ])
      .then(([r, g]) => {
        setMeta(r);
        setGlobalRoles((g.roles || []).map((x) => x.name).filter((n) => n.toLowerCase() !== "administrator"));
        if (!isEdit) return;
        const found = (r.rules || []).find((x) => x.code === code);
        if (!found) throw new Error("Approval rule not found.");
        const initial = {
          name: found.name || "",
          description: found.description || "",
          documentType: found.documentType,
          condition: found.condition || "always",
          threshold: found.threshold ?? 0,
          approverRoles: found.approverRoles || [],
          appliesTo: found.appliesTo || "all",
          planCodes: found.planCodes || [],
          subdomains: found.subdomains || [],
          status: found.status || "active",
        };
        setForm(initial);
        setSaved(initial);
      })
      .catch((err) => {
        if (relockOnInvalidKey(err)) return;
        setLoadError(err.message || "Could not load that rule.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, isEdit]);

  const set = (field) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  const toggleIn = (key, value, on) =>
    setForm((f) => {
      const next = new Set(f[key] || []);
      if (on) next.add(value);
      else next.delete(value);
      return { ...f, [key]: [...next] };
    });

  if (!meta || (isEdit && !form)) {
    return (
      <div>
        <PageHeader title="Approval Rule" crumbs={["Admin", "Approval Engine", "Rule"]} />
        <div className="loading-row">{loadError ? loadError : <Loader />}</div>
      </div>
    );
  }

  const { documentTypes, conditions, appliesTo, plans, clients } = meta;
  const condition = conditions.find((c) => c.key === form.condition) || conditions[0];
  const docLabel = (documentTypes.find((d) => d.key === form.documentType) || {}).label || form.documentType;

  // A plain-English restatement of the rule, so the effect is readable before
  // it is saved rather than only after something gets held.
  const summary = () => {
    const when = condition.needsThreshold
      ? `${condition.label.toLowerCase()} ${condition.unit === "₹" ? inr(form.threshold) : `${form.threshold}%`}`
      : "in every case";
    const who = form.approverRoles.length ? `${form.approverRoles.join(", ")} or an Administrator` : "an Administrator";
    const scope =
      form.appliesTo === "all"
        ? "every client"
        : form.appliesTo === "plans"
          ? `clients on ${form.planCodes.length || "no"} selected plan(s)`
          : `${form.subdomains.length || "no"} selected client(s)`;
    return `For ${scope}, a ${docLabel} ${when} waits until ${who} signs it off.`;
  };

  const handleSave = async () => {
    if (saving) return;
    setError("");
    if (!form.name.trim()) return setError("A rule name is required.");
    if (form.appliesTo === "plans" && form.planCodes.length === 0) {
      return setError("Pick at least one plan, or change the scope to every client.");
    }
    if (form.appliesTo === "clients" && form.subdomains.length === 0) {
      return setError("Pick at least one client, or change the scope to every client.");
    }
    setSaving(true);
    try {
      const payload = { ...form, threshold: Number(form.threshold) || 0 };
      if (isEdit) {
        await api.put(`/api/admin/approval-rules/${encodeURIComponent(code)}`, payload, masterKeyHeader());
        navigate("/admin/approval-rules", { state: { toast: `"${form.name}" updated.` } });
      } else {
        const created = await api.post("/api/admin/approval-rules", payload, masterKeyHeader());
        navigate("/admin/approval-rules", { state: { toast: `"${created.name}" created.` } });
      }
    } catch (err) {
      if (relockOnInvalidKey(err)) return;
      setError(err.message || "Could not save this rule.");
      setSaving(false);
    }
  };

  const title = isEdit ? `Edit Rule — ${form.name || code}` : "New Approval Rule";

  const Picker = ({ items, keyField, labelField, subField, stateKey }) => (
    <div className="addon-picker">
      {items.map((item) => {
        const value = item[keyField];
        const on = (form[stateKey] || []).includes(value);
        return (
          <label key={value} className={`addon-option${on ? " is-on" : ""}`}>
            <input type="checkbox" checked={on} onChange={(e) => toggleIn(stateKey, value, e.target.checked)} />
            <span className="addon-option-body">
              <span className="addon-option-head">{item[labelField]}</span>
              {subField && <em>{item[subField]}</em>}
            </span>
          </label>
        );
      })}
    </div>
  );

  return (
    <div>
      <PageHeader title={title} crumbs={["Admin", "Approval Engine", title]} />

      <div className="list-card add-page-card">
        <div className="section-title">Rule Details</div>
        {error && <div className="login-error">{error}</div>}

        <div className="settings-form">
          <div className="field">
            <label>Rule Name <span style={{ color: "var(--red)" }}>*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={set("name")}
              placeholder="e.g. Large invoice sign-off"
            />
          </div>
          <div className="field">
            <label>Status</label>
            <Select value={form.status} onChange={set("status")}>
              <option value="active">active</option>
              <option value="disabled">disabled</option>
            </Select>
          </div>
          <div className="field">
            <label>Document</label>
            <Select value={form.documentType} onChange={set("documentType")}>
              {documentTypes.map((d) => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </Select>
          </div>
          <div className="field">
            <label>When</label>
            <Select value={form.condition} onChange={set("condition")}>
              {conditions.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </Select>
          </div>
          {condition.needsThreshold && (
            <div className="field">
              <label>Threshold ({condition.unit})</label>
              <input type="number" min="0" value={form.threshold} onChange={set("threshold")} />
            </div>
          )}
          <div className="field full">
            <label>Description</label>
            <input
              type="text"
              value={form.description}
              onChange={set("description")}
              placeholder="Why this rule exists — shown on the rules list only"
            />
          </div>
        </div>

        <div className="section-title" style={{ marginTop: 26 }}>Who It Applies To</div>

        <div className="settings-form">
          <div className="field">
            <label>Scope</label>
            <Select value={form.appliesTo} onChange={set("appliesTo")}>
              {appliesTo.map((a) => (
                <option key={a} value={a}>{SCOPE_LABELS[a] || a}</option>
              ))}
            </Select>
          </div>
        </div>

        {form.appliesTo === "plans" && (
          <Picker items={plans} keyField="code" labelField="name" stateKey="planCodes" />
        )}
        {form.appliesTo === "clients" && (
          <Picker items={clients} keyField="subdomain" labelField="name" subField="subdomain" stateKey="subdomains" />
        )}

        <div className="section-title" style={{ marginTop: 26 }}>Who Can Approve</div>
        <p className="field-hint" style={{ marginTop: 0 }}>
          Administrator can always approve, whatever is ticked here — otherwise a rule whose role was renamed
          would leave documents nobody could clear.
        </p>
        <Picker
          items={globalRoles.map((n) => ({ name: n }))}
          keyField="name"
          labelField="name"
          stateKey="approverRoles"
        />

        <div className="sub-price-card" style={{ marginTop: 18 }}>
          <div className="sub-price-row">
            <span>{summary()}</span>
          </div>
        </div>

        <div className="add-form-actions">
          <button
            type="button"
            className="btn"
            onClick={() => (isEdit ? setForm(saved) : navigate("/admin/approval-rules"))}
            disabled={saving}
          >
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Rule"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ApprovalRuleForm() {
  return (
    <MasterKeyGate>
      <ApprovalRuleFormInner />
    </MasterKeyGate>
  );
}
