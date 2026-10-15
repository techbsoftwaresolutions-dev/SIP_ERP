import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import DataTable from "../../components/data/DataTable";
import StatCard from "../../components/ui/StatCard";
import Icon from "../../components/ui/Icon";
import ExportButtons from "../../components/data/ExportButtons";
import ShareButtons from "../../components/share/ShareButtons";
import DateInput from "../../components/forms/DateInput";
import Select from "../../components/forms/Select";

function inr(n) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

function qtyFmt(n) {
  return (n || 0).toLocaleString("en-IN");
}

/* ---------------- Inventory Valuation Report ---------------- */

const VALUATION_TABS = [
  { key: "overview", label: "Overview" },
  { key: "product", label: "Item" },
  { key: "category", label: "Category" },
  { key: "brand", label: "Brand" },
  { key: "warehouse", label: "Warehouse" },
  { key: "batch", label: "Batch" },
  { key: "movement", label: "Stock Movement" },
];

const VALUATION_DEFAULT_FILTERS = { asOnDate: "", warehouse: "all", category: "all", brand: "all", product: "all", stockStatus: "all" };

const VALUATION_COLUMN_SETS = {
  overview: [
    { key: "productCode", header: "Item Code" },
    { key: "product", header: "Items" },
    { key: "category", header: "Category" },
    { key: "brand", header: "Brand" },
    { key: "warehouse", header: "Warehouse" },
    { key: "batch", header: "Batch" },
    { key: "qty", header: "Qty", render: (r) => qtyFmt(r.qty) },
    { key: "unit", header: "Unit" },
    { key: "avgCost", header: "Avg Cost", render: (r) => inr(r.avgCost) },
    { key: "stockValue", header: "Stock Value", render: (r) => inr(r.stockValue) },
    { key: "status", header: "Status" },
  ],
  product: [
    { key: "productCode", header: "Item Code" },
    { key: "product", header: "Items" },
    { key: "category", header: "Category" },
    { key: "brand", header: "Brand" },
    { key: "qty", header: "Qty", render: (r) => qtyFmt(r.qty) },
    { key: "unit", header: "Unit" },
    { key: "stockValue", header: "Stock Value", render: (r) => inr(r.stockValue) },
  ],
  category: [
    { key: "category", header: "Category" },
    { key: "products", header: "Items" },
    { key: "qty", header: "Qty", render: (r) => qtyFmt(r.qty) },
    { key: "stockValue", header: "Stock Value", render: (r) => inr(r.stockValue) },
  ],
  brand: [
    { key: "brand", header: "Brand" },
    { key: "products", header: "Items" },
    { key: "qty", header: "Qty", render: (r) => qtyFmt(r.qty) },
    { key: "stockValue", header: "Stock Value", render: (r) => inr(r.stockValue) },
  ],
  warehouse: [
    { key: "warehouse", header: "Warehouse" },
    { key: "products", header: "Items" },
    { key: "quantity", header: "Quantity", render: (r) => qtyFmt(r.quantity) },
    { key: "available", header: "Available", render: (r) => qtyFmt(r.available) },
    { key: "reserved", header: "Reserved", render: (r) => qtyFmt(r.reserved) },
    { key: "damaged", header: "Damaged", render: (r) => qtyFmt(r.damaged) },
    { key: "stockValue", header: "Stock Value", render: (r) => inr(r.stockValue) },
  ],
  batch: [
    { key: "batch", header: "Batch" },
    { key: "productCode", header: "Item Code" },
    { key: "product", header: "Items" },
    { key: "warehouse", header: "Warehouse" },
    { key: "qty", header: "Qty", render: (r) => qtyFmt(r.qty) },
    { key: "unit", header: "Unit" },
    { key: "stockValue", header: "Stock Value", render: (r) => inr(r.stockValue) },
    { key: "status", header: "Status" },
  ],
  movement: [
    { key: "date", header: "Date" },
    { key: "type", header: "Type" },
    { key: "product", header: "Items" },
    { key: "warehouse", header: "Warehouse" },
    { key: "qty", header: "Qty", render: (r) => qtyFmt(r.qty) },
    { key: "unit", header: "Unit" },
    { key: "value", header: "Value", render: (r) => inr(r.value) },
  ],
};

