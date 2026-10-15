import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import adminApi from "../../api/adminClient";
import PageHeader from "../../components/layout/PageHeader";
import DataTable from "../../components/data/DataTable";
import StatusBadge from "../../components/ui/StatusBadge";
import Icon from "../../components/ui/Icon";
import Loader from "../../components/ui/Loader";
import { useAdminAuth } from "../../context/AdminAuthContext";
import Toast from "../../components/ui/Toast";
import ConfirmDialog from "../../components/ui/ConfirmDialog";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never";

export default function SuperAdmins() {
  const { admin } = useAdminAuth();
  const isOwner = admin?.role === "owner";
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busyId, setBusyId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  const load = useCallback(() => {
    adminApi
      .get("/api/admin/super-admins")
      .then((r) => setRows(r.data || []))
      .catch((err) => setError(err.message || "Could not load super admins."));
  }, []);

  useEffect(() => {
    if (location.state && location.state.toast) {
      setToast(location.state.toast);
      setTimeout(() => setToast(""), 2500);
      navigate(location.pathname, { replace: true, state: {} });
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const flash = (m) => {
    setToast(m);
    setTimeout(() => setToast(""), 3000);
  };

  // Disabling cuts the account's access at once but keeps it, so it can be
  // switched back on. The server refuses disabling yourself or the last owner.
  const toggleStatus = async (row) => {
    const disabling = row.status === "active";
    setBusyId(row.id);
    try {
      await adminApi.put(`/api/admin/super-admins/${encodeURIComponent(row.id)}`, {
        status: disabling ? "disabled" : "active",
      });
      flash(disabling ? `${row.name} disabled.` : `${row.name} enabled.`);
      load();
    } catch (err) {
      flash(err.message || "Could not change that account.");
    } finally {
      setBusyId("");
    }
  };

  const handleDelete = async () => {
    const row = deleteTarget;
    if (!row) return;
    setBusyId(row.id);
    try {
      await adminApi.delete(`/api/admin/super-admins/${encodeURIComponent(row.id)}`);
      flash(`${row.name} deleted.`);
      load();
    } catch (err) {
      flash(err.message || "Could not delete that account.");
    } finally {
      setBusyId("");
      setDeleteTarget(null);
    }
  };

  const columns = [
    {
      key: "name",
      header: "Name",
      // Only an owner can change these, so only an owner gets a link — an
      // operator seeing one would just be walked into a refusal.
      render: (r) =>
        isOwner ? (
          <Link to={`/admin/super-admins/${encodeURIComponent(r.id)}/edit`} className="cell-link">
            {r.name}
          </Link>
        ) : (
          <span className="cell-primary">{r.name}</span>
        ),
    },
    { key: "email", header: "Email" },
    { key: "role", header: "Role", render: (r) => <StatusBadge status={r.role === "owner" ? "Owner" : "Operator"} /> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "lastLoginAt", header: "Last Login", render: (r) => fmtDate(r.lastLoginAt) },
    ...(isOwner
      ? [
          {
            key: "__actions",
            header: "Actions",
            render: (r) => {
              const isSelf = String(r.id) === String(admin?.id);
              const active = r.status === "active";
              const busy = busyId === r.id;
              return (
                <div className="row-actions">
                  <Link
                    to={`/admin/super-admins/${encodeURIComponent(r.id)}/edit`}
                    className="icon-btn"
                    title="Edit this account"
                  >
                    <Icon name="edit" />
                  </Link>
                  <button
                    type="button"
                    className={`icon-btn${active ? " danger" : ""}`}
                    title={isSelf ? "You cannot disable your own account" : active ? "Disable — blocks sign-in, can be undone" : "Enable — allow sign-in again"}
                    disabled={busy || isSelf}
                    onClick={() => toggleStatus(r)}
                  >
                    <Icon name={active ? "xCircle" : "checkCircle"} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    title={isSelf ? "You cannot delete your own account" : "Delete this account"}
                    disabled={busy || isSelf}
                    onClick={() => setDeleteTarget(r)}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              );
            },
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Super Admins"
        crumbs={["Admin", "Super Admins"]}
        actions={
          isOwner && (
            <Link to="/admin/super-admins/new" className="btn btn-primary">
              + Add Super Admin
            </Link>
          )
        }
      />
      {toast && <Toast message={toast} />}

      <div className="list-note">
        <span>
          These accounts can reach every client&apos;s data. Only an <strong>owner</strong> can add or change them;
          an operator can run the platform but not alter who has access. The first account, and any lost password, is
          handled with <code>npm run create-admin</code> on the server.
        </span>
      </div>

      <div className="card">
        {error ? (
          <div className="login-error" style={{ margin: 16 }}>{error}</div>
        ) : rows === null ? (
          <div className="loading-row" style={{ padding: 40, textAlign: "center" }}><Loader /></div>
        ) : (
          <DataTable columns={columns} rows={rows} emptyText="No super admins yet." />
        )}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this super admin?"
          message={`Remove ${deleteTarget.name} (${deleteTarget.email}) from the platform. They are signed out immediately and cannot sign in again. If you only want to pause their access, disable the account instead.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirming={busyId === deleteTarget.id}
        />
      )}
    </div>
  );
}
