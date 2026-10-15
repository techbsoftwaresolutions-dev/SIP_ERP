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

function inr(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

function PlansInner() {
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const relockOnInvalidKey = useRelockOnInvalidKey();

  const load = () => {
    api
      .get("/api/admin/plans", masterKeyHeader())
      .then((r) => setPlans(r.plans || []))
      .catch((err) => {
        if (relockOnInvalidKey(err)) return;
        setError(err.message || "Could not load plans.");
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

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/api/admin/plans/${encodeURIComponent(deleteTarget.code)}`, masterKeyHeader());
      setDeleteTarget(null);
      setToast(`Deleted the "${deleteTarget.name}" plan.`);
      setTimeout(() => setToast(""), 3000);
      load();
    } catch (err) {
      // The backend refuses while any client is still assigned to the plan.
      window.alert(err.message || "Could not delete this plan.");
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: "name",
      header: "Plan",
      render: (r) => (
        <Link to={`/admin/plans/${encodeURIComponent(r.code)}/edit`} className="cell-link">
          {r.name}
        </Link>
      ),
    },
    { key: "code", header: "Code" },
    { key: "price", header: "Monthly Price", render: (r) => inr(r.price) },
    {
      key: "modules",
      header: "Menu Access",
      render: (r) => ((r.modules || []).length ? `${r.modules.length} pages` : "All menus"),
    },
    {
      key: "maxUsers",
      header: "Max Users",
      render: (r) => (Number(r.maxUsers) > 0 ? r.maxUsers : "Unlimited"),
    },
    {
      key: "features",
      header: "Features",
      render: (r) => {
        const list = (r.features || []).join(", ");
        return <span className="cell-truncate" title={list}>{list || "—"}</span>;
      },
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={r.status === "active" ? "Active" : "Archived"} />,
    },
    {
      key: "__actions",
      header: "Actions",
      render: (r) => (
        <div className="row-actions">
          <Link to={`/admin/plans/${encodeURIComponent(r.code)}/edit`} className="icon-btn" title="Edit plan">
            <Icon name="edit" />
          </Link>
          <button
            type="button"
            className="icon-btn danger"
            title="Delete this plan"
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
        title="Manage Plans"
        crumbs={["Admin", "Manage Plans"]}
        actions={
          <Link to="/admin/plans/new" className="btn btn-primary">
            + Add Plan
          </Link>
        }
      />
      {toast && <Toast message={toast} />}
      <div className="list-card">
        {error ? (
          <div className="loading-row">{error}</div>
        ) : (
          <DataTable columns={columns} rows={plans || []} loading={plans === null} emptyText="No plans yet." />
        )}
      </div>
      {deleteTarget && (
        <ConfirmDialog
          title="Delete this plan?"
          message={`Delete the "${deleteTarget.name}" plan? Clients already assigned to it keep the price and plan name recorded on their own subscription, but you won't be able to assign it again.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirming={deleting}
        />
      )}
    </div>
  );
}

export default function Plans() {
  return (
    <MasterKeyGate>
      <PlansInner />
    </MasterKeyGate>
  );
}
