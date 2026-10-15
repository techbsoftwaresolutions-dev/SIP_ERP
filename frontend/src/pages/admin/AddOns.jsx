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

function AddOnsInner() {
  const [addOns, setAddOns] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const relockOnInvalidKey = useRelockOnInvalidKey();

  const load = () => {
    api
      .get("/api/admin/add-ons", masterKeyHeader())
      .then((r) => setAddOns(r.addOns || []))
      .catch((err) => {
        if (relockOnInvalidKey(err)) return;
        setError(err.message || "Could not load add-ons.");
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
      await api.delete(`/api/admin/add-ons/${encodeURIComponent(deleteTarget.code)}`, masterKeyHeader());
      setDeleteTarget(null);
      setToast(`Deleted the "${deleteTarget.name}" add-on.`);
      setTimeout(() => setToast(""), 3000);
      load();
    } catch (err) {
      // The backend refuses while any client still holds this add-on.
      window.alert(err.message || "Could not delete this add-on.");
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: "name",
      header: "Add-on",
      render: (r) => (
        <Link to={`/admin/add-ons/${encodeURIComponent(r.code)}/edit`} className="cell-link">
          {r.name}
        </Link>
      ),
    },
    { key: "code", header: "Code" },
    { key: "price", header: "Price", render: (r) => inr(r.price) },
    { key: "billingCycle", header: "Billing", render: (r) => r.billingCycle || "Monthly" },
    {
      key: "modules",
      header: "Unlocks",
      // Unlike a plan, an empty list here grants nothing at all — so say so
      // rather than leaving a dash that reads like "not configured yet".
      render: (r) => ((r.modules || []).length ? `${r.modules.length} menus` : "No menus"),
    },
    {
      key: "maxUsersBonus",
      header: "Extra Seats",
      render: (r) => (Number(r.maxUsersBonus) > 0 ? `+${r.maxUsersBonus}` : "—"),
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
          <Link to={`/admin/add-ons/${encodeURIComponent(r.code)}/edit`} className="icon-btn" title="Edit add-on">
            <Icon name="edit" />
          </Link>
          <button
            type="button"
            className="icon-btn danger"
            title="Delete this add-on"
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
        title="Add-ons"
        crumbs={["Admin", "Add-ons"]}
        actions={
          <Link to="/admin/add-ons/new" className="btn btn-primary">
            + Add Add-on
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
            rows={addOns || []}
            loading={addOns === null}
            emptyText="No add-ons yet. An add-on sells extra menus on top of a plan — so a client on a small plan can buy one module without moving up a tier."
          />
        )}
      </div>
      {deleteTarget && (
        <ConfirmDialog
          title="Delete this add-on?"
          message={`Delete the "${deleteTarget.name}" add-on? Clients who already hold it keep their access until you remove it from their record, and this cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirming={deleting}
        />
      )}
    </div>
  );
}

export default function AddOns() {
  return (
    <MasterKeyGate>
      <AddOnsInner />
    </MasterKeyGate>
  );
}
