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
import Toast from "../../components/ui/Toast";
import TableSearch from "../../components/data/TableSearch";
import useDebouncedValue from "../../hooks/useDebouncedValue";

function inr(n) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

function packingItemsSummary(items) {
  if (!items || items.length === 0) return "—";
  return items.map((i) => i.product).filter(Boolean).join(", ");
}

export default function PurchaseInvoices() {
  const { can } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const { data, page, setPage, total, totalPages, loading, reload } = usePaginatedData("/api/purchase/invoices", { pageSize: 8, params: debouncedSearch ? { search: debouncedSearch } : {} });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState("");

  // The standalone Add/Edit Purchase Invoice pages navigate back here with a
  // toast message in router state — surface it once, then clear the state so
  // a refresh doesn't replay it.
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
      await api.delete(`/api/purchase/invoices/${encodeURIComponent(row.id)}`);
      setToast("Purchase invoice deleted.");
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
      header: "Invoice No.",
      render: (r) => (
        <Link to={`/purchase/invoices/${encodeURIComponent(r.id)}/edit`} className="cell-link">
          {r.id}
        </Link>
      ),
    },
    { key: "date", header: "Invoice Date" },
    { key: "poNumber", header: "Purchase Order No" },
    { key: "grNumber", header: "GRN Number" },
    { key: "supplier", header: "Supplier", render: (r) => <span className="cell-primary">{r.supplier}</span> },
    {
      key: "packingItems",
      header: "Items",
      render: (r) => {
        const summary = packingItemsSummary(r.items);
        return <span className="cell-truncate" title={summary}>{summary}</span>;
      },
    },
    { key: "amount", header: "Invoice Amount", render: (r) => inr(r.amount) },
    { key: "paidAmount", header: "Paid", render: (r) => inr(r.paidAmount) },
    { key: "balance", header: "Balance", render: (r) => inr((r.amount || 0) - (r.paidAmount || 0)) },
    { key: "dueDate", header: "Due Date" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "__actions",
      header: "Actions",
      render: (r) => (
        <div className="row-actions">
          {can("purchase", "edit") && (
            <Link to={`/purchase/invoices/${encodeURIComponent(r.id)}/edit`} className="icon-btn" title="Edit">
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
        title="Purchase Invoice"
        crumbs={["Dashboard", "Purchase", "Purchase Invoice"]}
        actions={
          <>
            <ExportButtons
              endpoint="/api/purchase/invoices"
              columns={columns}
              title="Purchase Invoice"
              filenameBase="purchase-invoice"
            />
            {can("purchase", "create") && (
              <button className="btn btn-primary" onClick={() => navigate("/purchase/invoices/new")}>
                + Add Purchase Invoice
              </button>
            )}
          </>
        }
      />

      <div className="card">
        <TableSearch value={search} onChange={setSearch} placeholder="Search purchase invoices..." />
        <DataTable columns={columns} rows={data} loading={loading} emptyText={search ? "No records match your search." : undefined} />
        <Pagination page={page} pageSize={8} total={total} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete purchase invoice"
          message={`Delete ${deleteTarget.id}? This cannot be undone.`}
          confirming={deletingId === deleteTarget.id}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
