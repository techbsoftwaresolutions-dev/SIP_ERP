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

const qty = (n) => (Number(n) || 0).toLocaleString("en-IN");

export default function GoodsReceiptDetail() {
  const { id } = useParams();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [gr, setGr] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api
      .get(`/api/purchase/goods-receipts/${encodeURIComponent(id)}`)
      .then(setGr)
      .catch(() => setError("Could not load that goods receipt."));
  }, [id]);

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
      await api.delete(`/api/purchase/goods-receipts/${encodeURIComponent(gr.id)}`);
      navigate("/purchase/goods-receipt", { state: { toast: "Goods receipt deleted." } });
    } catch (err) {
      setError(err.message || "Failed to delete.");
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  if (error) {
    return (
      <div>
        <PageHeader title="Goods Receipt" crumbs={["Dashboard", "Purchase", "Goods Receipt", id]} />
        <div className="loading-row">{error}</div>
      </div>
    );
  }

  if (!gr) {
    return (
      <div>
        <PageHeader title="Goods Receipt" crumbs={["Dashboard", "Purchase", "Goods Receipt", id]} />
        <div className="loading-row"><Loader /></div>
      </div>
    );
  }

  const items = Array.isArray(gr.items) ? gr.items : [];

  return (
    <div>
      <PageHeader
        title={`Goods Receipt — ${gr.id}`}
        crumbs={["Dashboard", "Purchase", "Goods Receipt", gr.id]}
        actions={
          <>
            <button type="button" className="btn" onClick={() => navigate("/purchase/goods-receipt")}>
              <Icon name="arrowLeft" size={15} /> Back
            </button>
            {can("purchase", "delete") && (
            <button type="button" className="btn" onClick={() => setConfirmingDelete(true)}>
              <Icon name="trash" size={15} /> Delete
            </button>
            )}
          </>
        }
      />

      <div className="list-card">
        <div className="section-title">Goods Receipt Details</div>
        <div className="detail-grid">
          <div className="detail-field">
            <label>GRN Number</label>
            <div className="detail-value">{gr.id}</div>
          </div>
          <div className="detail-field">
            <label>GRN Date</label>
            <div className="detail-value">{gr.date || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Purchase Order No</label>
            <div className="detail-value">
              {gr.poNumber && gr.poNumber !== "—" ? (
                <Link to={`/purchase/orders/${encodeURIComponent(gr.poNumber)}`} className="cell-link">{gr.poNumber}</Link>
              ) : (
                "—"
              )}
            </div>
          </div>
          <div className="detail-field">
            <label>Invoice No</label>
            <div className="detail-value">{gr.invoiceNo || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Invoice Date</label>
            <div className="detail-value">{gr.invoiceDate || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Supplier</label>
            <div className="detail-value">{gr.supplier || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Warehouse</label>
            <div className="detail-value">{gr.warehouse || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Inspection</label>
            <div className="detail-value">{gr.inspection || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Status</label>
            <div className="detail-value"><StatusBadge status={gr.status} /></div>
          </div>
        </div>

        <div className="section-title" style={{ marginTop: 26 }}>Items</div>
        <div className="items-table-wrap">
          <table className="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>PO Qty</th>
                <th>Received</th>
                <th>Rejected</th>
                <th>Accepted</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="items-empty">No items.</td>
                </tr>
              ) : (
                items.map((it, idx) => {
                  const accepted = (Number(it.receivedQty) || 0) - (Number(it.rejectedQty) || 0);
                  return (
                    <tr key={idx}>
                      <td>{it.product || "—"}</td>
                      <td>{qty(it.poQty)}</td>
                      <td>{qty(it.receivedQty)}</td>
                      <td>{qty(it.rejectedQty)}</td>
                      <td>{qty(accepted)}</td>
                      <td>{it.unit || "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete goods receipt"
          message={`Delete ${gr.id}? This cannot be undone.`}
          confirming={deleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
