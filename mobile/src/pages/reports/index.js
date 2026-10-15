import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import api from "../../api/client";
import ReportScreen, { fmtInr } from "../../components/data/ReportScreen";
import Screen from "../../components/layout/Screen";
import { Card, Empty, Loader } from "../../components/ui";
import { colors } from "../../theme";

// Ports of pages/reports/* — same endpoints, tabs, filters and columns.

const DATE_RANGES = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "this_year", label: "This Year" },
  { value: "last_30_days", label: "Last 30 Days" },
];

function resolveDateRange(key) {
  if (!key || key === "all") return {};
  const now = new Date();
  const start = new Date(now);
  if (key === "this_week") start.setDate(now.getDate() - now.getDay());
  else if (key === "this_month") start.setDate(1);
  else if (key === "this_quarter") start.setMonth(Math.floor(now.getMonth() / 3) * 3, 1);
  else if (key === "this_year") start.setMonth(0, 1);
  else if (key === "last_30_days") start.setDate(now.getDate() - 30);
  start.setHours(0, 0, 0, 0);
  return { dateFrom: start.toISOString(), dateTo: now.toISOString() };
}

function paramsFrom(filters, keys) {
  const p = new URLSearchParams();
  const { dateFrom, dateTo } = resolveDateRange(filters.dateRange);
  if (dateFrom) p.set("dateFrom", dateFrom);
  if (dateTo) p.set("dateTo", dateTo);
  keys.forEach((k) => {
    if (filters[k] && filters[k] !== "all") p.set(k, filters[k]);
  });
  return p;
}

function useOptions(path) {
  const [opts, setOpts] = useState({});
  useEffect(() => {
    api.get(path).then((r) => setOpts(r || {})).catch(() => {});
  }, [path]);
  return opts;
}

const C = (key, header, fmt) => ({ key, header, fmt });

// ---------------------------------------------------------------- Sales
const SALES_TABS = [
  { key: "overview", label: "Overview" },
  { key: "month", label: "By Month" },
  { key: "customer", label: "By Customer" },
  { key: "product", label: "By Item" },
  { key: "category", label: "By Category" },
  { key: "brand", label: "By Brand" },
  { key: "detail", label: "Transactions" },
];
const SALES_COLUMNS = {
  overview: [C("customer", "Customer"), C("product", "Items"), C("region", "Region"), C("orders", "Orders"), C("qty", "Qty", "qty"), C("value", "Value", "inr")],
  month: [C("month", "Month"), C("salesOrders", "Sales Orders"), C("invoices", "Invoices"), C("grossSales", "Gross Sales", "inr"), C("returns", "Returns", "inr"), C("netSales", "Net Sales", "inr"), C("paid", "Paid", "inr"), C("outstanding", "Outstanding", "inr")],
  customer: [C("customer", "Customer"), C("orders", "Orders"), C("qty", "Qty Sold", "qty"), C("grossSales", "Gross Sales", "inr"), C("returns", "Returns", "inr"), C("netSales", "Net Sales", "inr"), C("paid", "Paid", "inr"), C("outstanding", "Outstanding", "inr")],
  product: [C("product", "Items"), C("productCode", "Item Code"), C("category", "Category"), C("brand", "Brand"), C("qty", "Qty Sold", "qty"), C("unit", "Unit"), C("grossSales", "Gross Sales", "inr"), C("returns", "Returns", "inr"), C("netSales", "Net Sales", "inr")],
  category: [C("category", "Category"), C("products", "Items"), C("qty", "Qty Sold", "qty"), C("grossSales", "Gross Sales", "inr"), C("returns", "Returns", "inr"), C("netSales", "Net Sales", "inr")],
  brand: [C("brand", "Brand"), C("products", "Items"), C("qty", "Qty Sold", "qty"), C("grossSales", "Sales Value", "inr"), C("returns", "Returns", "inr"), C("netSales", "Net Sales", "inr")],
  detail: [C("customer", "Customer"), C("date", "Date"), C("soNumber", "SO No."), C("invoiceNo", "Invoice No."), C("product", "Items"), C("qty", "Qty", "qty"), C("salesValue", "Sales Value", "inr"), C("returnAmt", "Return", "inr"), C("net", "Net", "inr"), C("paid", "Payment", "inr"), C("status", "Status", "status")],
};

