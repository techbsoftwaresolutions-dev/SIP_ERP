import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import Loader from "../../components/ui/Loader";
import Icon from "../../components/ui/Icon";
import StatusBadge from "../../components/ui/StatusBadge";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import MasterKeyGate, { masterKeyHeader, useRelockOnInvalidKey } from "./MasterKeyGate";
import Toast from "../../components/ui/Toast";

const fmt = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";

// Two things live here: what the bell raises on its own, and what we send to
// clients ourselves. Both land in the same bell, so they belong on one screen.
function NotificationsInner() {
  const [types, setTypes] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const relockOnInvalidKey = useRelockOnInvalidKey();

  const load = () => {
    Promise.all([
      api.get("/api/admin/notification-types", masterKeyHeader()),
      api.get("/api/admin/announcements", masterKeyHeader()).catch(() => ({ announcements: [] })),
    ])
      .then(([t, a]) => {
        setTypes(t.types || []);
        setAnnouncements(a.announcements || []);
      })
      .catch((err) => {
        if (relockOnInvalidKey(err)) return;
        setError(err.message || "Could not load notifications.");
      });
  };

  useEffect(() => {
    if (location.state && location.state.toast) {
      setToast(location.state.toast);
      setTimeout(() => setToast(""), 2500);
      navigate(location.pathname, { replace: true, state: {} });
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flash = (m) => {
    setToast(m);
    setTimeout(() => setToast(""), 3000);
  };

  if (!types) {
    return (
      <div>
        <PageHeader title="Notifications" crumbs={["Admin", "Notifications"]} />
        <div className="loading-row">{error ? error : <Loader />}</div>
      </div>
    );
  }

  const send = async (fn, message) => {
    try {
      await fn();
      load();
      if (message) flash(message);
      return true;
    } catch (err) {
      if (relockOnInvalidKey(err)) return false;
      window.alert(err.message || "Could not save that change.");
      return false;
    }
  };

  const toggleType = async (t) => {
    setBusy(t.key);
    await send(
      () =>
        api.put(
          `/api/admin/notification-types/${encodeURIComponent(t.key)}`,
          { enabled: !t.enabled },
          masterKeyHeader()
        ),
      t.enabled ? `${t.label} switched off for every client.` : `${t.label} is back on.`
    );
    setBusy("");
  };

  const setLead = async (t, value) => {
    setBusy(t.key);
    await send(
      () =>
        api.put(
          `/api/admin/notification-types/${encodeURIComponent(t.key)}`,
          { leadDays: value === "" ? null : Number(value) },
          masterKeyHeader()
        ),
      value === "" ? `${t.label} follows each client's own setting again.` : `${t.label} now warns ${value} days ahead.`
    );
    setBusy("");
  };

  const togglePublish = async (a) => {
    setBusy(a.code);
    await send(
      () =>
        api.put(
          `/api/admin/announcements/${encodeURIComponent(a.code)}`,
          { status: a.status === "published" ? "draft" : "published" },
          masterKeyHeader()
        ),
      a.status === "published" ? `"${a.title}" withdrawn.` : `"${a.title}" is live.`
    );
    setBusy("");
  };

  const handleDelete = async () => {
    setBusy(deleteTarget.code);
    const ok = await send(
      () => api.delete(`/api/admin/announcements/${encodeURIComponent(deleteTarget.code)}`, masterKeyHeader()),
      `Deleted "${deleteTarget.title}".`
    );
    setBusy("");
    if (ok) setDeleteTarget(null);
  };

  const audienceOf = (a) => {
    if (a.audience === "plans") return `${(a.planCodes || []).length} plan(s)`;
    if (a.audience === "clients") return `${(a.subdomains || []).length} client(s)`;
    return "Every client";
  };

  const windowOf = (a) => {
    if (!a.startsAt && !a.endsAt) return "";
    if (a.startsAt && a.endsAt) return `${fmt(a.startsAt)} – ${fmt(a.endsAt)}`;
    return a.startsAt ? `from ${fmt(a.startsAt)}` : `until ${fmt(a.endsAt)}`;
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        crumbs={["Admin", "Notifications"]}
        actions={
          <Link to="/admin/announcements/new" className="btn btn-primary">
            + New Announcement
          </Link>
        }
      />
      {toast && <Toast message={toast} />}

      <div className="list-card">
        <div className="section-title">What the bell raises</div>
        <div className="tpl-list">
          {types.map((t) => {
            const b = busy === t.key;
            return (
              <div key={t.key} className={`tpl-row${t.enabled ? "" : " is-off"}`}>
                <span className="tpl-row-main">
                  <span className="tpl-row-head">
                    {t.label}
                    <code>{t.key}</code>
                    {!t.enabled && <StatusBadge status="Disabled" />}
                  </span>
                  <em>{t.description}</em>
                </span>

                {t.supportsLeadDays ? (
                  <span className="notif-lead">
                    <input
                      type="number"
                      min="0"
                      max="365"
                      value={t.leadDays === null ? "" : t.leadDays}
                      placeholder="client"
                      disabled={b || !t.enabled}
                      onChange={(e) => setLead(t, e.target.value)}
                    />
                    <em>days ahead</em>
                  </span>
                ) : (
                  <span className="notif-lead"><em>no lead time</em></span>
                )}

                <span className="tpl-row-actions">
                  <button
                    type="button"
                    className={`icon-btn${t.enabled ? " danger" : ""}`}
                    title={t.enabled ? "Switch off for every client" : "Switch back on"}
                    disabled={b}
                    onClick={() => toggleType(t)}
                  >
                    <Icon name={t.enabled ? "close" : "check"} />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="list-card" style={{ marginTop: 16 }}>
        <div className="section-title">Announcements</div>
        <p className="field-hint" style={{ marginTop: 0 }}>
          Written once and scoped to an audience — a maintenance window, a new feature, a billing notice. A draft
          reaches nobody, so one can be prepared in advance and published when it matters.
        </p>

        {announcements.length === 0 ? (
          <div className="sub-price-card empty">
            No announcements yet. Nothing is being sent to any client.
          </div>
        ) : (
          <div className="tpl-list">
            {announcements.map((a) => {
              const b = busy === a.code;
              const live = a.status === "published";
              return (
                <div key={a.code} className={`tpl-row${live ? "" : " is-off"}`}>
                  <span className="tpl-row-main">
                    <span className="tpl-row-head">
                      <Link to={`/admin/announcements/${encodeURIComponent(a.code)}/edit`} className="cell-link">
                        {a.title}
                      </Link>
                      <span className="tpl-row-paper">{audienceOf(a)}</span>
                      <StatusBadge
                        status={a.severity === "critical" ? "Failed" : a.severity === "warning" ? "Warning" : "Draft"}
                      />
                      {live ? <StatusBadge status="Active" /> : <StatusBadge status="Draft" />}
                    </span>
                    <em>
                      {a.body || "—"}
                      {windowOf(a) ? ` · ${windowOf(a)}` : ""}
                    </em>
                  </span>
                  <span className="tpl-row-actions">
                    <button
                      type="button"
                      className={`icon-btn${live ? " danger" : ""}`}
                      title={live ? "Withdraw from clients" : "Publish to clients"}
                      disabled={b}
                      onClick={() => togglePublish(a)}
                    >
                      <Icon name={live ? "eyeOff" : "eye"} />
                    </button>
                    <Link
                      to={`/admin/announcements/${encodeURIComponent(a.code)}/edit`}
                      className="icon-btn"
                      title="Edit announcement"
                    >
                      <Icon name="edit" />
                    </Link>
                    <button
                      type="button"
                      className="icon-btn danger"
                      title="Delete announcement"
                      disabled={b}
                      onClick={() => setDeleteTarget(a)}
                    >
                      <Icon name="trash" />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this announcement?"
          message={`Delete "${deleteTarget.title}"? It disappears from every client's bell immediately. This cannot be undone — withdraw it instead if you may want it back.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirming={busy === deleteTarget.code}
        />
      )}
    </div>
  );
}

export default function Notifications() {
  return (
    <MasterKeyGate>
      <NotificationsInner />
    </MasterKeyGate>
  );
}
