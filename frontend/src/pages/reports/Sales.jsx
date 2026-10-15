import { useEffect, useState } from "react";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import DataTable from "../../components/data/DataTable";
import StatCard from "../../components/ui/StatCard";
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

const DEFAULT_FILTERS = { dateRange: "all", customer: "all", product: "all", category: "all", brand: "all" };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "month", label: "By Month" },
  { key: "customer", label: "By Customer" },
  { key: "product", label: "By Item" },
  { key: "category", label: "By Category" },
  { key: "brand", label: "By Brand" },
  { key: "detail", label: "Transaction Detail" },
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
  overview: [
    { key: "customer", header: "Customer" },
    { key: "product", header: "Items" },
    { key: "region", header: "Region" },
    { key: "orders", header: "Orders" },
    { key: "qty", header: "Qty", render: (r) => qtyFmt(r.qty) },
    { key: "value", header: "Value", render: (r) => inr(r.value) },
  ],
  month: [
    { key: "month", header: "Month" },
    { key: "salesOrders", header: "Sales Orders" },
    { key: "invoices", header: "Invoices" },
    { key: "grossSales", header: "Gross Sales", render: (r) => inr(r.grossSales) },
    { key: "returns", header: "Returns", render: (r) => inr(r.returns) },
    { key: "netSales", header: "Net Sales", render: (r) => inr(r.netSales) },
    { key: "paid", header: "Paid", render: (r) => inr(r.paid) },
    { key: "outstanding", header: "Outstanding", render: (r) => inr(r.outstanding) },
  ],
  customer: [
    { key: "customer", header: "Customer" },
    { key: "orders", header: "Orders" },
    { key: "qty", header: "Qty Sold", render: (r) => qtyFmt(r.qty) },
    { key: "grossSales", header: "Gross Sales", render: (r) => inr(r.grossSales) },
    { key: "returns", header: "Returns", render: (r) => inr(r.returns) },
    { key: "netSales", header: "Net Sales", render: (r) => inr(r.netSales) },
    { key: "paid", header: "Paid", render: (r) => inr(r.paid) },
    { key: "outstanding", header: "Outstanding", render: (r) => inr(r.outstanding) },
  ],
  product: [
    { key: "productCode", header: "Item Code" },
    { key: "product", header: "Items" },
    { key: "category", header: "Category" },
    { key: "brand", header: "Brand" },
    { key: "qty", header: "Qty Sold", render: (r) => qtyFmt(r.qty) },
    { key: "unit", header: "Unit" },
    { key: "grossSales", header: "Gross Sales", render: (r) => inr(r.grossSales) },
    { key: "returns", header: "Returns", render: (r) => inr(r.returns) },
    { key: "netSales", header: "Net Sales", render: (r) => inr(r.netSales) },
  ],
  category: [
    { key: "category", header: "Category" },
    { key: "products", header: "Items" },
    { key: "qty", header: "Qty Sold", render: (r) => qtyFmt(r.qty) },
    { key: "grossSales", header: "Gross Sales", render: (r) => inr(r.grossSales) },
    { key: "returns", header: "Returns", render: (r) => inr(r.returns) },
    { key: "netSales", header: "Net Sales", render: (r) => inr(r.netSales) },
  ],
  brand: [
    { key: "brand", header: "Brand" },
    { key: "products", header: "Items" },
    { key: "qty", header: "Qty Sold", render: (r) => qtyFmt(r.qty) },
    { key: "grossSales", header: "Sales Value", render: (r) => inr(r.grossSales) },
    { key: "returns", header: "Returns", render: (r) => inr(r.returns) },
    { key: "netSales", header: "Net Sales", render: (r) => inr(r.netSales) },
  ],
  detail: [
    { key: "date", header: "Date" },
    { key: "soNumber", header: "SO No." },
    { key: "invoiceNo", header: "Invoice No." },
    { key: "customer", header: "Customer" },
    { key: "product", header: "Items" },
    { key: "qty", header: "Qty", render: (r) => qtyFmt(r.qty) },
    { key: "salesValue", header: "Sales Value", render: (r) => inr(r.salesValue) },
    { key: "returnAmt", header: "Return", render: (r) => inr(r.returnAmt) },
    { key: "net", header: "Net", render: (r) => inr(r.net) },
    { key: "paid", header: "Payment", render: (r) => inr(r.paid) },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ],
};