export function SalesReports() {
  const o = useOptions("/api/reports/sales-summary/filters");
  return (
    <ReportScreen
      title="Sales Reports"
      tabs={SALES_TABS}
      columns={SALES_COLUMNS}
      defaultFilters={{ dateRange: "all" }}
      filters={[
        { key: "dateRange", label: "Date Range", options: DATE_RANGES.filter((d) => d.value !== "all"), allLabel: "All Time" },
        { key: "customer", label: "Customer", options: o.customers || [], allLabel: "All Customers" },
        { key: "product", label: "Item", options: o.products || [], allLabel: "All Items" },
        { key: "category", label: "Category", options: o.categories || [], allLabel: "All Categories" },
        { key: "brand", label: "Brand", options: o.brands || [], allLabel: "All Brands" },
      ]}
      load={async (f, tab) => {
        const p = paramsFrom(f, ["customer", "product", "category", "brand"]);
        if (tab === "overview") {
          const r = await api.get(`/api/reports/sales-summary?${p.toString()}`);
          const t = r.totals || { orders: 0, qty: 0, value: 0 };
          return { rows: r.rows || [], kpis: [["Total Orders", t.orders], ["Total Qty", (t.qty || 0).toLocaleString("en-IN"), "teal"], ["Total Value", fmtInr(t.value), "green"]] };
        }
        p.set("groupBy", tab);
        const r = await api.get(`/api/reports/sales-summary/breakdown?${p.toString()}`);
        return { rows: r.rows || [] };
      }}
    />
  );
}

