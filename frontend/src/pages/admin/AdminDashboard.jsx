import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import adminApi from "../../api/adminClient";
import PageHeader from "../../components/layout/PageHeader";
import DataTable from "../../components/data/DataTable";
import StatusBadge from "../../components/ui/StatusBadge";
import Loader from "../../components/ui/Loader";
import Icon from "../../components/ui/Icon";

const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const KPIS = [
  { key: "totalClients", label: "Total Clients", icon: "users", tone: "blue" },
  { key: "activeClients", label: "Active", icon: "checkCircle", tone: "green" },
  { key: "suspendedClients", label: "Suspended", icon: "xCircle", tone: "red", alertWhenPositive: true },
  { key: "mrr", label: "Monthly Recurring", icon: "banknote", tone: "purple", money: true },
  { key: "totalPlans", label: "Plans", icon: "tag", tone: "orange" },
];

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi
      .get("/api/admin/dashboard")
      .then(setData)
      .catch((err) => setError(err.message || "Could not load the platform dashboard."));
  }, []);

  if (error) {
    return (
      <div>
        <PageHeader title="Platform Overview" crumbs={["Admin"]} />
        <div className="list-card">
          <div className="login-error">{error}</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <PageHeader title="Platform Overview" crumbs={["Admin"]} />
        <div className="loading-row" style={{ padding: 48, textAlign: "center" }}>
          <Loader />
        </div>
      </div>
    );
  }

  const { stats, planSpread, expiringSoon, recentClients, recentOrders = [] } = data;

  const expiringColumns = [
    {
      key: "subdomain",
      header: "Client",
      render: (r) => (
        <Link to="/admin/clients" className="cell-link">
          {r.companyName || r.subdomain}
        </Link>
      ),
    },
    { key: "planName", header: "Plan", render: (r) => r.planName || "—" },
    { key: "subscriptionEnd", header: "Ends", render: (r) => fmtDate(r.subscriptionEnd) },
    {
      key: "daysRemaining",
      header: "Days Left",
      render: (r) => (
        <span style={{ color: r.daysRemaining <= 7 ? "var(--red)" : "var(--text)" }}>
          {r.daysRemaining ?? "—"}
        </span>
      ),
    },
    { key: "state", header: "State", render: (r) => <StatusBadge status={r.state} /> },
  ];

  const recentColumns = [
    { key: "subdomain", header: "Subdomain", render: (r) => <span className="cell-link">{r.subdomain}</span> },
    { key: "companyName", header: "Company", render: (r) => <span className="cell-primary">{r.companyName || "—"}</span> },
    { key: "planName", header: "Plan", render: (r) => r.planName || "—" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "createdAt", header: "Added", render: (r) => fmtDate(r.createdAt) },
  ];

  const maxPlanCount = Math.max(1, ...planSpread.map((p) => p.count));

  return (
    <div>
      <PageHeader
        title="Platform Overview"
        crumbs={["Admin"]}
        actions={
          <Link to="/admin/clients" className="btn btn-primary">
            Manage Clients
          </Link>
        }
      />

      <div className="dash-kpi-grid">
        {KPIS.map((k) => {
          const raw = stats[k.key];
          const alert = k.alertWhenPositive && Number(raw) > 0;
          return (
            <div className={`dash-kpi${alert ? " is-alert" : ""}`} key={k.key}>
              <div className={`dash-kpi-icon ${alert ? "red" : k.tone}`}>
                <Icon name={k.icon} size={20} />
              </div>
              <div className="dash-kpi-label">{k.label}</div>
              <div className="dash-kpi-value">
                {k.money ? inr(raw) : (Number(raw) || 0).toLocaleString("en-IN")}
              </div>
            </div>
          );
        })}
      </div>

      {stats.expiringSoonCount > 0 && (
        <div className="dash-alerts">
          <Link to="/admin/clients" className="dash-alert">
            <Icon name="alertTriangle" size={15} />
            <span>
              {stats.expiringSoonCount} subscription{stats.expiringSoonCount === 1 ? "" : "s"} ending within 30 days
            </span>
            <Icon name="chevronRight" size={13} />
          </Link>
        </div>
      )}

      <div className="dash-main">
        <div className="dash-card">
          <div className="dash-card-head">
            <div className="dash-card-title">
              <Icon name="calendar" size={16} /> Renewals Due
            </div>
          </div>
          {expiringSoon.length === 0 ? (
            <div className="dash-empty">Nothing lapsing in the next 30 days.</div>
          ) : (
            <DataTable columns={expiringColumns} rows={expiringSoon} />
          )}
        </div>

        <div className="dash-card">
          <div className="dash-card-head">
            <div className="dash-card-title">
              <Icon name="chart" size={16} /> Clients per Plan
            </div>
          </div>
          {planSpread.length === 0 ? (
            <div className="dash-empty">No clients yet.</div>
          ) : (
            <div className="admin-plan-spread">
              {planSpread.map((p) => (
                <div className="admin-plan-row" key={p.name}>
                  <span className="admin-plan-name" title={p.name}>
                    {p.name}
                  </span>
                  <span className="admin-plan-bar">
                    <span style={{ width: `${(p.count / maxPlanCount) * 100}%` }} />
                  </span>
                  <span className="admin-plan-count">{p.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="dash-card">
          <div className="dash-card-head">
            <div className="dash-card-title">
              <Icon name="users" size={16} /> Recently Added Clients
            </div>
            <Link to="/admin/clients" className="dash-viewall">
              View All <Icon name="chevronRight" size={13} />
            </Link>
          </div>
          {recentClients.length === 0 ? (
            <div className="dash-empty">No clients yet.</div>
          ) : (
            <DataTable columns={recentColumns} rows={recentClients} />
          )}
        </div>

        <div className="dash-card">
          <div className="dash-card-head">
            <div className="dash-card-title">
              <Icon name="banknote" size={16} /> Recent Transactions
            </div>
            <Link to="/admin/transactions" className="dash-viewall">
              View All <Icon name="chevronRight" size={13} />
            </Link>
          </div>
          {(!recentOrders || recentOrders.length === 0) ? (
            <div className="dash-empty">No subscription payments yet.</div>
          ) : (
            <DataTable
              columns={[
                {
                  key: "companyName",
                  header: "Client",
                  render: (r) => (
                    <div>
                      <span className="cell-primary">{r.companyName || r.tenantSubdomain}</span>
                    </div>
                  ),
                },
                { key: "planName", header: "Plan", render: (r) => r.planName },
                {
                  key: "amountPayable",
                  header: "Amount",
                  render: (r) => <strong style={{ color: "var(--text)" }}>{inr(r.amountPayable)}</strong>,
                },
                {
                  key: "status",
                  header: "Status",
                  render: (r) => (
                    <StatusBadge
                      status={r.status === "paid" ? "Active" : r.status === "failed" ? "Disabled" : "Pending"}
                      label={r.status === "paid" ? "Paid" : r.status}
                    />
                  ),
                },
                { key: "createdAt", header: "Date", render: (r) => fmtDate(r.createdAt) },
              ]}
              rows={recentOrders}
            />
          )}
        </div>
      </div>
    </div>
  );
}
