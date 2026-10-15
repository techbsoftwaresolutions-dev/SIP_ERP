import { useCallback, useEffect, useState } from "react";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import Loader from "../../components/ui/Loader";
import StatusBadge from "../../components/ui/StatusBadge";
import MasterKeyGate, { masterKeyHeader, useRelockOnInvalidKey } from "./MasterKeyGate";
import Select from "../../components/forms/Select";

const fmt = (d) =>
  d
    ? new Date(d).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

const ACTION_BADGE = { create: "Approved", update: "Pending", delete: "Cancelled", other: "Draft" };
const ACTION_LABEL = { create: "created", update: "changed", delete: "deleted", other: "called" };

// Read-only by design — there is no edit or delete, because an audit trail you
// can change is not one.
function AuditLogInner() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ area: "", action: "", actor: "", limit: 100 });
  const [expanded, setExpanded] = useState(null);
  const relockOnInvalidKey = useRelockOnInvalidKey();

  const load = useCallback(
    (f) => {
      const q = new URLSearchParams();
      Object.entries(f).forEach(([k, v]) => {
        if (v) q.set(k, v);
      });
      api
        .get(`/api/admin/audit-log?${q.toString()}`, masterKeyHeader())
        .then(setData)
        .catch((err) => {
          if (relockOnInvalidKey(err)) return;
          setError(err.message || "Could not load the audit trail.");
        });
    },
    [relockOnInvalidKey]
  );

  useEffect(() => {
    load(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  if (!data) {
    return (
      <div>
        <PageHeader title="Audit Log" crumbs={["Admin", "Audit Log"]} />
        <div className="loading-row">{error ? error : <Loader />}</div>
      </div>
    );
  }

  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div>
      <PageHeader title="Audit Log" crumbs={["Admin", "Audit Log"]} />

      <div className="list-card">
        <div className="section-title">Changes made in this panel</div>
        <p className="field-hint" style={{ marginTop: 0 }}>
          What <strong>TechB</strong> did to the platform — a template moved between tiers, a client’s menus
          narrowed, a super admin added. These actions reach every client at once. Each client’s own activity log
          lives inside their app and is separate from this.
        </p>

        <div className="settings-form" style={{ marginBottom: 16 }}>
          <div className="field">
            <label>Area</label>
            <Select value={filters.area} onChange={set("area")}>
              <option value="">All areas</option>
              {data.areas.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </Select>
          </div>
          <div className="field">
            <label>Action</label>
            <Select value={filters.action} onChange={set("action")}>
              <option value="">All actions</option>
              {data.actions.map((a) => (
                <option key={a} value={a}>{ACTION_LABEL[a] || a}</option>
              ))}
            </Select>
          </div>
          <div className="field">
            <label>Who</label>
            <Select value={filters.actor} onChange={set("actor")}>
              <option value="">Anyone</option>
              {data.actors.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </Select>
          </div>
          <div className="field">
            <label>Show</label>
            <Select value={filters.limit} onChange={set("limit")}>
              {[50, 100, 250, 500].map((n) => (
                <option key={n} value={n}>Last {n}</option>
              ))}
            </Select>
          </div>
        </div>

        {data.entries.length === 0 ? (
          <div className="sub-price-card empty">
            Nothing recorded yet. Entries appear here as soon as anything in this panel is changed.
          </div>
        ) : (
          <>
            <p className="field-hint" style={{ marginTop: 0 }}>
              Showing {data.entries.length} of {data.total}. Click a row to see exactly what was sent.
            </p>
            <div className="tpl-list">
              {data.entries.map((e) => (
                <div key={e.id} className="tpl-row audit-row" onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                  <span className="tpl-row-main">
                    <span className="tpl-row-head">
                      {e.summary}
                      <StatusBadge status={ACTION_BADGE[e.action] || "Draft"} />
                    </span>
                    <em>
                      {fmt(e.at)}
                      {e.actorEmail ? ` · ${e.actorEmail}` : ""}
                      {e.ip ? ` · ${e.ip}` : ""}
                      {` · ${e.method} ${e.path}`}
                    </em>
                    {expanded === e.id && (
                      <pre className="audit-details">
                        {e.details ? JSON.stringify(e.details, null, 2) : "No request body."}
                      </pre>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function AuditLog() {
  return (
    <MasterKeyGate>
      <AuditLogInner />
    </MasterKeyGate>
  );
}
