import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import { usePermissions } from "../../context/PermissionsContext";
import StatusBadge from "../../components/ui/StatusBadge";
import Icon from "../../components/ui/Icon";
import AiReminderModal from "../../components/share/AiReminderModal";
import { useAuth } from "../../context/AuthContext";
import Loader from "../../components/ui/Loader";
import Toast from "../../components/ui/Toast";

function inr(n) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

export default function CustomerDetail() {
  const { id } = useParams();
  const { can } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [customer, setCustomer] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [showReminder, setShowReminder] = useState(false);

  useEffect(() => {
    api
      .get(`/api/customers/${encodeURIComponent(id)}`)
      .then(setCustomer)
      .catch(() => setError("Could not load that customer."));
  }, [id]);

  // Coming back here after saving an edit carries a toast in router state —
  // surface it once, then clear the state so a refresh doesn't repeat it.
  useEffect(() => {
    if (location.state && location.state.toast) {
      setToast(location.state.toast);
      setTimeout(() => setToast(""), 2500);
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  if (error) {
    return (
      <div>
        <PageHeader title="Customer" crumbs={["Dashboard", "Customers", "Customer List", id]} />
        <div className="loading-row">{error}</div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div>
        <PageHeader title="Customer" crumbs={["Dashboard", "Customers", "Customer List", id]} />
        <div className="loading-row"><Loader /></div>
      </div>
    );
  }

  const orders = customer.recentOrders || [];
  const invoices = customer.recentInvoices || [];

  return (
    <div>
      <PageHeader
        title={customer.name}
        crumbs={["Dashboard", "Customers", "Customer List", customer.id]}
        actions={
          <>
            <Link to="/customers" className="btn">
              ‹ Back to Customer List
            </Link>
            {user?.role === "Administrator" && Number(customer.outstanding) > 0 && (
              <button type="button" className="btn" onClick={() => setShowReminder(true)}>
                <Icon name="mail" size={15} /> AI Reminder
              </button>
            )}
            {can("customers", "edit") && (
            <Link to={`/customers/${encodeURIComponent(customer.id)}/edit`} className="btn btn-primary">
              <Icon name="edit" size={15} /> Edit
            </Link>
            )}
          </>
        }
      />

      {showReminder && (
        <AiReminderModal
          customer={customer.name}
          phone={customer.phone || ""}
          email={customer.email || ""}
          onClose={() => setShowReminder(false)}
        />
      )}

      <div className="list-card">
        <div className="section-title">Customer Details</div>
        <div className="detail-grid">
          <div className="detail-field">
            <label>Customer Code</label>
            <div className="detail-value">{customer.id}</div>
          </div>
          <div className="detail-field">
            <label>Customer Type</label>
            <div className="detail-value">{customer.customerType || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Contact Person</label>
            <div className="detail-value">{customer.contactPerson || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Mobile No.</label>
            <div className="detail-value">{customer.phone || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Email</label>
            <div className="detail-value">{customer.email || "—"}</div>
          </div>
          <div className="detail-field">
            <label>GST No.</label>
            <div className="detail-value">{customer.gstNo || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Payment Terms</label>
            <div className="detail-value">{customer.paymentTerms || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Status</label>
            <div className="detail-value"><StatusBadge status={customer.status} /></div>
          </div>
          <div className="detail-field">
            <label>City</label>
            <div className="detail-value">{customer.city || "—"}</div>
          </div>
          <div className="detail-field">
            <label>State</label>
            <div className="detail-value">{customer.state || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Pincode</label>
            <div className="detail-value">{customer.pincode || "—"}</div>
          </div>
          <div className="detail-field" style={{ gridColumn: "1 / -1" }}>
            <label>Address</label>
            <div className="detail-value">{customer.address || "—"}</div>
          </div>
        </div>
      </div>

      <div className="list-card" style={{ marginTop: 20 }}>
        <div className="section-title">Summary</div>
        <div className="detail-grid">
          <div className="detail-field">
            <label>Total Orders</label>
            <div className="detail-value">{customer.totalOrders ?? 0}</div>
          </div>
          <div className="detail-field">
            <label>Total Invoices</label>
            <div className="detail-value">{customer.totalInvoices ?? 0}</div>
          </div>
          <div className="detail-field">
            <label>Invoice Amount</label>
            <div className="detail-value">{inr(customer.invoicedAmount)}</div>
          </div>
          <div className="detail-field">
            <label>Outstanding</label>
            <div className="detail-value">{inr(customer.outstanding)}</div>
          </div>
        </div>
      </div>

      <div className="list-card" style={{ marginTop: 20 }}>
        <div className="section-title">Recent Sales Orders</div>
        <div className="items-table-wrap">
          <table className="items-table">
            <thead>
              <tr>
                <th>Order No.</th>
                <th>Date</th>
                <th>Order Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="items-empty">No sales orders yet.</td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id}>
                    <td><Link to={`/sales/orders/${encodeURIComponent(o.id)}/edit`} className="cell-link">{o.orderNo || o.id}</Link></td>
                    <td>{o.orderDate || "—"}</td>
                    <td>{inr(o.amount)}</td>
                    <td><StatusBadge status={o.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="list-card" style={{ marginTop: 20 }}>
        <div className="section-title">Recent Invoices</div>
        <div className="items-table-wrap">
          <table className="items-table">
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="items-empty">No invoices yet.</td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td><Link to={`/sales/invoices/${encodeURIComponent(inv.id)}`} className="cell-link">{inv.id}</Link></td>
                    <td>{inv.date || "—"}</td>
                    <td>{inr(inv.amount)}</td>
                    <td>{inr(inv.balance)}</td>
                    <td><StatusBadge status={inv.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast && <Toast message={toast} />}
    </div>
  );
}
