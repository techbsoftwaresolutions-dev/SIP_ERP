import { useEffect, useState, useCallback } from "react";
import adminApi from "../../api/adminClient";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/ui/Icon";
import Loader from "../../components/ui/Loader";
import StatusBadge from "../../components/ui/StatusBadge";

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export default function Transactions() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
    });
    if (statusFilter !== "all") params.append("status", statusFilter);
    if (search.trim()) params.append("search", search.trim());

    adminApi
      .get(`/api/admin/transactions?${params.toString()}`)
      .then((res) => {
        setData(res);
        setError("");
      })
      .catch((err) => setError(err.message || "Failed to load transactions."))
      .finally(() => setLoading(false));
  }, [page, statusFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const stats = data?.stats || {
    totalRevenue: 0,
    paidCount: 0,
    createdCount: 0,
    failedCount: 0,
  };

  return (
    <div>
      <PageHeader
        title="Payment Transactions"
        subtitle="Live log of all Razorpay subscription checkouts and billing events across all clients"
        crumbs={["Admin", "Transactions"]}
        actions={
          <button type="button" className="btn" onClick={load} title="Refresh transactions list">
            <Icon name="search" size={14} /> Refresh
          </button>
        }
      />

      {/* KPI Cards */}
      <div className="dash-kpi-grid" style={{ marginBottom: 24 }}>
        <div className="dash-kpi">
          <div className="dash-kpi-icon green">
            <Icon name="banknote" size={20} />
          </div>
          <div className="dash-kpi-label">Total Revenue Collected</div>
          <div className="dash-kpi-value">{inr(stats.totalRevenue)}</div>
        </div>

        <div className="dash-kpi">
          <div className="dash-kpi-icon blue">
            <Icon name="checkCircle" size={20} />
          </div>
          <div className="dash-kpi-label">Successful Payments</div>
          <div className="dash-kpi-value">{stats.paidCount}</div>
        </div>

        <div className="dash-kpi">
          <div className="dash-kpi-icon orange">
            <Icon name="cart" size={20} />
          </div>
          <div className="dash-kpi-label">Initiated / Abandoned</div>
          <div className="dash-kpi-value">{stats.createdCount}</div>
        </div>

        <div className={`dash-kpi${stats.failedCount > 0 ? " is-alert" : ""}`}>
          <div className={`dash-kpi-icon ${stats.failedCount > 0 ? "red" : "gray"}`}>
            <Icon name="alertTriangle" size={20} />
          </div>
          <div className="dash-kpi-label">Failed Verifications</div>
          <div className="dash-kpi-value">{stats.failedCount}</div>
        </div>
      </div>

      {error && (
        <div className="login-error" style={{ marginBottom: 18 }}>
          {error}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div
        className="list-card"
        style={{
          marginBottom: 20,
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {["all", "paid", "created", "failed"].map((st) => (
            <button
              key={st}
              type="button"
              className={`btn ${statusFilter === st ? "btn-primary" : ""}`}
              style={{
                textTransform: "capitalize",
                padding: "6px 14px",
                fontSize: "0.85rem",
              }}
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
            >
              {st === "all" ? "All Orders" : st}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative", width: 280 }}>
            <input
              type="text"
              className="input-field"
              placeholder="Search company, order ID, payment ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", paddingLeft: 30 }}
            />
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}>
              <Icon name="search" size={14} />
            </span>
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: "6px 14px" }}>
            Search
          </button>
          {search && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Orders Table */}
      <div className="list-card">
        {loading ? (
          <div className="loading-row">
            <Loader />
          </div>
        ) : !data?.data?.length ? (
          <div style={{ padding: "48px 20px", textAlign: "center", color: "#64748b" }}>
            <Icon name="wallet" size={36} />
            <div style={{ fontSize: "1.1rem", fontWeight: 600, marginTop: 12 }}>No transactions found</div>
            <p style={{ margin: "4px 0 0", fontSize: "0.88rem" }}>
              {search || statusFilter !== "all"
                ? "Try clearing your filters or search term."
                : "Transactions will appear here when clients upgrade their subscriptions."}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Client / Subdomain</th>
                  <th>Plan &amp; Term</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th>Gateway Order ID</th>
                  <th>Payment ID</th>
                  <th>Status</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((order) => {
                  return (
                    <tr key={order.id}>
                      <td style={{ whiteSpace: "nowrap", fontSize: "0.85rem" }}>
                        {fmtDate(order.createdAt)}
                      </td>
                      <td>
                        <strong>{order.companyName}</strong>
                        <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                          <code>{order.tenantSubdomain}</code>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{order.planName}</span>
                        <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                          {order.termMonths} month{order.termMonths === 1 ? "" : "s"}
                        </div>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, fontSize: "0.95rem" }}>
                        {inr(order.amountPayable)}
                      </td>
                      <td>
                        {order.gatewayOrderId ? (
                          <code style={{ fontSize: "0.82rem" }}>{order.gatewayOrderId}</code>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>
                      <td>
                        {order.gatewayPaymentId ? (
                          <code style={{ fontSize: "0.82rem", color: "#059669" }}>
                            {order.gatewayPaymentId}
                          </code>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>
                      <td>
                        <StatusBadge
                          status={
                            order.status === "paid"
                              ? "Active"
                              : order.status === "failed"
                              ? "Disabled"
                              : "Pending"
                          }
                          label={
                            order.status === "paid"
                              ? "Paid"
                              : order.status === "failed"
                              ? "Failed"
                              : "Created"
                          }
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: "4px 8px", fontSize: "0.8rem" }}
                          onClick={() => setSelectedOrder(order)}
                          title="View order details"
                        >
                          <Icon name="file" size={13} /> View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data?.pagination && data.pagination.pages > 1 && (
          <div
            style={{
              padding: "16px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderTop: "1px solid #e2e8f0",
            }}
          >
            <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
              Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, data.pagination.total)} of{" "}
              {data.pagination.total} orders
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span style={{ padding: "6px 12px", fontSize: "0.85rem", fontWeight: 600 }}>
                Page {page} of {data.pagination.pages}
              </span>
              <button
                type="button"
                className="btn"
                disabled={page >= data.pagination.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedOrder && (
        <div
          className="modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="modal-content"
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: "24px 28px",
              width: "100%",
              maxWidth: 580,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>Transaction Details</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setSelectedOrder(null)}
                aria-label="Close"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: "0.9rem" }}>
              <div>
                <span style={{ color: "#64748b", display: "block", fontSize: "0.8rem" }}>Client Subdomain</span>
                <strong>{selectedOrder.tenantSubdomain}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b", display: "block", fontSize: "0.8rem" }}>Company Name</span>
                <strong>{selectedOrder.companyName || "—"}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b", display: "block", fontSize: "0.8rem" }}>Plan</span>
                <strong>{selectedOrder.planName} ({selectedOrder.planCode})</strong>
              </div>
              <div>
                <span style={{ color: "#64748b", display: "block", fontSize: "0.8rem" }}>Term</span>
                <strong>{selectedOrder.termMonths} month{selectedOrder.termMonths === 1 ? "" : "s"}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b", display: "block", fontSize: "0.8rem" }}>Amount Payable</span>
                <strong style={{ fontSize: "1.1rem", color: "#1e293b" }}>{inr(selectedOrder.amountPayable)}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b", display: "block", fontSize: "0.8rem" }}>Status</span>
                <StatusBadge
                  status={
                    selectedOrder.status === "paid"
                      ? "Active"
                      : selectedOrder.status === "failed"
                      ? "Disabled"
                      : "Pending"
                  }
                  label={selectedOrder.status}
                />
              </div>
              <div>
                <span style={{ color: "#64748b", display: "block", fontSize: "0.8rem" }}>Razorpay Order ID</span>
                <code>{selectedOrder.gatewayOrderId || "None"}</code>
              </div>
              <div>
                <span style={{ color: "#64748b", display: "block", fontSize: "0.8rem" }}>Razorpay Payment ID</span>
                <code>{selectedOrder.gatewayPaymentId || "None"}</code>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <span style={{ color: "#64748b", display: "block", fontSize: "0.8rem" }}>Created At</span>
                <span>{fmtDate(selectedOrder.createdAt)}</span>
              </div>
              {selectedOrder.errorMessage && (
                <div style={{ gridColumn: "span 2", background: "#fef2f2", border: "1px solid #fecaca", padding: 12, borderRadius: 6 }}>
                  <span style={{ color: "#991b1b", display: "block", fontSize: "0.8rem", fontWeight: 600 }}>Error / Failure Details</span>
                  <span style={{ color: "#b91c1c" }}>{selectedOrder.errorMessage}</span>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setSelectedOrder(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
