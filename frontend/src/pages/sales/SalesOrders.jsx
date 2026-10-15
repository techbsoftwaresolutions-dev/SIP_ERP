import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import { usePermissions } from "../../context/PermissionsContext";
import StatCard from "../../components/ui/StatCard";
import DataTable from "../../components/data/DataTable";
import Pagination from "../../components/data/Pagination";
import StatusBadge from "../../components/ui/StatusBadge";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import usePaginatedData from "../../hooks/usePaginatedData";
import Icon from "../../components/ui/Icon";
import { downloadCSV } from "../../utils/exportCsv";
import ExportButtons from "../../components/data/ExportButtons";
import DateRangeFilter, { DATE_RANGE_PRESETS, presetToRange } from "../../components/forms/DateRangeFilter";
import RowMenu from "../../components/data/RowMenu";
import useTableStyle from "../../hooks/useTableStyle";
import { prettyDate } from "../../utils/dateLabels";
import Toast from "../../components/ui/Toast";
import TableSearch from "../../components/data/TableSearch";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import Select from "../../components/forms/Select";

function formatINR(n) {
  return (n || 0).toLocaleString("en-IN");
}

const DEFAULT_FILTERS = { customer: "all", status: "all", datePreset: "", dateFrom: "", dateTo: "" };

export default function SalesOrders() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const location = useLocation();
  const [stats, setStats] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  // "classic" (the default) or "cards", chosen in Settings -> General -> Table Style.
  const tableStyle = useTableStyle();
  // The filter panel stays hidden until the filter icon is clicked.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    api.get("/api/sales/orders/stats").then(setStats);
    api.get("/api/customers?page=1&pageSize=200").then((r) => setCustomers(r.data));
    // Used to back-fill HSN/SAC and Tax % on line items when converting an
    // order to an invoice (the Sales Order itself doesn't store those).
    api.swr("/api/items?page=1&pageSize=500", (r) => setCatalogItems(r.data || []));
  }, []);

  // The standalone Add/Edit Sales Order pages navigate back here with a
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

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const { data: orders, page, setPage, total, totalPages, loading, reload } = usePaginatedData(
    "/api/sales/orders",
    { pageSize: 5, params: { ...appliedFilters, ...(debouncedSearch ? { search: debouncedSearch } : {}) } }
  );

  const applyFilters = () => {
    setAppliedFilters(filters);
  };
  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
  };
  const filtersActive = JSON.stringify(appliedFilters) !== JSON.stringify(DEFAULT_FILTERS);

  // The plain columns: used for the PDF / Word / Excel / CSV downloads.
  const exportColumns = [
    {
      key: "orderNo",
      header: "Sales Order No",
      render: (row) => <Link to={`/sales/orders/${encodeURIComponent(row.id)}`} className="cell-link">{row.orderNo}</Link>,
    },
    { key: "orderDate", header: "Order Date" },
    { key: "poNumber", header: "Purchase Order No", render: (row) => row.poNumber || "—" },
    { key: "poDate", header: "Purchase Order Date", render: (row) => row.poDate || "—" },
    {
      key: "customer",
      header: "Customer",
      render: (row) => (
        <div>
          <div className="cell-primary">{row.customer}</div>
          <div className="cell-sub">{row.city}</div>
        </div>
      ),
    },
    { key: "product", header: "Products", render: (row) => row.product || "—" },
    { key: "qty", header: "Order Qty", render: (row) => `${formatINR(row.qty)} ${row.unit || "Nos"}` },
    { key: "amount", header: "Order Value", render: (row) => `₹${formatINR(row.amount)}` },
    { key: "requiredDate", header: "Required Date", render: (row) => row.requiredDate || "—" },
    { key: "deliveryStatus", header: "Delivery Status", render: (row) => <StatusBadge status={row.deliveryStatus || "Not Dispatched"} /> },
    { key: "paymentStatus", header: "Payment Status", render: (row) => <StatusBadge status={row.paymentStatus || "Pending"} /> },
    { key: "status", header: "SO Status", render: (row) => <StatusBadge status={row.status} /> },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="row-actions">
          <button
            className={`icon-btn${row.invoiceId ? " converted" : ""}`}
            title={row.invoiceId ? `Already converted — ${row.invoiceId}` : "Convert to Invoice"}
            onClick={() => handleConvertToInvoice(row)}
          >
            <Icon name="file" />
          </button>
          {can("sales", "edit") && <Link to={`/sales/orders/${encodeURIComponent(row.id)}/edit`} className="icon-btn" title="Edit"><Icon name="edit" /></Link>}
          {can("sales", "delete") && (<button
            className="icon-btn danger"
            title="Delete"
            onClick={() => setDeleteTarget(row)}
            disabled={deletingId === row.id}
          >
            <Icon name="trash" />
          </button>)}
        </div>
      ),
    },
  ];

  // Picking a quick date range in the toolbar applies at once; "Custom Range"
  // opens the filter panel so the two dates can be chosen.
  const quickDate = (preset) => {
    if (preset === "Custom Range") {
      setFilters((f) => ({ ...f, datePreset: preset, dateFrom: "", dateTo: "" }));
      setFiltersOpen(true);
      return;
    }
    const { dateFrom, dateTo } = presetToRange(preset);
    const range = { datePreset: preset, dateFrom, dateTo };
    setFilters((f) => ({ ...f, ...range }));
    setAppliedFilters((a) => ({ ...a, ...range }));
  };
  const activeFilterCount =
    ["customer", "status"].filter((k) => appliedFilters[k] !== "all").length + (appliedFilters.datePreset ? 1 : 0);

  const productList = (row) => (Array.isArray(row.lineItems) ? row.lineItems.filter((li) => li && li.product) : []);
  const firstProduct = (row) =>
    (productList(row)[0] && productList(row)[0].product) || String(row.product || "").split(",")[0].trim() || "—";
  const productCount = (row) =>
    productList(row).length || (row.product ? String(row.product).split(",").filter((p) => p.trim()).length : 0);
  const STATUS_TONE = { Open: "ok", Pending: "warn", Delivered: "info", Cancelled: "bad" };
  const dateCell = (value) =>
    value ? (
      <span className="cell-icon">
        <Icon name="calendar" size={15} />
        {prettyDate(value)}
      </span>
    ) : (
      "—"
    );

  // What the table shows: each row is a card with pills, icons and a single Status.
  const tableColumns = [
    {
      key: "orderNo",
      header: "Sales Order No",
      render: (row) => (
        <Link to={`/sales/orders/${encodeURIComponent(row.id)}`} className="id-pill">
          {row.orderNo}
        </Link>
      ),
    },
    { key: "orderDate", header: "Order Date", render: (row) => dateCell(row.orderDate) },
    { key: "poNumber", header: "Purchase Order No", render: (row) => row.poNumber || "—" },
    { key: "poDate", header: "Purchase Order Date", render: (row) => dateCell(row.poDate) },
    {
      key: "customer",
      header: "Customer",
      render: (row) => (
        <span className="cell-primary">{row.customer}</span>
      ),
    },
    {
      key: "product",
      header: "Products",
      render: (row) => (
        <span className="cell-primary" title={productCount(row) > 1 ? String(row.product || "") : undefined}>
          {firstProduct(row)}
          {productCount(row) > 1 ? ` +${productCount(row) - 1} more` : ""}
        </span>
      ),
    },
    { key: "qty", header: "Order Qty", render: (row) => `${formatINR(row.qty)} ${row.unit || "Nos"}` },
    { key: "amount", header: "Order Value", render: (row) => `₹${formatINR(row.amount)}` },
    { key: "requiredDate", header: "Required Date", render: (row) => dateCell(row.requiredDate) },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <span
          className={`status-pill ${STATUS_TONE[row.status] || ""}`}
          title={`Delivery: ${row.deliveryStatus || "Not Dispatched"} · Payment: ${row.paymentStatus || "Pending"}`}
        >
          {row.status}
        </span>
      ),
    },
    {
      key: "__actions",
      header: "Actions",
      sortable: false,
      render: (row) => (
        <div className="row-end">
          <RowMenu
            items={[
              {
                label: row.invoiceId ? `Already converted (${row.invoiceId})` : "Convert to Invoice",
                icon: "file",
                onClick: () => handleConvertToInvoice(row),
              },
              { label: "Edit", icon: "edit", to: `/sales/orders/${encodeURIComponent(row.id)}/edit`, hidden: !can("sales", "edit") },
              {
                label: "Delete",
                icon: "trash",
                danger: true,
                onClick: () => setDeleteTarget(row),
                disabled: deletingId === row.id,
                hidden: !can("sales", "delete"),
              },
            ]}
          />
          <Link to={`/sales/orders/${encodeURIComponent(row.id)}`} className="row-chevron" aria-label="View order" title="View order">
            <Icon name="chevronRight" size={18} />
          </Link>
        </div>
      ),
    },
  ];

  const refreshStats = async () => {
    const s = await api.get("/api/sales/orders/stats");
    setStats(s);
  };

  const handleExport = async () => {
    const query = new URLSearchParams({ page: "1", pageSize: "5000", ...appliedFilters });
    const result = await api.get(`/api/sales/orders?${query.toString()}`);
    downloadCSV(exportColumns, result.data || [], `sales-orders-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // Opens the Add Invoice screen pre-filled from this Sales Order (customer,
  // address/phone from the Customer List, PO details, line items). Nothing is
  // saved yet — the user reviews / edits there and hits "Add Invoice" to
  // actually create it; on save that screen links the new invoice back to
  // this order (invoiceId), so this button then shows "Already converted".
  const handleConvertToInvoice = (row) => {
    if (row.invoiceId) {
      setToast(`Already converted — Invoice ${row.invoiceId} already exists.`);
      setTimeout(() => setToast(""), 3000);
      return;
    }
    const matchedCustomer = customers.find((c) => c.name === row.customer);
    // Fill HSN/SAC and Tax % (and fall back Unit / Unit Price) from the Items
    // catalog — the Sales Order line only carries product/qty/unit/price.
    const fromCatalog = (product) => catalogItems.find((c) => c.name === product) || {};
    const lineItems = Array.isArray(row.lineItems) ? row.lineItems : [];
    const items = lineItems.length
      ? lineItems.map((li) => {
          const cat = fromCatalog(li.product);
          return {
            product: li.product || "",
            hsnCode: cat.hsnCode || "",
            quantity: Number(li.orderQty) || 0,
            unit: li.unit || cat.unit || "Nos",
            unitPrice: Number(li.unitPrice) || Number(cat.sellingPrice) || 0,
            taxPercent: Number(cat.taxPercent) || 0,
          };
        })
      : [
          (() => {
            const cat = fromCatalog(row.product);
            return {
              product: row.product || "",
              hsnCode: cat.hsnCode || "",
              quantity: Number(row.qty) || 0,
              unit: row.unit || cat.unit || "Nos",
              unitPrice: Number(row.qty) ? (Number(row.amount) || 0) / Number(row.qty) : Number(cat.sellingPrice) || 0,
              taxPercent: Number(cat.taxPercent) || 0,
            };
          })(),
        ];
    navigate("/sales/invoices/new", {
      state: {
        fromSalesOrder: {
          id: row.id,
          orderNo: row.orderNo,
          customer: row.customer,
          address: matchedCustomer?.address || "",
          phone: matchedCustomer?.phone || "",
          poNumber: row.poNumber || "",
          poDate: row.poDate || "",
          items,
        },
      },
    });
  };

  const handleDelete = async () => {
    const row = deleteTarget;
    if (!row) return;
    setDeletingId(row.id);
    try {
      await api.delete(`/api/sales/orders/${encodeURIComponent(row.id)}`);
      setToast("Sales order deleted.");
      setTimeout(() => setToast(""), 2500);
      reload();
      refreshStats();
    } catch (err) {
      setToast(err.message || "Failed to delete.");
      setTimeout(() => setToast(""), 3000);
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Sales Orders"
        subtitle="Manage and track your sales orders efficiently"
        icon="cart"
        crumbs={["Dashboard", "Sales", "Sales Orders"]}
        actions={
          <>
            {can("sales", "create") && <button className="btn btn-primary" onClick={() => navigate("/sales/orders/new")}>+ New Sales Order</button>}
            <button
              type="button"
              className={`btn filter-toggle-btn${filtersOpen ? " active" : ""}${filtersActive ? " has-filters" : ""}`}
              title={filtersOpen ? "Close filters" : "Open filters"}
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <Icon name="filter" size={16} />
            </button>
            <ExportButtons
              endpoint="/api/sales/orders"
              columns={exportColumns}
              title="Sales Orders"
              filenameBase="sales-orders"
              params={appliedFilters}
            />
          </>
        }
      />

      <div className="stat-grid">
        <StatCard icon="cart" tone="blue" label="Open Sales Orders" value={stats ? stats.openSalesOrders : "—"} note="Active orders" />
        <StatCard
          icon="banknote"
          tone="green"
          label="Total Value (Open)"
          value={stats ? `₹${formatINR(stats.totalOpenValue)}` : "—"}
          note={stats ? `${stats.openSalesOrders} open ${stats.openSalesOrders === 1 ? "order" : "orders"}` : ""}
        />
        <StatCard
          icon="calendar"
          tone="purple"
          label="Delivered This Month"
          value={stats ? stats.deliveredThisMonth : "—"}
          note={stats ? (stats.deliveredThisMonth ? "Delivered orders" : "No deliveries yet") : ""}
        />
        <StatCard
          icon="alertCircle"
          tone="amber"
          label="Pending Approval"
          value={stats ? stats.pendingApproval : "—"}
          note={stats ? (stats.pendingApproval ? "Needs approval" : "All good") : ""}
        />
      </div>

      {filtersOpen && (
      <div className="filter-bar">
        <div className="filter-field">
          <label>Customer</label>
          <Select value={filters.customer} onChange={(e) => setFilters((f) => ({ ...f, customer: e.target.value }))}>
            <option value="all">All Customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </Select>
        </div>
        <div className="filter-field">
          <label>Status</label>
          <Select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            <option value="all">All Statuses</option>
            <option value="Open">Open</option>
            <option value="Pending">Pending</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
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
        <TableSearch value={search} onChange={setSearch} placeholder="Search sales orders...">
          <button type="button" className={`toolbar-btn${filtersOpen ? " active" : ""}`} onClick={() => setFiltersOpen((v) => !v)}>
            <Icon name="filter" size={16} /> Filter
            {activeFilterCount > 0 && <span className="toolbar-count">{activeFilterCount}</span>}
          </button>
          <div className="toolbar-date">
            <Icon name="calendar" size={16} />
            <Select value={filters.datePreset} onChange={(e) => quickDate(e.target.value)}>
              <option value="">All Dates</option>
              {DATE_RANGE_PRESETS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </Select>
          </div>
        </TableSearch>
        <DataTable variant={tableStyle === "cards" ? "cards" : undefined} columns={tableStyle === "cards" ? tableColumns : exportColumns} rows={orders} loading={loading} emptyText={search ? "No records match your search." : undefined} />
        <Pagination page={page} pageSize={5} total={total} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete sales order"
          message={`Delete ${deleteTarget.orderNo || deleteTarget.id}? This cannot be undone.`}
          confirming={deletingId === deleteTarget.id}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