function ValuationReportCard() {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [filterOptions, setFilterOptions] = useState({ warehouses: [], categories: [], brands: [], products: [] });
  const [filters, setFilters] = useState(VALUATION_DEFAULT_FILTERS);
  const [rows, setRows] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [calc, setCalc] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    api.get("/api/reports/inventory-valuation/filters").then(setFilterOptions);
    runReport(VALUATION_DEFAULT_FILTERS, activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    runReport(filters, activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const buildParams = (f) => {
    const params = new URLSearchParams();
    if (f.asOnDate) params.set("asOnDate", f.asOnDate);
    if (f.warehouse !== "all") params.set("warehouse", f.warehouse);
    if (f.category !== "all") params.set("category", f.category);
    if (f.brand !== "all") params.set("brand", f.brand);
    if (f.product !== "all") params.set("product", f.product);
    if (f.stockStatus !== "all") params.set("stockStatus", f.stockStatus);
    return params;
  };

  const runReport = async (f, tab) => {
    setLoading(true);
    try {
      const params = buildParams(f);
      const [summary, breakdown] = await Promise.all([
        api.get(`/api/reports/inventory-valuation/summary?${params.toString()}`),
        api.get(`/api/reports/inventory-valuation/breakdown?${params.toString()}&groupBy=${tab}`),
      ]);
      setKpis(summary.kpis || null);
      setCalc(summary.stockValueCalc || null);
      setRows(breakdown.rows || []);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => runReport(filters, activeTab);
  const resetFilters = () => {
    setFilters(VALUATION_DEFAULT_FILTERS);
    runReport(VALUATION_DEFAULT_FILTERS, activeTab);
  };

  const columns = VALUATION_COLUMN_SETS[activeTab];
  const reportTitle = `Inventory Valuation Report — ${VALUATION_TABS.find((t) => t.key === activeTab)?.label || ""}`;
  const shareSummary = [reportTitle, `${rows.length} row${rows.length === 1 ? "" : "s"}`, `Generated: ${new Date().toLocaleDateString("en-IN")}`].join("\n");

  return (
    <div>
      <div className="report-card" style={{ cursor: "pointer" }} onClick={() => setExpanded((e) => !e)}>
        <span className="cat">Inventory</span>
        <h3>Inventory Valuation Report</h3>
        <p>Current stock quantity and value across all warehouses.</p>
        <div className="meta">{expanded ? <>Click to collapse <Icon name="chevronUp" size={13} /></> : <>Click to view report <Icon name="chevronDown" size={13} /></>}</div>
      </div>

      {expanded && (
        <div style={{ marginTop: 20 }}>
          <div className="filter-bar" style={{ gap: 10, alignItems: "flex-end" }}>
            {/* Filters scroll horizontally on their own; the action buttons sit
                outside this scroll box so the Download/Share dropdowns aren't clipped. */}
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", overflowX: "auto", flex: "1 1 auto", minWidth: 0, paddingBottom: 2 }}>
              <div className="filter-field" style={{ minWidth: 130 }}>
                <label>As On Date</label>
                <DateInput value={filters.asOnDate} onChange={(e) => setFilters((f) => ({ ...f, asOnDate: e.target.value }))} />
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
              <div className="filter-field" style={{ minWidth: 130 }}>
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
                <label>Stock Status</label>
                <Select value={filters.stockStatus} onChange={(e) => setFilters((f) => ({ ...f, stockStatus: e.target.value }))}>
                  <option value="all">All Statuses</option>
                  <option value="Available">Available</option>
                  <option value="Low Stock">Low Stock</option>
                  <option value="Out of Stock">Out of Stock</option>
                </Select>
              </div>
            </div>
            <button className="filter-apply-btn" style={{ flexShrink: 0, whiteSpace: "nowrap" }} onClick={applyFilters}>Apply Filters</button>
            <button className="btn" style={{ flexShrink: 0, whiteSpace: "nowrap" }} onClick={resetFilters}>Reset</button>
            <ExportButtons
              rows={rows}
              columns={columns}
              title={reportTitle}
              filenameBase={`inventory-valuation-${activeTab}`}
            />
            <ShareButtons
              rows={rows}
              columns={columns}
              title={reportTitle}
              filenameBase={`inventory-valuation-${activeTab}`}
              summaryText={shareSummary}
            />
          </div>

          {kpis && (
            <div className="stat-grid" style={{ marginTop: 20, gridTemplateColumns: "repeat(4, 1fr)" }}>
              <StatCard icon="package" tone="blue" label="Total Products" value={kpis.totalProducts} />
              <StatCard icon="chart" tone="teal" label="Total Stock Qty" value={qtyFmt(kpis.totalStockQty)} />
              <StatCard icon="checkCircle" tone="green" label="Available Stock" value={qtyFmt(kpis.availableStock)} />
              <StatCard icon="lock" tone="amber" label="Reserved Stock" value={qtyFmt(kpis.reservedStock)} />
              <StatCard icon="alertTriangle" tone="red" label="Damaged Stock" value={qtyFmt(kpis.damagedStock)} />
              <StatCard icon="coins" tone="green" label="Total Stock Value" value={inr(kpis.totalStockValue)} />
              <StatCard icon="trending" tone="teal" label="Average Stock Value" value={inr(Math.round(kpis.averageStockValue))} />
              <StatCard icon="store" tone="purple" label="Warehouses" value={kpis.warehouses} />
            </div>
          )}

          {calc && (
            <div className="card" style={{ marginTop: 20, padding: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>Stock Value Calculation</div>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
                <div><div className="cell-sub">Opening Stock Value</div><div className="cell-primary">{inr(calc.openingStockValue)}</div></div>
                <div><div className="cell-sub">Stock In Value</div><div style={{ color: "var(--green)" }}>+ {inr(calc.stockInValue)}</div></div>
                <div><div className="cell-sub">Stock Out Value</div><div style={{ color: "var(--red)" }}>− {inr(calc.stockOutValue)}</div></div>
                <div><div className="cell-sub">Stock Adjustment</div><div>{calc.adjustmentValue >= 0 ? "+" : "−"} {inr(Math.abs(calc.adjustmentValue))}</div></div>
                <div><div className="cell-sub">Current Stock Value</div><div style={{ fontWeight: 700 }}>= {inr(calc.currentStockValue)}</div></div>
              </div>
            </div>
          )}

          <div className="tabs-bar" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 20, marginBottom: 16 }}>
            {VALUATION_TABS.map((t) => (
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

          <div className="card">
            <DataTable columns={columns} rows={rows} loading={loading} emptyText="No inventory data matches these filters." />
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Low Stock Alert Report ---------------- */

const LOW_STOCK_DEFAULT_FILTERS = { warehouse: "all", category: "all", brand: "all", product: "all", stockStatus: "all", supplier: "all" };

const LOW_STOCK_COLUMNS_BASE = [
  { key: "productCode", header: "Item Code" },
  { key: "product", header: "Items" },
  { key: "category", header: "Category" },
  { key: "brand", header: "Brand" },
  { key: "warehouse", header: "Warehouse" },
  { key: "currentStock", header: "Current Stock", render: (r) => qtyFmt(r.currentStock) },
  { key: "minLevel", header: "Min Level", render: (r) => qtyFmt(r.minLevel) },
  { key: "reorderLevel", header: "Reorder Level", render: (r) => qtyFmt(r.reorderLevel) },
  { key: "shortage", header: "Shortage", render: (r) => qtyFmt(r.shortage) },
  { key: "supplier", header: "Supplier" },
];

const PRIORITY_META = {
  Critical: { icon: "xCircle", label: "Critical" },
  High: { icon: "alertTriangle", label: "High" },
  Medium: { icon: "alertCircle", label: "Medium" },
  "Out of Stock": { icon: "xCircle", label: "Out of Stock" },
};

function LowStockReportCard() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [filterOptions, setFilterOptions] = useState({ warehouses: [], categories: [], brands: [], products: [], suppliers: [], criticalities: [] });
  const [filters, setFilters] = useState(LOW_STOCK_DEFAULT_FILTERS);
  const [rows, setRows] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    api.get("/api/reports/low-stock/filters").then(setFilterOptions);
    runReport(LOW_STOCK_DEFAULT_FILTERS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const buildParams = (f) => {
    const params = new URLSearchParams();
    if (f.warehouse !== "all") params.set("warehouse", f.warehouse);
    if (f.category !== "all") params.set("category", f.category);
    if (f.brand !== "all") params.set("brand", f.brand);
    if (f.product !== "all") params.set("product", f.product);
    if (f.stockStatus !== "all") params.set("stockStatus", f.stockStatus);
    if (f.supplier !== "all") params.set("supplier", f.supplier);
    return params;
  };

  const runReport = async (f) => {
    setLoading(true);
    try {
      const params = buildParams(f);
      const result = await api.get(`/api/reports/low-stock?${params.toString()}`);
      setRows(result.rows || []);
      setKpis(result.kpis || null);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => runReport(filters);
  const resetFilters = () => {
    setFilters(LOW_STOCK_DEFAULT_FILTERS);
    runReport(LOW_STOCK_DEFAULT_FILTERS);
  };

  const columns = [
    ...LOW_STOCK_COLUMNS_BASE,
    {
      key: "status",
      header: "Priority",
      render: (r) => {
        const meta = PRIORITY_META[r.status];
        if (!meta) return r.status;
        return (
          <span className="icon-text">
            <Icon name={meta.icon} size={15} /> {meta.label}
          </span>
        );
      },
    },
    {
      key: "__action",
      header: "Action",
      render: (r) => (
        <button type="button" className="btn" onClick={() => navigate("/purchase/orders")}>
          {r.status === "Out of Stock" ? "Create PO" : "Reorder"}
        </button>
      ),
    },
  ];

  const shareSummary = ["Low Stock Alert Report", `${rows.length} row${rows.length === 1 ? "" : "s"}`, `Generated: ${new Date().toLocaleDateString("en-IN")}`].join("\n");

  return (
    <div>
      <div className="report-card" style={{ cursor: "pointer" }} onClick={() => setExpanded((e) => !e)}>
        <span className="cat">Inventory</span>
        <h3>Low Stock Alert Report</h3>
        <p>Products below reorder level that need replenishment.</p>
        <div className="meta">{expanded ? <>Click to collapse <Icon name="chevronUp" size={13} /></> : <>Click to view report <Icon name="chevronDown" size={13} /></>}</div>
      </div>

      {expanded && (
        <div style={{ marginTop: 20 }}>
          <div className="filter-bar" style={{ gap: 10, alignItems: "flex-end" }}>
            {/* Filters scroll horizontally on their own; the action buttons sit
                outside this scroll box so the Download/Share dropdowns aren't clipped. */}
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", overflowX: "auto", flex: "1 1 auto", minWidth: 0, paddingBottom: 2 }}>
              <div className="filter-field" style={{ minWidth: 130 }}>
                <label>Warehouse</label>
                <Select value={filters.warehouse} onChange={(e) => setFilters((f) => ({ ...f, warehouse: e.target.value }))}>
                  <option value="all">All Warehouses</option>
                  {filterOptions.warehouses.map((w) => (
                    <option key={w} value={w}>{w}</option>
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
                <label>Stock Status</label>
                <Select value={filters.stockStatus} onChange={(e) => setFilters((f) => ({ ...f, stockStatus: e.target.value }))}>
                  <option value="all">All Statuses</option>
                  {filterOptions.criticalities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </div>
              <div className="filter-field" style={{ minWidth: 130 }}>
                <label>Supplier</label>
                <Select value={filters.supplier} onChange={(e) => setFilters((f) => ({ ...f, supplier: e.target.value }))}>
                  <option value="all">All Suppliers</option>
                  {filterOptions.suppliers.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
              </div>
            </div>
            <button className="filter-apply-btn" style={{ flexShrink: 0, whiteSpace: "nowrap" }} onClick={applyFilters}>Apply Filters</button>
            <button className="btn" style={{ flexShrink: 0, whiteSpace: "nowrap" }} onClick={resetFilters}>Reset</button>
            <ExportButtons
              rows={rows}
              columns={columns}
              title="Low Stock Alert Report"
              filenameBase="low-stock-alert-report"
            />
            <ShareButtons
              rows={rows}
              columns={columns}
              title="Low Stock Alert Report"
              filenameBase="low-stock-alert-report"
              summaryText={shareSummary}
            />
          </div>

          {kpis && (
            <div className="stat-grid" style={{ marginTop: 20, gridTemplateColumns: "repeat(3, 1fr)" }}>
              <StatCard icon="alertTriangle" tone="amber" label="Total Low Stock" value={kpis.totalLowStock} />
              <StatCard icon="alertCircle" tone="red" label="Critical" value={kpis.critical} />
              <StatCard icon="trending" tone="orange" label="Below Reorder Level" value={kpis.belowReorderLevel} />
              <StatCard icon="xCircle" tone="red" label="Out of Stock" value={kpis.outOfStock} />
              <StatCard icon="cart" tone="teal" label="Reorder Required" value={kpis.reorderRequired} />
              <StatCard icon="banknote" tone="green" label="Estimated Reorder Value" value={inr(kpis.estimatedReorderValue)} />
            </div>
          )}

          <div className="card" style={{ marginTop: 20 }}>
            <DataTable columns={columns} rows={rows} loading={loading} emptyText="No low stock items match these filters." />
          </div>

          <div className="card" style={{ marginTop: 20, padding: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Stock Status</div>
            <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
              <div><div className="icon-text"><Icon name="xCircle" size={15} /> Out of Stock</div><div className="cell-sub">Current Stock = 0</div></div>
              <div><div className="icon-text"><Icon name="xCircle" size={15} /> Critical</div><div className="cell-sub">Below Minimum Level</div></div>
              <div><div className="icon-text"><Icon name="alertTriangle" size={15} /> High</div><div className="cell-sub">Below Reorder Level</div></div>
              <div><div className="icon-text"><Icon name="alertCircle" size={15} /> Medium</div><div className="cell-sub">Approaching Reorder Level</div></div>
              <div><div className="icon-text"><Icon name="checkCircle" size={15} /> Normal</div><div className="cell-sub">Stock is sufficient</div></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InventoryReports() {
  return (
    <div>
      <PageHeader title="Inventory Reports" crumbs={["Dashboard", "Reports", "Inventory Reports"]} />
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <ValuationReportCard />
        <LowStockReportCard />
      </div>
    </div>
  );
}
