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

export default function DeliveryChallanDetail() {
  const { id } = useParams();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [challan, setChallan] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api
      .get(`/api/sales/delivery-challans/${encodeURIComponent(id)}`)
      .then(setChallan)
      .catch(() => setError("Could not load that delivery challan."));
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
      await api.delete(`/api/sales/delivery-challans/${encodeURIComponent(challan.id)}`);
      navigate("/sales/delivery-challan", { state: { toast: "Delivery challan deleted." } });
    } catch (err) {
      setError(err.message || "Failed to delete.");
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  if (error) {
    return (
      <div>
        <PageHeader title="Delivery Challan" crumbs={["Dashboard", "Sales", "Delivery Challan", id]} />
        <div className="loading-row">{error}</div>
      </div>
    );
  }

  if (!challan) {
    return (
      <div>
        <PageHeader title="Delivery Challan" crumbs={["Dashboard", "Sales", "Delivery Challan", id]} />
        <div className="loading-row"><Loader /></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Delivery Challan — ${challan.id}`}
        crumbs={["Dashboard", "Sales", "Delivery Challan", challan.id]}
        actions={
          <>
            <Link to={`/sales/delivery-challans/${encodeURIComponent(challan.id)}/print`} className="btn">
              <Icon name="download" size={15} /> Download
            </Link>
            {can("sales", "delete") && (
            <button type="button" className="btn" onClick={() => setConfirmingDelete(true)}>
              <Icon name="trash" size={15} /> Delete
            </button>
            )}
            {can("sales", "edit") && (
            <Link to={`/sales/delivery-challan/${encodeURIComponent(challan.id)}/edit`} className="btn btn-primary">
              <Icon name="edit" size={15} /> Edit
            </Link>
            )}
          </>
        }
      />

      <div className="list-card">
        <div className="section-title">Delivery Challan Details</div>
        <div className="detail-grid">
          <div className="detail-field">
            <label>DC Number</label>
            <div className="detail-value">{challan.id}</div>
          </div>
          <div className="detail-field">
            <label>DC Date</label>
            <div className="detail-value">{challan.date || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Sales Order No</label>
            <div className="detail-value">
              {challan.salesOrder && challan.salesOrder !== "—" ? (
                <Link to={`/sales/orders/${encodeURIComponent(challan.salesOrder)}`} className="cell-link">{challan.salesOrder}</Link>
              ) : (
                "—"
              )}
            </div>
          </div>
          <div className="detail-field">
            <label>Customer</label>
            <div className="detail-value">{challan.customer || "—"}</div>
          </div>
          <div className="detail-field" style={{ gridColumn: "1 / -1" }}>
            <label>Products</label>
            <div className="detail-value">{challan.product || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Dispatched Qty</label>
            <div className="detail-value">
              {(Number(challan.dispatchedQty) || 0).toLocaleString("en-IN")} {challan.unit || "Nos"}
            </div>
          </div>
          <div className="detail-field">
            <label>Items</label>
            <div className="detail-value">{Number(challan.items) || 0}</div>
          </div>
          <div className="detail-field">
            <label>Warehouse</label>
            <div className="detail-value">{challan.warehouse || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Transporter</label>
            <div className="detail-value">{challan.transporter || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Vehicle No.</label>
            <div className="detail-value">{challan.vehicleNo || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Delivery Status</label>
            <div className="detail-value"><StatusBadge status={challan.status} /></div>
          </div>
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete delivery challan"
          message={`Delete ${challan.id}? This cannot be undone.`}
          confirming={deleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
