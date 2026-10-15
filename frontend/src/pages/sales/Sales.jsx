import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import Icon from "../../components/ui/Icon";
import Select from "../../components/forms/Select";

function inr(n) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

function todayLabel() {
  const d = new Date();
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const PERIODS = [
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
];

const QUICK_ACTIONS = [
  { label: "New Order", icon: "cart", color: "green", to: "/sales/orders" },
  { label: "Create Invoice", icon: "file", color: "purple", to: "/sales/invoices" },
  { label: "Sales Return", glyph: "₹", color: "orange", to: "/sales/returns" },
  { label: "Sales Report", icon: "chart", color: "blue", to: "/reports/sales" },
];

const ICON_BG = {
  purple: { background: "var(--purple-bg)", color: "var(--purple)" },
  orange: { background: "var(--orange-bg)", color: "var(--orange-dark)" },
  green: { background: "var(--green-bg)", color: "var(--green-dark)" },
  blue: { background: "var(--blue-bg)", color: "var(--blue)" },
};

export default function Sales() {
  const navigate = useNavigate();
  const [range, setRange] = useState("month");
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("orders");

  useEffect(() => {
    api.get(`/api/sales/overview?range=${range}`).then(setData).catch(() => {});
  }, [range]);

  const stats = data?.stats || {};

  return (
    <div>
      <PageHeader
        title="Sales"
        crumbs={["Dashboard", "Sales"]}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => navigate("/sales/orders")}>
            + New Order
          </button>
        }
      />

      <div className="sales-filter-row">
        <div className="sales-filter-pill"><Icon name="calendar" size={16} /> {todayLabel()}</div>
        <Select
          className="sales-filter-pill"
          value={range}
          onChange={(e) => setRange(e.target.value)}
          style={{ appearance: "none", cursor: "pointer" }}
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </Select>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-top"><div className="kpi-icon green"><Icon name="banknote" size={21} /></div></div>
          <div className="kpi-label">Total Sales (Invoiced)</div>
          <div className="kpi-value">{inr(stats.totalSalesInvoiced)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top"><div className="kpi-icon blue"><Icon name="cart" size={21} /></div></div>
          <div className="kpi-label">Total Orders</div>
          <div className="kpi-value">{(stats.totalOrders ?? 0).toLocaleString("en-IN")}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top"><div className="kpi-icon purple"><Icon name="file" size={21} /></div></div>
          <div className="kpi-label">Total Invoices</div>
          <div className="kpi-value">{(stats.totalInvoices ?? 0).toLocaleString("en-IN")}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top"><div className="kpi-icon orange"><Icon name="wallet" size={21} /></div></div>
          <div className="kpi-label">Average Order Value</div>
          <div className="kpi-value">{inr(stats.averageOrderValue)}</div>
        </div>
      </div>

      <div className="list-card" style={{ marginBottom: "18px" }}>
        <div className="section-title">Sales Trend (₹)</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data?.salesTrend || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e9ef" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} />
            <Tooltip formatter={(v) => inr(v)} />
            <Bar dataKey="value" fill="#f97316" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="list-card">
        <div className="sales-tabs">
          <button type="button" className={`sales-tab ${tab === "orders" ? "active" : ""}`} onClick={() => setTab("orders")}>Recent Orders</button>
          <button type="button" className={`sales-tab ${tab === "invoices" ? "active" : ""}`} onClick={() => setTab("invoices")}>Recent Invoices</button>
        </div>

        {tab === "orders" ? (
          <>
            {(data?.recentOrders || []).length === 0 && <div className="loading-row">No sales orders yet.</div>}
            {(data?.recentOrders || []).map((o) => (
              <div className="sales-order-row" key={o.id} onClick={() => navigate("/sales/orders")} role="button" tabIndex={0}>
                <div className="sales-order-avatar">{(o.customer || "?").charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cell-primary">{o.orderNo}</div>
                  <div className="cell-sub">{o.customer}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <StatusBadge status={o.status} />
                  <div className="cell-primary" style={{ marginTop: 4 }}>{inr(o.amount)}</div>
                </div>
              </div>
            ))}
            <button type="button" className="sales-view-all" onClick={() => navigate("/sales/orders")}>View</button>
          </>
        ) : (
          <>
            {(data?.recentInvoices || []).length === 0 && <div className="loading-row">No invoices yet.</div>}
            {(data?.recentInvoices || []).map((inv) => (
              <div className="sales-order-row" key={inv.id} onClick={() => navigate("/sales/invoices")} role="button" tabIndex={0}>
                <div className="sales-order-avatar">{(inv.customer || "?").charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cell-primary">{inv.id}</div>
                  <div className="cell-sub">{inv.customer}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <StatusBadge status={inv.status} />
                  <div className="cell-primary" style={{ marginTop: 4 }}>{inr(inv.amount)}</div>
                </div>
              </div>
            ))}
            <button type="button" className="sales-view-all" onClick={() => navigate("/sales/invoices")}>View</button>
          </>
        )}
      </div>

      <div className="quick-actions-title">Quick Actions</div>
      <div className="quick-actions-grid">
        {QUICK_ACTIONS.map((qa) => (
          <div key={qa.label} className="quick-action-tile" onClick={() => navigate(qa.to)} role="button" tabIndex={0}>
            <div className="quick-action-icon" style={ICON_BG[qa.color]}>{qa.glyph || <Icon name={qa.icon} size={20} />}</div>
            <div className="quick-action-label">{qa.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
