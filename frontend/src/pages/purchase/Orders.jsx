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
import DateRangeFilter from "../../components/forms/DateRangeFilter";
import usePaginatedData from "../../hooks/usePaginatedData";
import { STATUS_OPTIONS, PAYMENT_TERMS, inr } from "./PurchaseOrderForm";
import Toast from "../../components/ui/Toast";
import TableSearch from "../../components/data/TableSearch";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import Select from "../../components/forms/Select";

function packingItemsSummary(items) {
  if (!items || items.length === 0) return "—";
  return items.map((i) => i.product).filter(Boolean).join(", ");
}

function qtySummary(items) {
  if (!items || items.length === 0) return "—";
  const totalQty = items.reduce((a, i) => a + (Number(i.quantity) || 0), 0);
  const unit = items[0].unit || "Nos";
  return `${totalQty.toLocaleString("en-IN")} ${unit}`;
}

const DEFAULT_FILTERS = { supplier: "all", status: "all", paymentTerms: "all", datePreset: "", dateFrom: "", dateTo: "" };

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const location = useLocation();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const { data, page, setPage, total, totalPages, loading, reload } = usePaginatedData("/api/purchase-orders", { pageSize: 8, params: { ...appliedFilters, ...(debouncedSearch ? { search: debouncedSearch } : {}) } });

  const applyFilters = () => setAppliedFilters(filters);
  const filtersActive = JSON.stringify(appliedFilters) !== JSON.stringify(DEFAULT_FILTERS);
  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
  };

  const [suppliers, setSuppliers] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    api.swr("/api/suppliers?page=1&pageSize=200", (r) => setSuppliers(r.data || []));
  }, []);

  // The standalone Add/Edit Purchase Order pages navigate back here with a
  // toast message in router state — surface it once, then clear the state
  // so refreshing or navigating back doesn't show it again.
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
      await api.delete(`/api/purchase-orders/${encodeURIComponent(row.id)}`);
      setToast("Purchase order deleted.");
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
      header: "Purchase Order No.",
      render: (r) => <Link to={`/purchase/orders/${encodeURIComponent(r.id)}`} className="cell-link">{r.id}</Link>,
    },
    { key: "orderDate", header: "Purchase Order Date" },
    { key: "supplier", header: "Supplier", render: (r) => <span className="cell-primary">{r.supplier}</span> },
    {
      key: "packingItems",
      header: "Items",
      render: (r) => {
        const summary = packingItemsSummary(r.items);
        return <span className="cell-truncate" title={summary}>{summary}</span>;
      },
    },
    { key: "qty", header: "Qty", render: (r) => qtySummary(r.items) },
    { key: "amount", header: "Total Amount", render: (r) => inr(r.amount) },
    { key: "expectedDate", header: "Delivery" },
    { key: "paymentTerms", header: "Payment Terms", render: (r) => r.paymentTerms || "—" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "grnStatus", header: "GRN Status", render: (r) => <StatusBadge status={r.grnStatus || "Not Received"} /> },
    {
      key: "__actions",
      header: "Actions",
      render: (r) => (
        <div className="row-actions">
          <Link to={`/purchase/orders/${encodeURIComponent(r.id)}/print`} className="icon-btn" title="Print / Download"><Icon name="download" /></Link>
          {can("purchase", "edit") && <Link to={`/purchase/orders/${encodeURIComponent(r.id)}/edit`} className="icon-btn" title="Edit"><Icon name="edit" /></Link>}
          {can("purchase", "delete") && (<button
            type="button"
            className="icon-btn danger"
            title="Delete"
            onClick={() => setDeleteTarget(r)}
            disabled={deletingId === r.id}
          >
            <Icon name="trash" />
          </button>)}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        crumbs={["Dashboard", "Purchase", "Purchase Orders"]}
        actions={
          <>
            <button
              type="button"
              className={`btn filter-toggle-btn${filtersOpen ? " active" : ""}${filtersActive ? " has-filters" : ""}`}
              title={filtersOpen ? "Close filters" : "Open filters"}
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <Icon name="filter" size={15} />
            </button>
            <ExportButtons
              endpoint="/api/purchase-orders"
              columns={columns}
              title="Purchase Orders"
              filenameBase="purchase-orders"
              params={appliedFilters}
            />
            {can("purchase", "create") && <button className="btn btn-primary" onClick={() => navigate("/purchase/orders/new")}>+ Add Purchase Order</button>}
          </>
        }
      />

      {filtersOpen && (
        <div className="filter-bar">
          <div className="filter-field">
            <label>Supplier</label>
            <Select value={filters.supplier} onChange={(e) => setFilters((f) => ({ ...f, supplier: e.target.value }))}>
              <option value="all">All Suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </Select>
          </div>
          <div className="filter-field">
            <label>Status</label>
            <Select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="all">All Statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
          <div className="filter-field">
            <label>Payment Terms</label>
            <Select value={filters.paymentTerms} onChange={(e) => setFilters((f) => ({ ...f, paymentTerms: e.target.value }))}>
              <option value="all">All Terms</option>
              {PAYMENT_TERMS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </Select>
          </div>
          <DateRangeFilter
            value={{ preset: filters.datePreset, dateFrom: filters.dateFrom, dateTo: filters.dateTo }}
            onChange={(next) => setFilters((f) => ({ ...f, datePreset: next.preset, dateFrom: next.dateFrom, dateTo: next.dateTo }))}
          />
          <button className="filter-apply-btn" onClick={applyFilters}>Apply Filters</button>
          <button type="button" className="btn" onClick={clearFilters}>Clear</button>
        </div>
      )}

      <div className="card">
        <TableSearch value={search} onChange={setSearch} placeholder="Search purchase orders..." />
        <DataTable columns={columns} rows={data} loading={loading} emptyText={search ? "No records match your search." : undefined} />
        <Pagination page={page} pageSize={8} total={total} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete purchase order"
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
