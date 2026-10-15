import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import Loader from "../../components/ui/Loader";
import MasterKeyGate, { masterKeyHeader, useRelockOnInvalidKey } from "./MasterKeyGate";
import DateInput from "../../components/forms/DateInput";
import Select from "../../components/forms/Select";

const BLANK = {
  title: "",
  body: "",
  link: "",
  severity: "info",
  audience: "all",
  planCodes: [],
  subdomains: [],
  startsAt: "",
  endsAt: "",
  status: "draft",
};

const AUDIENCE_LABELS = {
  all: "Every client",
  plans: "Clients on certain plans",
  clients: "Specific clients",
};

const SEVERITY_NOTE = {
  info: "Sits below anything needing action, so it never buries an overdue invoice.",
  warning: "Shown alongside work that is due soon.",
  critical: "Sorts to the very top, with overdue work. Use sparingly.",
};

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm"; the API returns ISO.
const toLocalInput = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function AnnouncementFormInner() {
  const { code } = useParams();
  const isEdit = Boolean(code);
  const navigate = useNavigate();
  const relockOnInvalidKey = useRelockOnInvalidKey();
  const [meta, setMeta] = useState(null);
  const [form, setForm] = useState(isEdit ? null : { ...BLANK });
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    api
      .get("/api/admin/announcements", masterKeyHeader())
      .then((r) => {
        setMeta(r);
        if (!isEdit) return;
        const found = (r.announcements || []).find((a) => a.code === code);
        if (!found) throw new Error("Announcement not found.");
        const initial = {
          title: found.title || "",
          body: found.body || "",
          link: found.link || "",
          severity: found.severity || "info",
          audience: found.audience || "all",
          planCodes: found.planCodes || [],
          subdomains: found.subdomains || [],
          startsAt: toLocalInput(found.startsAt),
          endsAt: toLocalInput(found.endsAt),
          status: found.status || "draft",
        };
        setForm(initial);
        setSaved(initial);
      })
      .catch((err) => {
        if (relockOnInvalidKey(err)) return;
        setLoadError(err.message || "Could not load that announcement.");
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
        <PageHeader title="Announcement" crumbs={["Admin", "Notifications", "Announcement"]} />
        <div className="loading-row">{loadError ? loadError : <Loader />}</div>
      </div>
    );
  }

  const { severities, audiences, plans, clients } = meta;

  const handleSave = async () => {
    if (saving) return;
    setError("");
    if (!form.title.trim()) return setError("A title is required.");
    if (form.audience === "plans" && form.planCodes.length === 0) {
      return setError("Pick at least one plan, or send it to every client.");
    }
    if (form.audience === "clients" && form.subdomains.length === 0) {
      return setError("Pick at least one client, or send it to every client.");
    }
    if (form.startsAt && form.endsAt && new Date(form.endsAt) < new Date(form.startsAt)) {
      return setError("The end date is before the start date.");
    }
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/api/admin/announcements/${encodeURIComponent(code)}`, form, masterKeyHeader());
        navigate("/admin/notifications", { state: { toast: `"${form.title}" updated.` } });
      } else {
        const created = await api.post("/api/admin/announcements", form, masterKeyHeader());
        navigate("/admin/notifications", { state: { toast: `"${created.title}" created.` } });
      }
    } catch (err) {
      if (relockOnInvalidKey(err)) return;
      setError(err.message || "Could not save this announcement.");
      setSaving(false);
    }
  };

  const title = isEdit ? `Edit Announcement — ${form.title || code}` : "New Announcement";

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
      <PageHeader title={title} crumbs={["Admin", "Notifications", title]} />

      <div className="list-card add-page-card">
        <div className="section-title">Message</div>
        {error && <div className="login-error">{error}</div>}

        <div className="settings-form">
          <div className="field">
            <label>Title <span style={{ color: "var(--red)" }}>*</span></label>
            <input
              type="text"
              value={form.title}
              onChange={set("title")}
              placeholder="e.g. Scheduled maintenance on Sunday"
            />
          </div>
          <div className="field">
            <label>Severity</label>
            <Select value={form.severity} onChange={set("severity")}>
              {severities.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
            <span className="field-hint">{SEVERITY_NOTE[form.severity]}</span>
          </div>
          <div className="field">
            <label>Status</label>
            <Select value={form.status} onChange={set("status")}>
              <option value="draft">draft</option>
              <option value="published">published</option>
            </Select>
            <span className="field-hint">
              {form.status === "draft" ? "Reaches nobody until published." : "Live in every targeted client's bell."}
            </span>
          </div>
          <div className="field full">
            <label>Body</label>
            <textarea
              rows={3}
              value={form.body}
              onChange={set("body")}
              placeholder="What clients need to know. Shown under the title in the bell."
            />
          </div>
          <div className="field full">
            <label>Link (optional)</label>
            <input type="text" value={form.link} onChange={set("link")} placeholder="/settings/company" />
            <span className="field-hint">
              A path inside the app, starting with <code>/</code>. External URLs are refused — an announcement
              should never send a client’s staff off-site.
            </span>
          </div>
        </div>

        <div className="section-title" style={{ marginTop: 26 }}>Who Sees It</div>

        <div className="settings-form">
          <div className="field">
            <label>Audience</label>
            <Select value={form.audience} onChange={set("audience")}>
              {audiences.map((a) => (
                <option key={a} value={a}>{AUDIENCE_LABELS[a] || a}</option>
              ))}
            </Select>
          </div>
          <div className="field">
            <label>Show From (optional)</label>
            <DateInput withTime value={form.startsAt} onChange={set("startsAt")} />
          </div>
          <div className="field">
            <label>Show Until (optional)</label>
            <DateInput withTime value={form.endsAt} onChange={set("endsAt")} />
            <span className="field-hint">Blank on both = live from publish until you withdraw it.</span>
          </div>
        </div>

        {form.audience === "plans" && (
          <Picker items={plans} keyField="code" labelField="name" stateKey="planCodes" />
        )}
        {form.audience === "clients" && (
          <Picker items={clients} keyField="subdomain" labelField="name" subField="subdomain" stateKey="subdomains" />
        )}

        <div className="add-form-actions">
          <button
            type="button"
            className="btn"
            onClick={() => (isEdit ? setForm(saved) : navigate("/admin/notifications"))}
            disabled={saving}
          >
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Announcement"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AnnouncementForm() {
  return (
    <MasterKeyGate>
      <AnnouncementFormInner />
    </MasterKeyGate>
  );
}
