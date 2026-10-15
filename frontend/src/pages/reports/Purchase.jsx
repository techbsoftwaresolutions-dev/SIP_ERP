import { useEffect, useState } from "react";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import DataTable from "../../components/data/DataTable";
import StatusBadge from "../../components/ui/StatusBadge";
import ExportButtons from "../../components/data/ExportButtons";
import ShareButtons from "../../components/share/ShareButtons";
import Select from "../../components/forms/Select";

const DATE_RANGE_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "this_year", label: "This Year" },
  { value: "last_30_days", label: "Last 30 Days" },
];

const DEFAULT_FILTERS = {
  dateRange: "all",
  supplier: "all",
  product: "all",
  category: "all",
  brand: "all",
  warehouse: "all",
};

const TABS = [
  { key: "supplier", label: "By Supplier" },
  { key: "month", label: "By Month" },
  { key: "product", label: "By Item" },
  { key: "category", label: "By Category" },
  { key: "brand", label: "By Brand" },
  { key: "po", label: "Purchase Orders" },
  { key: "gr", label: "Goods Receipt" },
  { key: "invoice", label: "Invoices" },
  { key: "return", label: "Returns" },
  { key: "payables", label: "Payables" },
];

function resolveDateRange(rangeKey) {
  if (rangeKey === "all") return {};
  const now = new Date();
  const start = new Date(now);
  switch (rangeKey) {
    case "today":
      break;
    case "this_week":
      start.setDate(now.getDate() - now.getDay());
      break;
    case "this_month":
      start.setDate(1);
      break;
    case "this_quarter": {
      const q = Math.floor(now.getMonth() / 3);
      start.setMonth(q * 3, 1);
      break;
    }
    case "this_year":
      start.setMonth(0, 1);
      break;
    case "last_30_days":
      start.setDate(now.getDate() - 30);
      break;
    default:
      break;
  }
  start.setHours(0, 0, 0, 0);
  return { dateFrom: start.toISOString(), dateTo: now.toISOString() };
}

function inr(n) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

function qtyFmt(n) {
  return (n || 0).toLocaleString("en-IN");
}

