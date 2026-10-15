import { useCallback, useEffect, useState } from "react";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import DataTable from "../../components/data/DataTable";
import Select from "../../components/forms/Select";
import Toast from "../../components/ui/Toast";
import Icon from "../../components/ui/Icon";
import MasterKeyGate, { masterKeyHeader, useRelockOnInvalidKey } from "./MasterKeyGate";

const STATUSES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

const fmt = (d) =>
  d
    ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

// Leads from the public SIPERP website's Book a Demo and Contact forms.
function DemoRequestsInner() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [toast, setToast] = useState("");
  const relockOnInvalidKey = useRelockOnInvalidKey();

  const load = useCallback(() => {
    api
      .get(`/api/admin/demo-requests${filter ? `?status=${filter}` : ""}`, masterKeyHeader())
      .then(setData)
      .catch((err) => {
        if (relockOnInvalidKey(err)) return;
        setError(err.message || "Could not load demo requests.");
      });
  }, [filter, relockOnInvalidKey]);

  useEffect(load, [load]);

  const flash = (m) => {
    setToast(m);
    setTimeout(() => setToast(""), 2500);
  };

  const update = async (row, patch) => {
    try {
      await api.put(`/api/admin/demo-requests/${row.id}`, patch, masterKeyHeader());
      setData((d) => ({ ...d, requests: d.requests.map((r) => (r.id === row.id ? { ...r, ...patch } : r)) }));
      flash("Saved.");
      if (patch.status) load(); // keeps the status counts honest
    } catch (err) {
      if (relockOnInvalidKey(err)) return;
      window.alert(err.message || "Could not save that change.");
    }
  };

  const editNote = (row) => {
    const next = window.prompt(`Note for ${row.name}`, row.notes || "");
    if (next !== null && next !== row.notes) update(row, { notes: next });
  };

  const columns = [
    { key: "createdAt", header: "Received", render: (r) => fmt(r.createdAt) },
    {
      key: "name",
      header: "Name",
      render: (r) => (
        <span>
          <span className="cell-primary">{r.name}</span>
          {r.company ? <div className="field-hint" style={{ marginTop: 0 }}>{r.company}</div> : null}
        </span>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      render: (r) => (
        <span>
          {r.phone ? <div><a href={`tel:${r.phone}`} className="cell-link">{r.phone}</a></div> : null}
          {r.email ? <div><a href={`mailto:${r.email}`} className="cell-link">{r.email}</a></div> : null}
        </span>
      ),
    },
    {
      key: "industry",
      header: "Business",
      render: (r) => [r.industry, r.teamSize ? `${r.teamSize} users` : ""].filter(Boolean).join(" · ") || "—",
    },
    {
      key: "message",
      header: "Message",
      render: (r) =>
        r.message ? (
          <span className="cell-truncate" title={r.message}>
            {r.message}
          </span>
        ) : (
          "—"
        ),
    },
    { key: "kind", header: "From", render: (r) => (r.kind === "contact" ? "Contact form" : "Book a Demo") },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Select value={r.status} onChange={(e) => update(r, { status: e.target.value })}>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </Select>
      ),
    },
    {
      key: "__note",
      header: "Note",
      render: (r) => (
        <button type="button" className="icon-btn" title={r.notes ? `Note: ${r.notes}` : "Add a note"} onClick={() => editNote(r)}>
          <Icon name="edit" />
        </button>
      ),
    },
  ];

  const counts = (data && data.counts) || {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div>
      <PageHeader title="Demo Requests" crumbs={["Admin", "Demo Requests"]} />
      {toast && <Toast message={toast} />}

      <div className="list-card">
        <div className="settings-form" style={{ marginBottom: 12 }}>
          <div className="field">
            <label>Show</label>
            <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">{`All (${total})`}</option>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{`${s.label} (${counts[s.value] || 0})`}</option>
              ))}
            </Select>
          </div>
        </div>
        {error ? (
          <div className="loading-row">{error}</div>
        ) : (
          <DataTable
            columns={columns}
            rows={(data && data.requests) || []}
            loading={data === null}
            emptyText="No demo requests yet. They appear here when someone fills the form on the SIPERP website."
          />
        )}
      </div>
    </div>
  );
}

export default function DemoRequests() {
  return (
    <MasterKeyGate>
      <DemoRequestsInner />
    </MasterKeyGate>
  );
}