// ---------------------------------------------------------------- Purchase
const PURCHASE_TABS = [
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
const PURCHASE_COLUMNS = {
  supplier: [C("supplier", "Supplier"), C("pos", "POs"), C("grns", "GRNs"), C("products", "Items"), C("purchaseQty", "Purchase Qty", "qty"), C("grossPurchase", "Gross Purchase", "inr"), C("returns", "Returns", "inr"), C("netPurchase", "Net Purchase", "inr"), C("paid", "Paid", "inr"), C("payable", "Payable", "inr")],
  month: [C("month", "Month"), C("poCount", "PO Count"), C("grnCount", "GRN Count"), C("invoiceCount", "Invoice Count"), C("grossPurchase", "Gross Purchase", "inr"), C("returns", "Returns", "inr"), C("netPurchase", "Net Purchase", "inr"), C("paid", "Paid", "inr"), C("payable", "Payable", "inr")],
  product: [C("product", "Items"), C("productCode", "Item Code"), C("category", "Category"), C("brand", "Brand"), C("qty", "Qty Purchased", "qty"), C("unit", "Unit"), C("purchaseValue", "Purchase Value", "inr"), C("returnQty", "Return Qty", "qty"), C("returnValue", "Return Value", "inr"), C("netPurchase", "Net Purchase", "inr")],
  category: [C("category", "Category"), C("products", "Items"), C("qty", "Qty Purchased", "qty"), C("grossPurchase", "Gross Purchase", "inr"), C("returns", "Returns", "inr"), C("netPurchase", "Net Purchase", "inr")],
  brand: [C("brand", "Brand"), C("products", "Items"), C("qty", "Qty Purchased", "qty"), C("grossPurchase", "Purchase Value", "inr"), C("returns", "Returns", "inr"), C("netPurchase", "Net Purchase", "inr")],
  po: [C("poNo", "PO No."), C("date", "Date"), C("supplier", "Supplier"), C("products", "Items"), C("orderQty", "Order Qty", "qty"), C("orderValue", "Order Value", "inr"), C("received", "Received", "qty"), C("pending", "Pending", "qty"), C("status", "Status", "status")],
  gr: [C("grnNo", "GRN No."), C("date", "Date"), C("poNo", "PO No."), C("supplier", "Supplier"), C("product", "Items"), C("receivedQty", "Received Qty", "qty"), C("accepted", "Accepted", "qty"), C("rejected", "Rejected", "qty"), C("warehouse", "Warehouse"), C("status", "Status", "status")],
  invoice: [C("invoiceNo", "Invoice No."), C("date", "Date"), C("supplier", "Supplier"), C("poNo", "PO No."), C("grnNo", "GRN No."), C("invoiceValue", "Invoice Value", "inr"), C("paid", "Paid", "inr"), C("payable", "Payable", "inr"), C("dueDate", "Due Date"), C("status", "Status", "status")],
  return: [C("returnNo", "Return No."), C("date", "Date"), C("supplier", "Supplier"), C("invoiceNumber", "Invoice"), C("product", "Items"), C("returnQty", "Return Qty", "qty"), C("returnValue", "Return Value", "inr"), C("reason", "Reason"), C("creditNote", "Credit Note"), C("status", "Status", "status")],
  payables: [C("supplier", "Supplier"), C("invoiceValue", "Invoice Value", "inr"), C("paid", "Paid", "inr"), C("outstanding", "Outstanding", "inr"), C("overdue", "Overdue", "inr"), C("dueThisWeek", "Due This Week", "inr"), C("status", "Status", "status")],
};

export function PurchaseReports() {
  const o = useOptions("/api/reports/purchase-summary/filters");
  return (
    <ReportScreen
      title="Purchase Reports"
      tabs={PURCHASE_TABS}
      columns={PURCHASE_COLUMNS}
      defaultFilters={{ dateRange: "all" }}
      filters={[
        { key: "dateRange", label: "Date Range", options: DATE_RANGES.filter((d) => d.value !== "all"), allLabel: "All Time" },
        { key: "supplier", label: "Supplier", options: o.suppliers || [], allLabel: "All Suppliers" },
        { key: "product", label: "Item", options: o.products || [], allLabel: "All Items" },
        { key: "category", label: "Category", options: o.categories || [], allLabel: "All Categories" },
        { key: "brand", label: "Brand", options: o.brands || [], allLabel: "All Brands" },
        { key: "warehouse", label: "Warehouse", options: o.warehouses || [], allLabel: "All Warehouses" },
      ]}
      load={async (f, tab) => {
        const p = paramsFrom(f, ["supplier", "product", "category", "brand", "warehouse"]);
        p.set("groupBy", tab);
        const r = await api.get(`/api/reports/purchase-summary/breakdown?${p.toString()}`);
        return { rows: r.rows || [] };
      }}
    />
  );
}

// ---------------------------------------------------------------- Inventory
const INV_TABS = [
  { key: "overview", label: "Valuation" },
  { key: "product", label: "Item" },
  { key: "category", label: "Category" },
  { key: "brand", label: "Brand" },
  { key: "warehouse", label: "Warehouse" },
  { key: "batch", label: "Batch" },
  { key: "movement", label: "Stock Movement" },
  { key: "lowstock", label: "Low Stock" },
];
const INV_COLUMNS = {
  overview: [C("product", "Items"), C("productCode", "Item Code"), C("category", "Category"), C("brand", "Brand"), C("warehouse", "Warehouse"), C("batch", "Batch"), C("qty", "Qty", "qty"), C("unit", "Unit"), C("avgCost", "Avg Cost", "inr"), C("stockValue", "Stock Value", "inr"), C("status", "Status", "status")],
  product: [C("product", "Items"), C("productCode", "Item Code"), C("category", "Category"), C("brand", "Brand"), C("qty", "Qty", "qty"), C("unit", "Unit"), C("stockValue", "Stock Value", "inr")],
  category: [C("category", "Category"), C("products", "Items"), C("qty", "Qty", "qty"), C("stockValue", "Stock Value", "inr")],
  brand: [C("brand", "Brand"), C("products", "Items"), C("qty", "Qty", "qty"), C("stockValue", "Stock Value", "inr")],
  warehouse: [C("warehouse", "Warehouse"), C("products", "Items"), C("quantity", "Quantity", "qty"), C("available", "Available", "qty"), C("reserved", "Reserved", "qty"), C("damaged", "Damaged", "qty"), C("stockValue", "Stock Value", "inr")],
  batch: [C("batch", "Batch"), C("productCode", "Item Code"), C("product", "Items"), C("warehouse", "Warehouse"), C("qty", "Qty", "qty"), C("unit", "Unit"), C("stockValue", "Stock Value", "inr"), C("status", "Status", "status")],
  movement: [C("product", "Items"), C("date", "Date"), C("type", "Type"), C("warehouse", "Warehouse"), C("qty", "Qty", "qty"), C("unit", "Unit"), C("value", "Value", "inr")],
  lowstock: [C("product", "Items"), C("productCode", "Item Code"), C("category", "Category"), C("brand", "Brand"), C("warehouse", "Warehouse"), C("currentStock", "Current Stock", "qty"), C("minLevel", "Min Level", "qty"), C("reorderLevel", "Reorder Level", "qty"), C("shortage", "Shortage", "qty"), C("supplier", "Supplier"), C("status", "Priority", "status")],
};

function StockValueCalc({ calc }) {
  if (!calc) return null;
  const row = (label, value, color, sign) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
      <Text style={{ color: colors.textMuted }}>{label}</Text>
      <Text style={{ color: color || colors.text, fontWeight: "600" }}>
        {sign}
        {fmtInr(Math.abs(value))}
      </Text>
    </View>
  );
  return (
    <Card>
      <Text style={{ fontWeight: "700", marginBottom: 6 }}>Stock Value Calculation</Text>
      {row("Opening Stock Value", calc.openingStockValue, null, "")}
      {row("Stock In Value", calc.stockInValue, colors.green, "+ ")}
      {row("Stock Out Value", calc.stockOutValue, colors.red, "− ")}
      {row("Stock Adjustment", calc.adjustmentValue, null, calc.adjustmentValue >= 0 ? "+ " : "− ")}
      <View style={{ borderTopWidth: 1, borderColor: colors.border, marginTop: 4, paddingTop: 4 }}>{row("Current Stock Value", calc.currentStockValue, null, "= ")}</View>
    </Card>
  );
}