const COLUMN_SETS = {
  supplier: [
    { key: "supplier", header: "Supplier" },
    { key: "pos", header: "POs" },
    { key: "grns", header: "GRNs" },
    { key: "products", header: "Items" },
    { key: "purchaseQty", header: "Purchase Qty", render: (r) => qtyFmt(r.purchaseQty) },
    { key: "grossPurchase", header: "Gross Purchase", render: (r) => inr(r.grossPurchase) },
    { key: "returns", header: "Returns", render: (r) => inr(r.returns) },
    { key: "netPurchase", header: "Net Purchase", render: (r) => inr(r.netPurchase) },
    { key: "paid", header: "Paid", render: (r) => inr(r.paid) },
    { key: "payable", header: "Payable", render: (r) => inr(r.payable) },
  ],
  month: [
    { key: "month", header: "Month" },
    { key: "poCount", header: "PO Count" },
    { key: "grnCount", header: "GRN Count" },
    { key: "invoiceCount", header: "Invoice Count" },
    { key: "grossPurchase", header: "Gross Purchase", render: (r) => inr(r.grossPurchase) },
    { key: "returns", header: "Returns", render: (r) => inr(r.returns) },
    { key: "netPurchase", header: "Net Purchase", render: (r) => inr(r.netPurchase) },
    { key: "paid", header: "Paid", render: (r) => inr(r.paid) },
    { key: "payable", header: "Payable", render: (r) => inr(r.payable) },
  ],
  product: [
    { key: "productCode", header: "Item Code" },
    { key: "product", header: "Items" },
    { key: "category", header: "Category" },
    { key: "brand", header: "Brand" },
    { key: "qty", header: "Qty Purchased", render: (r) => qtyFmt(r.qty) },
    { key: "unit", header: "Unit" },
    { key: "purchaseValue", header: "Purchase Value", render: (r) => inr(r.purchaseValue) },
    { key: "returnQty", header: "Return Qty", render: (r) => qtyFmt(r.returnQty) },
    { key: "returnValue", header: "Return Value", render: (r) => inr(r.returnValue) },
    { key: "netPurchase", header: "Net Purchase", render: (r) => inr(r.netPurchase) },
  ],
  category: [
    { key: "category", header: "Category" },
    { key: "products", header: "Items" },
    { key: "qty", header: "Qty Purchased", render: (r) => qtyFmt(r.qty) },
    { key: "grossPurchase", header: "Gross Purchase", render: (r) => inr(r.grossPurchase) },
    { key: "returns", header: "Returns", render: (r) => inr(r.returns) },
    { key: "netPurchase", header: "Net Purchase", render: (r) => inr(r.netPurchase) },
  ],
  brand: [
    { key: "brand", header: "Brand" },
    { key: "products", header: "Items" },
    { key: "qty", header: "Qty Purchased", render: (r) => qtyFmt(r.qty) },
    { key: "grossPurchase", header: "Purchase Value", render: (r) => inr(r.grossPurchase) },
    { key: "returns", header: "Returns", render: (r) => inr(r.returns) },
    { key: "netPurchase", header: "Net Purchase", render: (r) => inr(r.netPurchase) },
  ],
  po: [
    { key: "poNo", header: "PO No." },
    { key: "date", header: "Date" },
    { key: "supplier", header: "Supplier" },
    { key: "products", header: "Items" },
    { key: "orderQty", header: "Order Qty", render: (r) => qtyFmt(r.orderQty) },
    { key: "orderValue", header: "Order Value", render: (r) => inr(r.orderValue) },
    { key: "received", header: "Received", render: (r) => qtyFmt(r.received) },
    { key: "pending", header: "Pending", render: (r) => qtyFmt(r.pending) },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ],
  gr: [
    { key: "grnNo", header: "GRN No." },
    { key: "date", header: "Date" },
    { key: "poNo", header: "PO No." },
    { key: "supplier", header: "Supplier" },
    { key: "product", header: "Items" },
    { key: "receivedQty", header: "Received Qty", render: (r) => qtyFmt(r.receivedQty) },
    { key: "accepted", header: "Accepted", render: (r) => qtyFmt(r.accepted) },
    { key: "rejected", header: "Rejected", render: (r) => qtyFmt(r.rejected) },
    { key: "warehouse", header: "Warehouse" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ],
  invoice: [
    { key: "invoiceNo", header: "Invoice No." },
    { key: "date", header: "Date" },
    { key: "supplier", header: "Supplier" },
    { key: "poNo", header: "PO No." },
    { key: "grnNo", header: "GRN No." },
    { key: "invoiceValue", header: "Invoice Value", render: (r) => inr(r.invoiceValue) },
    { key: "paid", header: "Paid", render: (r) => inr(r.paid) },
    { key: "payable", header: "Payable", render: (r) => inr(r.payable) },
    { key: "dueDate", header: "Due Date" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ],
  return: [
    { key: "returnNo", header: "Return No." },
    { key: "date", header: "Date" },
    { key: "supplier", header: "Supplier" },
    { key: "invoiceNumber", header: "Invoice" },
    { key: "product", header: "Items" },
    { key: "returnQty", header: "Return Qty", render: (r) => qtyFmt(r.returnQty) },
    { key: "returnValue", header: "Return Value", render: (r) => inr(r.returnValue) },
    { key: "reason", header: "Reason" },
    { key: "creditNote", header: "Credit Note" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ],
  payables: [
    { key: "supplier", header: "Supplier" },
    { key: "invoiceValue", header: "Invoice Value", render: (r) => inr(r.invoiceValue) },
    { key: "paid", header: "Paid", render: (r) => inr(r.paid) },
    { key: "outstanding", header: "Outstanding", render: (r) => inr(r.outstanding) },
    { key: "overdue", header: "Overdue", render: (r) => inr(r.overdue) },
    { key: "dueThisWeek", header: "Due This Week", render: (r) => inr(r.dueThisWeek) },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ],
};

export default function PurchaseReports() {
  const [expanded] = useState(true);
  const [activeTab, setActiveTab] = useState("supplier");
  const [filterOptions, setFilterOptions] = useState({
    suppliers: [],
    products: [],
    categories: [],
    brands: [],
    warehouses: [],
  });
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    api.get("/api/reports/purchase-summary/filters").then(setFilterOptions);
    runReport(DEFAULT_FILTERS, activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    runReport(filters, activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const buildParams = (activeFilters) => {
    const { dateFrom, dateTo } = resolveDateRange(activeFilters.dateRange);
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (activeFilters.supplier !== "all") params.set("supplier", activeFilters.supplier);
    if (activeFilters.product !== "all") params.set("product", activeFilters.product);
    if (activeFilters.category !== "all") params.set("category", activeFilters.category);
    if (activeFilters.brand !== "all") params.set("brand", activeFilters.brand);
    if (activeFilters.warehouse !== "all") params.set("warehouse", activeFilters.warehouse);
    return params;
  };

  const runReport = async (activeFilters, tab) => {
    setLoading(true);
    try {
      const params = buildParams(activeFilters);
      params.set("groupBy", tab);
      const result = await api.get(`/api/reports/purchase-summary/breakdown?${params.toString()}`);
      setRows(result.rows || []);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => runReport(filters, activeTab);

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    runReport(DEFAULT_FILTERS, activeTab);
  };

  const columns = COLUMN_SETS[activeTab];

  const tabLabel = TABS.find((t) => t.key === activeTab)?.label || "";
  const reportTitle = `Purchase Report — ${tabLabel}`;
  const shareSummary = [
    reportTitle,
    `${rows.length} row${rows.length === 1 ? "" : "s"}`,
    `Generated: ${new Date().toLocaleDateString("en-IN")}`,
  ].join("\n");

  return (
    <div>
      <PageHeader title="Purchase Reports" crumbs={["Dashboard", "Reports", "Purchase Reports"]} />

      {expanded && (
        <div style={{ marginTop: 20 }}>
          <div className="tabs-bar" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {TABS.map((t) => (
              <button
                key={t.key}
                className="btn"
                style={activeTab === t.key ? { background: "var(--blue)", color: "#fff", borderColor: "var(--blue)" } : undefined}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="filter-bar" style={{ gap: 10, alignItems: "flex-end" }}>
            {/* Filters scroll horizontally on their own; the action buttons sit
                outside this scroll box so the Download/Share dropdowns aren't clipped. */}
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-end",
                overflowX: "auto",
                flex: "1 1 auto",
                minWidth: 0,
                paddingBottom: 2,
              }}
            >
              <div className="filter-field" style={{ minWidth: 110 }}>
                <label>Date Range</label>
                <Select value={filters.dateRange} onChange={(e) => setFilters((f) => ({ ...f, dateRange: e.target.value }))}>
                  {DATE_RANGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </div>
              <div className="filter-field" style={{ minWidth: 120 }}>
                <label>Supplier</label>
                <Select value={filters.supplier} onChange={(e) => setFilters((f) => ({ ...f, supplier: e.target.value }))}>
                  <option value="all">All Suppliers</option>
                  {filterOptions.suppliers.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
              </div>
              <div className="filter-field" style={{ minWidth: 120 }}>
                <label>Items</label>
                <Select value={filters.product} onChange={(e) => setFilters((f) => ({ ...f, product: e.target.value }))}>
                  <option value="all">All Items</option>
                  {filterOptions.products.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </Select>
              </div>
              <div className="filter-field" style={{ minWidth: 120 }}>
                <label>Categories</label>
                <Select value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
                  <option value="all">All Categories</option>
                  {filterOptions.categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </div>
              <div className="filter-field" style={{ minWidth: 110 }}>
                <label>Brand</label>
                <Select value={filters.brand} onChange={(e) => setFilters((f) => ({ ...f, brand: e.target.value }))}>
                  <option value="all">All Brands</option>
                  {filterOptions.brands.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </Select>
              </div>
              <div className="filter-field" style={{ minWidth: 130 }}>
                <label>Warehouse</label>
                <Select value={filters.warehouse} onChange={(e) => setFilters((f) => ({ ...f, warehouse: e.target.value }))}>
                  <option value="all">All Warehouses</option>
                  {filterOptions.warehouses.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </Select>
              </div>
            </div>
            <button className="filter-apply-btn" style={{ flexShrink: 0, whiteSpace: "nowrap" }} onClick={applyFilters}>Apply Filters</button>
            <button className="btn" style={{ flexShrink: 0, whiteSpace: "nowrap" }} onClick={resetFilters}>Reset</button>
            <ExportButtons
              rows={rows}
              columns={columns}
              title={reportTitle}
              filenameBase={`purchase-${activeTab}-report`}
            />
            <ShareButtons
              rows={rows}
              columns={columns}
              title={reportTitle}
              filenameBase={`purchase-${activeTab}-report`}
              summaryText={shareSummary}
            />
          </div>

          <div className="card" style={{ marginTop: 20 }}>
            <DataTable columns={columns} rows={rows} loading={loading} emptyText="No purchase data matches these filters." />
          </div>
        </div>
      )}
    </div>
  );
}
