import { useCallback, useEffect, useState } from "react";
import adminApi from "../../api/adminClient";
import PageHeader from "../../components/layout/PageHeader";
import DataTable from "../../components/data/DataTable";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Loader from "../../components/ui/Loader";
import Icon from "../../components/ui/Icon";
import { useAdminAuth } from "../../context/AdminAuthContext";

const fmt = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

// Signed-in control-plane devices. Revoking one takes effect on that device's
// very next request, because sessions are checked server-side rather than
// trusted from the token alone.
export default function AdminSessions() {
  const { admin } = useAdminAuth();
  const isOwner = admin?.role === "owner";
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [revoking, setRevoking] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminApi
      .get("/api/admin/sessions")
      .then((r) => setRows(r.data || []))
      .catch((err) => setError(err.message || "Could not load sessions."));
  }, []);

  useEffect(load, [load]);

  const columns = [
    { key: "admin", header: "Admin", render: (r) => <span className="cell-primary">{r.admin}</span> },
    { key: "ip", header: "IP", render: (r) => r.ip || "—" },
    {
      key: "userAgent",
      header: "Device",
      render: (r) => (
        <span className="cell-truncate" title={r.userAgent}>
          {r.userAgent || "—"}
        </span>
      ),
    },
    { key: "lastSeenAt", header: "Last Seen", render: (r) => fmt(r.lastSeenAt) },
    { key: "expiresAt", header: "Expires", render: (r) => fmt(r.expiresAt) },
    {
      key: "__revoke",
      header: "",
      render: (r) =>
        isOwner ? (
          <button type="button" className="icon-btn danger" title="Revoke this session" onClick={() => setRevoking(r)}>
            <Icon name="trash" />
          </button>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader title="Admin Sessions" crumbs={["Admin", "Sessions"]} />

      <div className="list-note">
        <span>
          Every signed-in control-plane device. Sessions last 8 hours and are stored server-side, so revoking one cuts
          that device off immediately rather than waiting for its token to lapse.
        </span>
      </div>

      <div className="card">
        {error ? (
          <div className="login-error" style={{ margin: 16 }}>{error}</div>
        ) : rows === null ? (
          <div className="loading-row" style={{ padding: 40, textAlign: "center" }}><Loader /></div>
        ) : (
          <DataTable columns={columns} rows={rows} emptyText="No active sessions." />
        )}
      </div>

      {revoking && (
        <ConfirmDialog
          title="Revoke session"
          message={`Sign out ${revoking.admin} on ${revoking.ip || "that device"}? They will need to sign in again.`}
          confirming={busy}
          onCancel={() => setRevoking(null)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await adminApi.delete(`/api/admin/sessions/${encodeURIComponent(revoking.id)}`);
            } finally {
              setBusy(false);
              setRevoking(null);
              load();
            }
          }}
        />
      )}
    </div>
  );
}
