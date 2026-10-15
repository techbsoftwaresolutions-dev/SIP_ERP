import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import DataTable from "../../components/data/DataTable";
import StatusBadge from "../../components/ui/StatusBadge";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Icon from "../../components/ui/Icon";
import MasterKeyGate, { masterKeyHeader, useRelockOnInvalidKey } from "./MasterKeyGate";
import Toast from "../../components/ui/Toast";

// Role TEMPLATES, not roles anyone signs in with. Each client keeps its own
// roles in its own database; a template is what those get created from, so a
// role is designed once here rather than 200 times by hand.
function GlobalRolesInner() {
  const [roles, setRoles] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  // The role being pushed out, and which clients are ticked for it.
  const [applyTarget, setApplyTarget] = useState(null);
  const [applyTo, setApplyTo] = useState([]);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const relockOnInvalidKey = useRelockOnInvalidKey();

  const load = () => {
    Promise.all([
      api.get("/api/admin/global-roles", masterKeyHeader()),
      api.get("/api/admin/tenants", masterKeyHeader()).catch(() => ({ tenants: [] })),
    ])
      .then(([r, t]) => {
        setRoles(r.roles || []);
        setTenants(t.tenants || []);
      })
      .catch((err) => {
        if (relockOnInvalidKey(err)) return;
        setError(err.message || "Could not load global roles.");
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
    setTimeout(() => setToast(""), 3500);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/api/admin/global-roles/${encodeURIComponent(deleteTarget.code)}`, masterKeyHeader());
      setDeleteTarget(null);
      flash(`Deleted the "${deleteTarget.name}" template.`);
      load();
    } catch (err) {
      window.alert(err.message || "Could not delete this template.");
    } finally {
      setDeleting(false);
    }
  };

  const openApply = (role) => {
    setApplyTarget(role);
    setApplyTo([]);
    setApplyResult(null);
  };

  const handleApply = async () => {
    if (applying || applyTo.length === 0) return;
    setApplying(true);
    try {
      const res = await api.post(
        `/api/admin/global-roles/${encodeURIComponent(applyTarget.code)}/apply`,
        { subdomains: applyTo },
        masterKeyHeader()
      );
      setApplyResult(res);
      const created = res.applied.filter((a) => a.action === "created").length;
      const updated = res.applied.filter((a) => a.action === "updated").length;
      flash(
        `"${res.role}" — created for ${created} client${created === 1 ? "" : "s"}, updated for ${updated}.` +
          (res.failed.length ? ` ${res.failed.length} failed.` : "")
      );
      // Leave the panel open when anything failed, so the reason is readable.
      if (!res.failed.length) setApplyTarget(null);
    } catch (err) {
      if (relockOnInvalidKey(err)) return;
      window.alert(err.message || "Could not apply this template.");
    } finally {
      setApplying(false);
    }
  };

  const columns = [
    {
      key: "name",
      header: "Role",
      render: (r) =>
        r.protected ? (
          <span>{r.name}</span>
        ) : (
          <Link to={`/admin/global-roles/${encodeURIComponent(r.code)}/edit`} className="cell-link">
            {r.name}
          </Link>
        ),
    },
    { key: "code", header: "Code" },
    {
      key: "description",
      header: "Description",
      render: (r) => <span className="cell-truncate" title={r.description}>{r.description || "—"}</span>,
    },
    {
      key: "permissions",
      header: "Permissions",
      // Administrator holds everything by name rather than by a stored list,
      // so a count would read as a smaller grant than it is.
      render: (r) => (r.protected ? "All" : `${(r.permissions || []).length}`),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={r.status === "archived" ? "Archived" : "Active"} />,
    },
    {
      key: "__actions",
      header: "Actions",
      render: (r) => (
        <div className="row-actions">
          <button
            type="button"
            className="icon-btn"
            title="Apply this template to clients"
            onClick={() => openApply(r)}
          >
            <Icon name="share" />
          </button>
          {!r.protected && (
            <>
              <Link
                to={`/admin/global-roles/${encodeURIComponent(r.code)}/edit`}
                className="icon-btn"
                title="Edit template"
              >
                <Icon name="edit" />
              </Link>
              <button
                type="button"
                className="icon-btn danger"
                title="Delete this template"
                onClick={() => setDeleteTarget(r)}
              >
                <Icon name="trash" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Global Roles"
        crumbs={["Admin", "Global Roles"]}
        actions={
          <Link to="/admin/global-roles/new" className="btn btn-primary">
            + Add Global Role
          </Link>
        }
      />
      {toast && <Toast message={toast} />}

      <div className="list-card">
        {error ? (
          <div className="loading-row">{error}</div>
        ) : (
          <DataTable
            columns={columns}
            rows={roles || []}
            loading={roles === null}
            emptyText="No global roles yet."
          />
        )}
      </div>

      {applyTarget && (
        <div className="list-card" style={{ marginTop: 16 }}>
          <div className="section-title">Apply “{applyTarget.name}” to clients</div>
          <p className="field-hint" style={{ marginTop: 0 }}>
            Creates this role in each client’s own database. A client who already has a role of this name has
            its permissions <strong>overwritten</strong> — including any changes they made themselves.
          </p>

          <div className="addon-picker">
            {tenants.map((t) => {
              const on = applyTo.includes(t.subdomain);
              return (
                <label key={t.subdomain} className={`addon-option${on ? " is-on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) =>
                      setApplyTo((prev) =>
                        e.target.checked ? [...prev, t.subdomain] : prev.filter((s) => s !== t.subdomain)
                      )
                    }
                  />
                  <span className="addon-option-body">
                    <span className="addon-option-head">{t.companyName || t.subdomain}</span>
                    <em>{t.subdomain}</em>
                  </span>
                </label>
              );
            })}
          </div>

          {applyResult && applyResult.failed.length > 0 && (
            <div className="login-error" style={{ marginBottom: 12 }}>
              {applyResult.failed.map((f) => (
                <div key={f.subdomain}>
                  {f.subdomain}: {f.message}
                </div>
              ))}
            </div>
          )}

          <div className="add-form-actions">
            <button
              type="button"
              className="btn"
              onClick={() => setApplyTo(applyTo.length ? [] : tenants.map((t) => t.subdomain))}
            >
              {applyTo.length ? "Clear all" : "Select all"}
            </button>
            <button type="button" className="btn" onClick={() => setApplyTarget(null)} disabled={applying}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleApply}
              disabled={applying || applyTo.length === 0}
            >
              {applying ? "Applying…" : `Apply to ${applyTo.length} client${applyTo.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this template?"
          message={`Delete the "${deleteTarget.name}" template? Roles already created in client databases from it are left exactly as they are — only the template goes.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirming={deleting}
        />
      )}
    </div>
  );
}

export default function GlobalRoles() {
  return (
    <MasterKeyGate>
      <GlobalRolesInner />
    </MasterKeyGate>
  );
}