export default function SalesReports() {
  const [expanded] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [filterOptions, setFilterOptions] = useState({ customers: [], products: [], categories: [], brands: [] });
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    api.get("/api/reports/sales-summary/filters").then(setFilterOptions);
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
    if (activeFilters.customer !== "all") params.set("customer", activeFilters.customer);
    if (activeFilters.product !== "all") params.set("product", activeFilters.product);
    if (activeFilters.category !== "all") params.set("category", activeFilters.category);
    if (activeFilters.brand !== "all") params.set("brand", activeFilters.brand);
    return params;
  };

  const runReport = async (activeFilters, tab) => {
    setLoading(true);
    try {
      const params = buildParams(activeFilters);
      if (tab === "overview") {
        const result = await api.get(`/api/reports/sales-summary?${params.toString()}`);
        setRows(result.rows || []);
        setTotals(result.totals || { orders: 0, qty: 0, value: 0 });
      } else {
        params.set("groupBy", tab);
        const result = await api.get(`/api/reports/sales-summary/breakdown?${params.toString()}`);
        setRows(result.rows || []);
        setTotals(null);
      }
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
  const reportTitle = `Sales Report — ${tabLabel}`;
  const shareSummary = [
    reportTitle,
    totals
      ? `Total Orders: ${totals.orders} | Total Qty: ${qtyFmt(totals.qty)} | Total Value: ${inr(totals.value)}`
      : `${rows.length} row${rows.length === 1 ? "" : "s"}`,
    `Generated: ${new Date().toLocaleDateString("en-IN")}`,
  ].join("\n");

  return (
    <div>
      <PageHeader title="Sales Reports" crumbs={["Dashboard", "Reports", "Sales Reports"]} />

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
                outside this scroll box so the Download dropdown isn't clipped. */}
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
                <label>Customer</label>
                <Select value={filters.customer} onChange={(e) => setFilters((f) => ({ ...f, customer: e.target.value }))}>
                  <option value="all">All Customers</option>
                  {filterOptions.customers.map((c) => (
                    <option key={c} value={c}>{c}</option>
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
                <label>Category</label>
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
            </div>
            <button className="filter-apply-btn" style={{ flexShrink: 0, whiteSpace: "nowrap" }} onClick={applyFilters}>Apply Filters</button>
            <button className="btn" style={{ flexShrink: 0, whiteSpace: "nowrap" }} onClick={resetFilters}>Reset</button>
            <ExportButtons
              rows={rows}
              columns={columns}
              title={reportTitle}
              filenameBase={`sales-${activeTab}-report`}
            />
            <ShareButtons
              rows={rows}
              columns={columns}
              title={reportTitle}
              filenameBase={`sales-${activeTab}-report`}
              summaryText={shareSummary}
            />
          </div>

          {totals && (
            <div className="stat-grid" style={{ marginTop: 20 }}>
              <StatCard icon="cart" tone="blue" label="Total Orders" value={totals.orders} />
              <StatCard icon="package" tone="teal" label="Total Qty" value={qtyFmt(totals.qty)} />
              <StatCard icon="banknote" tone="green" label="Total Value" value={inr(totals.value)} />
            </div>
          )}

          <div className="card" style={{ marginTop: 20 }}>
            <DataTable columns={columns} rows={rows} loading={loading} emptyText="No sales data matches these filters." />
          </div>
        </div>
      )}
    </div>
  );
}
