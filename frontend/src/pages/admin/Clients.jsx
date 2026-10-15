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
import { clientAddress } from "../../utils/appDomain";

const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

const DAY_MS = 24 * 60 * 60 * 1000;

// Mirrors backend/subscription.js so the list can label each row without a
// per-client round trip. The backend remains the authority that actually
// blocks access; this is presentation only.
function subscriptionState(t) {
  if (t.status === "suspended") return { label: "Suspended", badge: "Suspended", days: null };
  if (!t.subscriptionEnd) return { label: "Active", badge: "Active", days: null };
  const end = new Date(t.subscriptionEnd);
  end.setHours(23, 59, 59, 999);
  const deadline = end.getTime() + (Number(t.graceDays) || 0) * DAY_MS;
  if (Date.now() > deadline) return { label: "Expired", badge: "Expired", days: 0 };
  const days = Math.max(0, Math.ceil((end.getTime() - Date.now()) / DAY_MS));
  if (days <= 7) return { label: "Expiring Soon", badge: "Expiring Soon", days };
  return { label: "Active", badge: "Active", days };
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function ClientsInner() {
  const [tenants, setTenants] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const relockOnInvalidKey = useRelockOnInvalidKey();

  const load = () => {
    api
      .get("/api/admin/tenants", masterKeyHeader())
      .then((r) => setTenants(r.tenants || []))
      .catch((err) => {
        // A rejected key means the stored one is wrong — re-prompt instead of
        // leaving the screen stuck on "Invalid master key." with no way out.
        if (relockOnInvalidKey(err)) return;
        setError(err.message || "Could not load clients.");
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

  const toggleStatus = async (t) => {
    const next = t.status === "active" ? "suspended" : "active";
    try {
      await api.put(`/api/admin/tenants/${encodeURIComponent(t.subdomain)}`, { status: next }, masterKeyHeader());
      load();
    } catch (err) {
      if (relockOnInvalidKey(err)) return;
      window.alert(err.message || "Could not change this client's status.");
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/api/admin/tenants/${encodeURIComponent(deleteTarget.subdomain)}`, masterKeyHeader());
      setDeleteTarget(null);
      setToast(`Removed "${deleteTarget.companyName}" from routing — their data in ${deleteTarget.databaseName} was not touched.`);
      setTimeout(() => setToast(""), 4000);
      load();
    } catch (err) {
      window.alert(err.message || "Could not remove this client.");
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: "companyName",
      header: "Company",
      render: (r) => (
        <Link to={`/admin/clients/${encodeURIComponent(r.subdomain)}/edit`} className="cell-link">
          {r.companyName}
        </Link>
      ),
    },
    { key: "subdomain", header: "Subdomain", render: (r) => clientAddress(r.subdomain) },
    { key: "databaseName", header: "Database" },
    { key: "planName", header: "Plan", render: (r) => r.planName || "—" },
    {
      key: "termMonths",
      header: "Term",
      render: (r) => (r.planName ? `${r.termMonths || 12} mo` : "—"),
    },
    {
      key: "discountPercent",
      header: "Discount",
      render: (r) => (Number(r.discountPercent) > 0 ? `${r.discountPercent}%` : "—"),
    },
    {
      key: "amountPayable",
      header: "Payable",
      render: (r) => (r.planName ? inr(r.amountPayable) : "—"),
    },
    {
      key: "modules",
      header: "Menus",
      // Blank list = no per-client limit, so this client just gets whatever
      // their plan includes. A count means someone narrowed it deliberately.
      render: (r) => ((r.modules || []).length ? `${r.modules.length} of plan` : "Plan default"),
    },
    { key: "subscriptionEnd", header: "Renewal", render: (r) => formatDate(r.subscriptionEnd) },
    {
      key: "__days",
      header: "Days Left",
      render: (r) => {
        const s = subscriptionState(r);
        return s.days === null ? "—" : s.days;
      },
    },
    {
      key: "status",
      header: "Status",
      render: (r) => {
        const s = subscriptionState(r);
        return <StatusBadge status={s.badge} />;
      },
    },
    {
      key: "__actions",
      header: "Actions",
      render: (r) => (
        <div className="row-actions">
          <button
            type="button"
            className="icon-btn"
            title={r.status === "active" ? "Suspend this client" : "Reactivate this client"}
            onClick={() => toggleStatus(r)}
          >
            <Icon name={r.status === "active" ? "eyeOff" : "eye"} />
          </button>
          <button
            type="button"
            className="icon-btn danger"
            title="Remove this client from routing"
            onClick={() => setDeleteTarget(r)}
          >
            <Icon name="trash" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Manage Clients"
        crumbs={["Admin", "Manage Clients"]}
        actions={
          <Link to="/admin/clients/new" className="btn btn-primary">
            + Add Client
          </Link>
        }
      />
      {toast && <Toast message={toast} />}
      <div className="list-card">
        {error ? (
          <div className="loading-row">{error}</div>
        ) : (
          <DataTable columns={columns} rows={tenants || []} loading={tenants === null} emptyText="No clients yet." />
        )}
      </div>
      {deleteTarget && (
        <ConfirmDialog
          title="Remove this client?"
          message={`This removes "${deleteTarget.companyName}" (${clientAddress(deleteTarget.subdomain)}) from routing — their subdomain will fall back to the default database until re-added. Their actual data in "${deleteTarget.databaseName}" is NOT deleted.`}
          confirmLabel="Remove"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirming={deleting}
        />
      )}
    </div>
  );
}

export default function Clients() {
  return (
    <MasterKeyGate>
      <ClientsInner />
    </MasterKeyGate>
  );
}
