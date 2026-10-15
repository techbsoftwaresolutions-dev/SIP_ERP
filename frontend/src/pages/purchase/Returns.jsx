import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import { usePermissions } from "../../context/PermissionsContext";
import DataTable from "../../components/data/DataTable";
import Pagination from "../../components/data/Pagination";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import StatusBadge from "../../components/ui/StatusBadge";
import Icon from "../../components/ui/Icon";
import ExportButtons from "../../components/data/ExportButtons";
import usePaginatedData from "../../hooks/usePaginatedData";
import { inr } from "./PurchaseReturnForm";
import Toast from "../../components/ui/Toast";
import TableSearch from "../../components/data/TableSearch";
import useDebouncedValue from "../../hooks/useDebouncedValue";

function packingItemsSummary(items) {
  if (!items || items.length === 0) return "—";
  return items.map((i) => i.product).filter(Boolean).join(", ");
}

function qtySummary(items, key) {
  if (!items || items.length === 0) return "—";
  const total = items.reduce((a, i) => a + (Number(i[key]) || 0), 0);
  const unit = items[0].unit || "Nos";
  return `${total.toLocaleString("en-IN")}${unit && unit !== "Pcs" ? ` ${unit}` : ""}`;
}

export default function PurchaseReturns() {
  const navigate = useNavigate();
  const location = useLocation();
  const { can } = usePermissions();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const { data, page, setPage, total, totalPages, loading, reload } = usePaginatedData("/api/purchase/returns", { pageSize: 8, params: debouncedSearch ? { search: debouncedSearch } : {} });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState("");

  // The standalone Add/Edit Purchase Return pages navigate back here with a
  // toast message in router state — surface it once, then clear the state so
  // refreshing or navigating back doesn't show it again (same pattern as
  // Purchase Orders' own list page).
  useEffect(() => {
    if (location.state && location.state.toast) {
      setToast(location.state.toast);
      setTimeout(() => setToast(""), 2500);
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const handleDelete = async () => {
    const row = deleteTarget;
    if (!row) return;
    setDeletingId(row.id);
    try {
      await api.delete(`/api/purchase/returns/${encodeURIComponent(row.id)}`);
      setToast("Purchase return deleted — stock restored.");
      setTimeout(() => setToast(""), 2500);
      reload();
    } catch (err) {
      setToast(err.message || "Failed to delete.");
      setTimeout(() => setToast(""), 3000);
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  };

  const columns = [
    {
      key: "id",
      header: "Return No.",
      render: (r) => (
        <Link to={`/purchase/returns/${encodeURIComponent(r.id)}/edit`} className="cell-link">
          {r.id}
        </Link>
      ),
    },
    { key: "date", header: "Return Date" },
    { key: "poNumber", header: "Purchase Order No" },
    { key: "grNumber", header: "GRN No." },
    { key: "supplier", header: "Supplier", render: (r) => <span className="cell-primary">{r.supplier}</span> },
    {
      key: "packingItems",
      header: "Items",
      render: (r) => {
        const summary = packingItemsSummary(r.items);
        return <span className="cell-truncate" title={summary}>{summary}</span>;
      },
    },
    { key: "returnQty", header: "Return Qty", render: (r) => qtySummary(r.items, "returnQty") },
    { key: "amount", header: "Return Value", render: (r) => inr(r.amount) },
    { key: "reason", header: "Reason" },
    { key: "creditNote", header: "Credit Note", render: (r) => r.creditNote || "Pending" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "__actions",
      header: "Actions",
      render: (r) => (
        <div className="row-actions">
          {can("purchase", "edit") && (
            <Link to={`/purchase/returns/${encodeURIComponent(r.id)}/edit`} className="icon-btn" title="Edit">
              <Icon name="edit" />
            </Link>
          )}
          {can("purchase", "delete") && (
            <button
              type="button"
              className="icon-btn danger"
              title="Delete"
              onClick={() => setDeleteTarget(r)}
              disabled={deletingId === r.id}
            >
              <Icon name="trash" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Purchase Return"
        crumbs={["Dashboard", "Purchase", "Purchase Return"]}
        actions={
          <>
            <ExportButtons
              endpoint="/api/purchase/returns"
              columns={columns}
              title="Purchase Return"
              filenameBase="purchase-return"
            />
            {can("purchase", "create") && (
              <button className="btn btn-primary" onClick={() => navigate("/purchase/returns/new")}>
                + Add Purchase Return
              </button>
            )}
          </>
        }
      />

      <div className="card">
        <TableSearch value={search} onChange={setSearch} placeholder="Search purchase returns..." />
        <DataTable columns={columns} rows={data} loading={loading} emptyText={search ? "No records match your search." : undefined} />
        <Pagination page={page} pageSize={8} total={total} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete purchase return"
          message={`Delete ${deleteTarget.id}? This restores the returned quantity to stock and cannot be undone.`}
          confirming={deletingId === deleteTarget.id}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
