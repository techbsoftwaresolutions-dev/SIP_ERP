import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import { usePermissions } from "../../context/PermissionsContext";
import StatusBadge from "../../components/ui/StatusBadge";
import Icon from "../../components/ui/Icon";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Loader from "../../components/ui/Loader";
import Toast from "../../components/ui/Toast";

function inr(n) {
  return `₹${(Number(n) || 0).toLocaleString("en-IN")}`;
}

export default function SalesOrderDetail() {
  const { id } = useParams();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api
      .get(`/api/sales/orders/${encodeURIComponent(id)}`)
      .then(setOrder)
      .catch(() => setError("Could not load that sales order."));
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

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/api/sales/orders/${encodeURIComponent(order.id)}`);
      navigate("/sales/orders", { state: { toast: "Sales order deleted." } });
    } catch (err) {
      setError(err.message || "Failed to delete.");
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  if (error) {
    return (
      <div>
        <PageHeader title="Sales Order" crumbs={["Dashboard", "Sales", "Sales Orders", id]} />
        <div className="loading-row">{error}</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div>
        <PageHeader title="Sales Order" crumbs={["Dashboard", "Sales", "Sales Orders", id]} />
        <div className="loading-row"><Loader /></div>
      </div>
    );
  }

  const lineItems = Array.isArray(order.lineItems) ? order.lineItems : [];
  const lineTotal = lineItems.reduce(
    (a, i) => a + (Number(i.orderQty) || 0) * (Number(i.unitPrice) || 0),
    0
  );

  return (
    <div>
      <PageHeader
        title={`Sales Order — ${order.orderNo || order.id}`}
        crumbs={["Dashboard", "Sales", "Sales Orders", order.orderNo || order.id]}
        actions={
          <>
            {can("sales", "delete") && (
            <button type="button" className="btn" onClick={() => setConfirmingDelete(true)}>
              <Icon name="trash" size={15} /> Delete
            </button>
            )}
            {can("sales", "edit") && (
            <Link to={`/sales/orders/${encodeURIComponent(order.id)}/edit`} className="btn btn-primary">
              <Icon name="edit" size={15} /> Edit
            </Link>
            )}
          </>
        }
      />

      <div className="list-card">
        <div className="section-title">Order Details</div>
        <div className="detail-grid">
          <div className="detail-field">
            <label>Customer</label>
            <div className="detail-value">{order.customer || "—"}</div>
          </div>
          <div className="detail-field">
            <label>City</label>
            <div className="detail-value">{order.city || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Order Date</label>
            <div className="detail-value">{order.orderDate || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Purchase Order No</label>
            <div className="detail-value">{order.poNumber || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Purchase Order Date</label>
            <div className="detail-value">{order.poDate || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Required Date</label>
            <div className="detail-value">{order.requiredDate || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Order Value</label>
            <div className="detail-value">{inr(order.amount)}</div>
          </div>
          <div className="detail-field">
            <label>Delivery Status</label>
            <div className="detail-value"><StatusBadge status={order.deliveryStatus || "Not Dispatched"} /></div>
          </div>
          <div className="detail-field">
            <label>Payment Status</label>
            <div className="detail-value"><StatusBadge status={order.paymentStatus || "Pending"} /></div>
          </div>
          <div className="detail-field">
            <label>SO Status</label>
            <div className="detail-value"><StatusBadge status={order.status} /></div>
          </div>
          <div className="detail-field">
            <label>Invoice</label>
            <div className="detail-value">
              {order.invoiceId ? (
                <Link to={`/sales/invoices/${encodeURIComponent(order.invoiceId)}`} className="cell-link">{order.invoiceId}</Link>
              ) : (
                "Not converted"
              )}
            </div>
          </div>
        </div>

        <div className="section-title" style={{ marginTop: 26 }}>Items</div>
        <div className="items-table-wrap">
          <table className="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Order Qty</th>
                <th>Dispatch</th>
                <th>Pending</th>
                <th>Unit</th>
                <th>Unit Price</th>
                <th>Required Date</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="items-empty">No items.</td>
                </tr>
              ) : (
                lineItems.map((it, idx) => (
                  <tr key={idx}>
                    <td>{it.product || "—"}</td>
                    <td>{Number(it.orderQty) || 0}</td>
                    <td>{Number(it.dispatchQty) || 0}</td>
                    <td>{Number(it.pendingQty) || 0}</td>
                    <td>{it.unit || "—"}</td>
                    <td>{inr(it.unitPrice)}</td>
                    <td>{it.requiredDate || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {lineItems.length > 0 && (
          <div className="txn-totals" style={{ marginTop: 18 }}>
            <div className="txn-totals-row grand"><span>Line Items Total</span><span>{inr(lineTotal)}</span></div>
          </div>
        )}
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete sales order"
          message={`Delete ${order.orderNo || order.id}? This cannot be undone.`}
          confirming={deleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
