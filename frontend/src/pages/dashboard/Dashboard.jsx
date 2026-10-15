import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import Icon from "../../components/ui/Icon";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../context/PermissionsContext";
import Loader from "../../components/ui/Loader";

const fmtINR = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;

function fmtCompact(n) {
  const v = Math.abs(n || 0);
  if (v >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  if (v >= 1e3) return `₹${(n / 1e3).toFixed(1)}k`;
  return `₹${Math.round(n || 0)}`;
}

const AVATAR_COLORS = ["var(--blue)", "var(--purple)", "var(--teal-dark)", "var(--orange-dark)", "var(--green-dark)"];
const initial = (s) => (s || "?").trim().charAt(0).toUpperCase() || "?";
const colorFor = (s) =>
  AVATAR_COLORS[[...(s || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

const KPIS = [
  { key: "totalRevenueYTD", module: "sales", label: "Total Sales (Invoiced)", icon: "banknote", tone: "blue", money: true, delta: "revenue" },
  { key: "totalPurchaseValue", module: "purchase", label: "Total Purchases", icon: "cart", tone: "green", money: true, delta: "purchases" },
  { key: "totalProducts", module: "products", label: "Total Products", icon: "package", tone: "purple" },
  { key: "totalOpenValue", module: "sales", label: "Open Sales Value", icon: "trending", tone: "teal", money: true },
  { key: "stockValue", module: "inventory", label: "Stock Value", icon: "tag", tone: "orange", money: true },
];

// Shop-floor KPIs. `tone` is the icon chip colour; `alertWhenPositive` flips
// the card to a warning look when the number is something to act on (an
// order stuck waiting for material is bad news, unlike 40 units produced).
const MFG_KPIS = [
  { key: "openWorkOrders", label: "Open Work Orders", icon: "wrench", tone: "blue" },
  { key: "producedThisMonth", label: "Produced This Month", icon: "package", tone: "green" },
  { key: "yieldPct", label: "Yield", icon: "checkCircle", tone: "teal", percent: true },
  { key: "materialShortages", label: "Awaiting Material", icon: "alertTriangle", tone: "orange", alertWhenPositive: true },
];

// One-tap shortcuts to the things people do all day — shown only for menus
// this user may create in, like everything else on this page.
const QUICK_ACTIONS = [
  { label: "New Invoice", icon: "banknote", to: "/sales/invoices/new", module: "sales", tone: "blue" },
  { label: "New Quotation", icon: "file", to: "/sales/quotations/new", module: "sales", tone: "purple" },
  { label: "Purchase Order", icon: "cart", to: "/purchase/orders/new", module: "purchase", tone: "green" },
  { label: "Add Customer", icon: "users", to: "/customers/new", module: "customers", tone: "teal" },
  { label: "Add Item", icon: "package", to: "/products/items/new", module: "products", tone: "orange" },
];

const RANGES = [
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "12M", months: 12 },
];

function DeltaChip({ value }) {
  if (value == null) return null;
  const up = value >= 0;
  return (
    <span className={`dash-delta ${up ? "up" : "down"}`}>
      <Icon name={up ? "chevronUp" : "chevronDown"} size={11} />
      {up ? "+" : ""}
      {value}% <span className="dash-delta-sub">vs last month</span>
    </span>
  );
}

function SectionCard({ title, icon, viewAll, children }) {
  return (
    <div className="dash-card">
      <div className="dash-card-head">
        <div className="dash-card-title">
          <Icon name={icon} size={16} /> {title}
        </div>
        {viewAll && (
          <Link to={viewAll} className="dash-viewall">
            View All <Icon name="chevronRight" size={13} />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

// `format` lets the same tooltip serve the money chart and the unit-count
// production chart.
function ChartTooltip({ active, payload, label, format = fmtINR }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="dash-tooltip">
      <div className="dash-tooltip-label">{label}</div>
      <div className="dash-tooltip-value">{format(payload[0].value)}</div>
    </div>
  );
}

// Produced-vs-planned bar, the same read as the Work Orders list.
function WorkOrderProgress({ row }) {
  const planned = Number(row.plannedQty) || 0;
  const produced = Number(row.producedQty) || 0;
  const pct = planned > 0 ? Math.min(100, Math.round((produced / planned) * 100)) : 0;
  return (
    <div className="dash-wo-progress">
      <div className="dash-wo-progress-text">
        {produced.toLocaleString("en-IN")} / {planned.toLocaleString("en-IN")} {row.unit || ""}
        <span className="dash-wo-pct">{pct}%</span>
      </div>
      <div className="dash-wo-bar">
        <div className={`dash-wo-bar-fill${pct >= 100 ? " done" : ""}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const [data, setData] = useState(null);
  const [adminName, setAdminName] = useState("");
  const [range, setRange] = useState(6);

  useEffect(() => {
    api.swr("/api/dashboard", setData).catch(() => {});
    api.get("/api/settings").then((s) => setAdminName(s?.adminName || "")).catch(() => {});
  }, []);

  const name = adminName || user?.name || "Admin";

  if (!data) {
    return (
      <div>
        <PageHeader title={`Welcome back, ${name}!`} crumbs={["Dashboard"]} />
        <div className="dash-kpi-grid">
          {KPIS.filter((k) => can(k.module, "view")).map((k) => (
            <div className="dash-kpi is-loading" key={k.key}>
              <div className="dash-kpi-icon skel" />
              <div className="dash-skel-line w60" />
              <div className="dash-skel-line w80 tall" />
            </div>
          ))}
        </div>
        <div className="loading-row"><Loader /></div>
      </div>
    );
  }

  const { stats, recentSalesOrders = [], recentInvoices = [], topCustomers = [] } = data;
  // Every block follows the same menu access as the sidebar: no Manufacturing
  // menu, no Production section; no Customers menu, no customer widgets.
  const showSales = can("sales", "view");
  const showCustomers = can("customers", "view");
  const showMfgSection = can("manufacturing", "view");
  const visibleKpis = KPIS.filter((k) => can(k.module, "view"));
  const quickActions = QUICK_ACTIONS.filter((a) => can(a.module, "create"));
  const nothingToShow = !visibleKpis.length && !showSales && !showCustomers && !showMfgSection;
  const deltas = data.deltas || {};
  const trend = (data.salesTrend || []).slice(-range);
  // Guarded rather than destructured: a frontend deployed ahead of the
  // backend would otherwise crash instead of just hiding the section.
  const mfg = showMfgSection ? data.manufacturing?.stats : null;
  const recentWorkOrders = data.manufacturing?.recentWorkOrders || [];
  const productionTrend = (data.productionTrend || []).slice(-range);
  // Things worth chasing today. Each only appears when it's actually nonzero.
  const shopAlerts = mfg
    ? [
        mfg.overdueWorkOrders > 0 && {
          key: "overdue",
          icon: "alertCircle",
          text: `${mfg.overdueWorkOrders} work order${mfg.overdueWorkOrders === 1 ? "" : "s"} past due date`,
          to: "/manufacturing/work-orders",
        },
        mfg.materialShortages > 0 && {
          key: "shortage",
          icon: "alertTriangle",
          text: `${mfg.materialShortages} released order${mfg.materialShortages === 1 ? "" : "s"} still waiting on material`,
          to: "/manufacturing/work-orders",
        },
        mfg.machinesDown > 0 && {
          key: "machines",
          icon: "settings",
          text: `${mfg.machinesDown} machine${mfg.machinesDown === 1 ? "" : "s"} down or under maintenance`,
          to: "/manufacturing/machines",
        },
      ].filter(Boolean)
    : [];

  return (
    <div>
      <PageHeader title={`Welcome back, ${name}!`} crumbs={["Dashboard"]} />

      {quickActions.length > 0 && (
        <div className="dash-quick" aria-label="Quick actions">
          <span className="dash-quick-label">Quick actions</span>
          {quickActions.map((a) => (
            <Link key={a.label} to={a.to} className="dash-quick-btn">
              <span className={`dash-quick-icon ${a.tone}`}>
                <Icon name={a.icon} size={15} />
              </span>
              {a.label}
              <Icon name="plus" size={13} className="dash-quick-plus" />
            </Link>
          ))}
        </div>
      )}

      {nothingToShow && (
        <div className="dash-empty" style={{ padding: "48px 0", textAlign: "center" }}>
          There is nothing to show here yet — your account has no dashboard sections enabled.
        </div>
      )}

      {visibleKpis.length > 0 && (
      <div className="dash-kpi-grid">
        {visibleKpis.map((k) => (
          <div className={`dash-kpi tone-${k.tone}`} key={k.key}>
            <div className={`dash-kpi-icon ${k.tone}`}>
              <Icon name={k.icon} size={20} />
            </div>
            <div className="dash-kpi-label">{k.label}</div>
            <div className="dash-kpi-value">
              {k.money ? fmtINR(stats[k.key]) : (stats[k.key] ?? 0).toLocaleString("en-IN")}
            </div>
            <DeltaChip value={k.delta ? deltas[k.delta] : undefined} />
          </div>
        ))}
      </div>
      )}

      {(showSales || showCustomers) && (
      <div className="dash-section-heading">
        <Icon name="coins" size={16} /> {showSales ? "Sales & Finance" : "Customers"}
      </div>
      )}

      {(showSales || showCustomers) && (
      <div className={`dash-main${showSales && showCustomers ? "" : " single"}`}>
        {showSales && (
        <div className="dash-card">
          <div className="dash-card-head">
            <div className="dash-card-title">
              <Icon name="chart" size={16} /> Sales Trend (₹)
            </div>
            <div className="dash-range">
              {RANGES.map((r) => (
                <button
                  key={r.label}
                  type="button"
                  className={range === r.months ? "active" : ""}
                  onClick={() => setRange(r.months)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="dashArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--text-light)" }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 12, fill: "var(--text-light)" }}
                tickLine={false}
                axisLine={false}
                width={54}
                tickFormatter={(v) => fmtCompact(v)}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border)" }} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#2563eb"
                strokeWidth={2.5}
                fill="url(#dashArea)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        )}

        {showCustomers && (
        <SectionCard title="Top Customers" icon="users" viewAll="/customers">
          {topCustomers.length === 0 ? (
            <div className="dash-empty">No customers yet.</div>
          ) : (
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th className="num">Orders</th>
                    <th className="num">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomers.map((c) => (
                    <tr key={c.id || c.name}>
                      <td>
                        <div className="dash-cust">
                          <span className="dash-avatar" style={{ background: colorFor(c.name) }}>
                            {initial(c.name)}
                          </span>
                          <div className="dash-cust-text">
                            {c.id ? (
                              <Link to={`/customers/${encodeURIComponent(c.id)}`} className="dash-cust-name cell-link">
                                {c.name}
                              </Link>
                            ) : (
                              <span className="dash-cust-name">{c.name}</span>
                            )}
                            <span className="dash-cust-sub">{c.city || "—"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="num">{c.totalOrders ?? 0}</td>
                      <td className="num">{fmtINR(c.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
        )}
      </div>
      )}

      {showSales && (
      <div className="dash-lists">
        <SectionCard title="Recent Sales Orders" icon="cart" viewAll="/sales/orders">
          {recentSalesOrders.length === 0 ? (
            <div className="dash-empty">No sales orders yet.</div>
          ) : (
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Order No.</th>
                    <th>Customer</th>
                    <th className="num">Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSalesOrders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link to={`/sales/orders/${encodeURIComponent(o.id)}`} className="cell-link">
                          {o.orderNo || o.id}
                        </Link>
                      </td>
                      <td className="dash-td-name">{o.customer}</td>
                      <td className="num">{fmtINR(o.amount)}</td>
                      <td><StatusBadge status={o.status} /></td>
                      <td className="dash-td-date">{o.orderDate || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Recent Invoices" icon="banknote" viewAll="/sales/invoices">
          {recentInvoices.length === 0 ? (
            <div className="dash-empty">No invoices yet.</div>
          ) : (
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Invoice No.</th>
                    <th>Customer</th>
                    <th className="num">Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <Link to={`/sales/invoices/${encodeURIComponent(inv.id)}`} className="cell-link">
                          {inv.id}
                        </Link>
                      </td>
                      <td className="dash-td-name">{inv.customer}</td>
                      <td className="num">{fmtINR(inv.amount)}</td>
                      <td><StatusBadge status={inv.status} /></td>
                      <td className="dash-td-date">{inv.date || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
      )}

      {mfg && (
        <>
          <div className="dash-section-heading">
            <Icon name="wrench" size={16} /> Production
          </div>

          <div className="dash-kpi-grid cols-4">
            {MFG_KPIS.map((k) => {
              const raw = mfg[k.key];
              const alert = k.alertWhenPositive && Number(raw) > 0;
              return (
                <Link
                  to="/manufacturing/work-orders"
                  className={`dash-kpi dash-kpi-link tone-${alert ? "red" : k.tone}${alert ? " is-alert" : ""}`}
                  key={k.key}
                >
                  <div className={`dash-kpi-icon ${alert ? "red" : k.tone}`}>
                    <Icon name={k.icon} size={20} />
                  </div>
                  <div className="dash-kpi-label">{k.label}</div>
                  <div className="dash-kpi-value">
                    {/* Yield is null until something has actually been booked
                        in — showing "0%" then would read as a quality problem. */}
                    {raw == null ? "—" : `${Number(raw).toLocaleString("en-IN")}${k.percent ? "%" : ""}`}
                  </div>
                </Link>
              );
            })}
          </div>

          {shopAlerts.length > 0 && (
            <div className="dash-alerts">
              {shopAlerts.map((a) => (
                <Link key={a.key} to={a.to} className="dash-alert">
                  <Icon name={a.icon} size={15} />
                  <span>{a.text}</span>
                  <Icon name="chevronRight" size={13} />
                </Link>
              ))}
            </div>
          )}

          <div className="dash-main">
            <div className="dash-card">
              <div className="dash-card-head">
                <div className="dash-card-title">
                  <Icon name="trending" size={16} /> Production Output ({recentWorkOrders[0]?.unit || "units"})
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={productionTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashAreaProd" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#16a34a" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--text-light)" }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: "var(--text-light)" }}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={<ChartTooltip format={(v) => `${Number(v).toLocaleString("en-IN")} accepted`} />}
                    cursor={{ stroke: "var(--border)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#16a34a"
                    strokeWidth={2.5}
                    fill="url(#dashAreaProd)"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <SectionCard title="Recent Work Orders" icon="file" viewAll="/manufacturing/work-orders">
              {recentWorkOrders.length === 0 ? (
                <div className="dash-empty">No work orders yet.</div>
              ) : (
                <div className="dash-table-wrap">
                  <table className="dash-table">
                    <thead>
                      <tr>
                        <th>WO No.</th>
                        <th>Product</th>
                        <th>Progress</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentWorkOrders.map((w) => (
                        <tr key={w.id}>
                          <td>
                            <Link to={`/manufacturing/work-orders/${encodeURIComponent(w.id)}`} className="cell-link">
                              {w.id}
                            </Link>
                          </td>
                          <td className="dash-td-name">{w.product}</td>
                          <td><WorkOrderProgress row={w} /></td>
                          <td><StatusBadge status={w.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