export function InventoryReports() {
  const v = useOptions("/api/reports/inventory-valuation/filters");
  const l = useOptions("/api/reports/low-stock/filters");
  return (
    <ReportScreen
      title="Inventory Reports"
      tabs={INV_TABS}
      columns={INV_COLUMNS}
      defaultFilters={{}}
      filters={[
        { key: "asOnDate", label: "As on date (valuation)", type: "date" },
        { key: "warehouse", label: "Warehouse", options: v.warehouses || [], allLabel: "All Warehouses" },
        { key: "category", label: "Category", options: v.categories || [], allLabel: "All Categories" },
        { key: "brand", label: "Brand", options: v.brands || [], allLabel: "All Brands" },
        { key: "product", label: "Item", options: v.products || [], allLabel: "All Items" },
        { key: "stockStatus", label: "Stock Status", options: ["Available", "Low Stock", "Out of Stock", ...(l.criticalities || []).filter((c) => c !== "Out of Stock")], allLabel: "All Statuses" },
        { key: "supplier", label: "Supplier (low stock)", options: l.suppliers || [], allLabel: "All Suppliers" },
      ]}
      load={async (f, tab) => {
        const p = new URLSearchParams();
        ["warehouse", "category", "brand", "product", "stockStatus"].forEach((k) => f[k] && f[k] !== "all" && p.set(k, f[k]));
        if (tab === "lowstock") {
          if (f.supplier && f.supplier !== "all") p.set("supplier", f.supplier);
          const r = await api.get(`/api/reports/low-stock?${p.toString()}`);
          const k = r.kpis || {};
          return {
            rows: r.rows || [],
            kpis: [
              ["Total Low Stock", k.totalLowStock ?? 0, "amber"],
              ["Critical", k.critical ?? 0, "red"],
              ["Below Reorder Level", k.belowReorderLevel ?? 0, "amber"],
              ["Out of Stock", k.outOfStock ?? 0, "red"],
              ["Reorder Required", k.reorderRequired ?? 0, "teal"],
              ["Est. Reorder Value", fmtInr(k.estimatedReorderValue), "green"],
            ],
          };
        }
        if (f.asOnDate) p.set("asOnDate", f.asOnDate);
        const [summary, breakdown] = await Promise.all([
          api.get(`/api/reports/inventory-valuation/summary?${p.toString()}`),
          api.get(`/api/reports/inventory-valuation/breakdown?${p.toString()}&groupBy=${tab}`),
        ]);
        const k = summary.kpis || {};
        return {
          rows: breakdown.rows || [],
          kpis: [
            ["Total Products", k.totalProducts ?? 0],
            ["Total Stock Qty", (k.totalStockQty || 0).toLocaleString("en-IN"), "teal"],
            ["Available Stock", (k.availableStock || 0).toLocaleString("en-IN"), "green"],
            ["Reserved Stock", (k.reservedStock || 0).toLocaleString("en-IN"), "amber"],
            ["Damaged Stock", (k.damagedStock || 0).toLocaleString("en-IN"), "red"],
            ["Total Stock Value", fmtInr(k.totalStockValue), "green"],
            ["Average Stock Value", fmtInr(Math.round(k.averageStockValue || 0)), "teal"],
            ["Warehouses", k.warehouses ?? 0],
          ],
          extra: <StockValueCalc calc={summary.stockValueCalc} />,
        };
      }}
    />
  );
}

// ---------------------------------------------------------------- Financial / Other
function ReportsCategory({ title, category }) {
  const [reports, setReports] = useState(null);
  useEffect(() => {
    api.get(`/api/reports?category=${encodeURIComponent(category)}`).then(setReports).catch(() => setReports([]));
  }, [category]);
  return (
    <Screen title={title}>
      {reports === null ? (
        <Loader />
      ) : reports.length === 0 ? (
        <Empty text="No reports in this category yet." icon="chart" />
      ) : (
        reports.map((r) => (
          <Card key={r.id}>
            <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "700", textTransform: "uppercase" }}>{r.category}</Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, marginTop: 4 }}>{r.name}</Text>
            <Text style={{ color: colors.textMuted, marginTop: 4 }}>{r.description}</Text>
          </Card>
        ))
      )}
    </Screen>
  );
}

export const FinancialReports = () => <ReportsCategory title="Financial Reports" category="Finance" />;
export const OtherReports = () => <ReportsCategory title="Other Reports" category="Other" />;
