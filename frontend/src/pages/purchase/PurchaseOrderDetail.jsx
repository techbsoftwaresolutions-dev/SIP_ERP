import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import { usePermissions } from "../../context/PermissionsContext";
import StatusBadge from "../../components/ui/StatusBadge";
import Icon from "../../components/ui/Icon";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { inr } from "./PurchaseOrderForm";
import Loader from "../../components/ui/Loader";
import Toast from "../../components/ui/Toast";

export default function PurchaseOrderDetail() {
  const { id } = useParams();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [po, setPo] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api
      .get(`/api/purchase-orders/${encodeURIComponent(id)}`)
      .then(setPo)
      .catch(() => setError("Could not load that purchase order."));
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
      await api.delete(`/api/purchase-orders/${encodeURIComponent(po.id)}`);
      navigate("/purchase/orders", { state: { toast: "Purchase order deleted." } });
    } catch (err) {
      setError(err.message || "Failed to delete.");
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  if (error) {
    return (
      <div>
        <PageHeader title="Purchase Order" crumbs={["Dashboard", "Purchase", "Purchase Orders", id]} />
        <div className="loading-row">{error}</div>
      </div>
    );
  }

  if (!po) {
    return (
      <div>
        <PageHeader title="Purchase Order" crumbs={["Dashboard", "Purchase", "Purchase Orders", id]} />
        <div className="loading-row"><Loader /></div>
      </div>
    );
  }

  const items = po.items || [];
  const subTotal = items.reduce((a, i) => a + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const grandTotal = items.reduce((a, i) => a + (i.amount || 0), 0);
  const taxTotal = grandTotal - subTotal;

  return (
    <div>
      <PageHeader
        title={`Purchase Order — ${po.id}`}
        crumbs={["Dashboard", "Purchase", "Purchase Orders", po.id]}
        actions={
          <>
            <Link to={`/purchase/orders/${encodeURIComponent(po.id)}/print`} className="btn">
              <Icon name="download" size={15} /> Download
            </Link>
            {can("purchase", "delete") && (
            <button type="button" className="btn" onClick={() => setConfirmingDelete(true)}>
              <Icon name="trash" size={15} /> Delete
            </button>
            )}
            {can("purchase", "edit") && (
            <Link to={`/purchase/orders/${encodeURIComponent(po.id)}/edit`} className="btn btn-primary">
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
            <label>Supplier</label>
            <div className="detail-value">{po.supplier || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Purchase Order Date</label>
            <div className="detail-value">{po.orderDate || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Delivery</label>
            <div className="detail-value">{po.expectedDate || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Payment Terms</label>
            <div className="detail-value">{po.paymentTerms || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Status</label>
            <div className="detail-value"><StatusBadge status={po.status} /></div>
          </div>
          <div className="detail-field">
            <label>GRN Status</label>
            <div className="detail-value"><StatusBadge status={po.grnStatus || "Not Received"} /></div>
          </div>
        </div>

        <div className="section-title" style={{ marginTop: 26 }}>Items</div>
        <div className="items-table-wrap">
          <table className="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>HSN/SAC</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Unit Price</th>
                <th>Tax (%)</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="items-empty">No items.</td>
                </tr>
              ) : (
                items.map((it, idx) => (
                  <tr key={idx}>
                    <td>{it.product || "—"}</td>
                    <td>{it.hsnCode || "—"}</td>
                    <td>{it.quantity}</td>
                    <td>{it.unit}</td>
                    <td>{inr(it.unitPrice)}</td>
                    <td>{it.taxPercent || 0}%</td>
                    <td>{inr(it.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="txn-totals" style={{ marginTop: 18 }}>
          <div className="txn-totals-row"><span>Sub Total</span><span>{inr(subTotal)}</span></div>
          <div className="txn-totals-row"><span>Tax</span><span>{inr(taxTotal)}</span></div>
          <div className="txn-totals-row grand"><span>Total</span><span>{inr(grandTotal)}</span></div>
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete purchase order"
          message={`Delete ${po.id}? This cannot be undone.`}
          confirming={deleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
