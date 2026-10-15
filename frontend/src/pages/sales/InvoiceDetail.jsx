import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import { usePermissions } from "../../context/PermissionsContext";
import StatusBadge from "../../components/ui/StatusBadge";
import Icon from "../../components/ui/Icon";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { inr } from "./invoiceFields";
import { formatPhone } from "../../utils/formatPhone";
import Loader from "../../components/ui/Loader";
import Toast from "../../components/ui/Toast";

export default function InvoiceDetail() {
  const { id } = useParams();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deciding, setDeciding] = useState(false);

  // Approving or refusing an invoice the engine held. The server checks the
  // acting role against the rules that actually hold THIS invoice, so a
  // refusal here is authoritative rather than a UI courtesy.
  const decide = async (action) => {
    if (deciding) return;
    setDeciding(true);
    try {
      const updated = await api.post(`/api/sales/invoices/${encodeURIComponent(id)}/${action}`, {});
      setInvoice(updated);
      setToast(action === "approve" ? "Invoice approved." : "Invoice rejected.");
      setTimeout(() => setToast(""), 2500);
    } catch (err) {
      window.alert(err.message || "Could not record that decision.");
    } finally {
      setDeciding(false);
    }
  };

  useEffect(() => {
    api
      .get(`/api/sales/invoices/${encodeURIComponent(id)}`)
      .then(setInvoice)
      .catch(() => setError("Could not load that invoice."));
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
      await api.delete(`/api/sales/invoices/${encodeURIComponent(invoice.id)}`);
      navigate("/sales/invoices", { state: { toast: "Invoice deleted." } });
    } catch (err) {
      setError(err.message || "Failed to delete.");
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  if (error) {
    return (
      <div>
        <PageHeader title="Invoice" crumbs={["Dashboard", "Sales", "Invoices", id]} />
        <div className="loading-row">{error}</div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div>
        <PageHeader title="Invoice" crumbs={["Dashboard", "Sales", "Invoices", id]} />
        <div className="loading-row"><Loader /></div>
      </div>
    );
  }

  const items = invoice.items || [];
  const subTotal = items.reduce((a, i) => a + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const grandTotal = items.reduce((a, i) => a + (i.amount || 0), 0) || invoice.amount || 0;
  const taxTotal = grandTotal - subTotal;

  return (
    <div>
      <PageHeader
        title={`Invoice — ${invoice.id}`}
        crumbs={["Dashboard", "Sales", "Invoices", invoice.id]}
        actions={
          <>
            <Link to={`/sales/invoices/${encodeURIComponent(invoice.id)}/print`} className="btn">
              <Icon name="download" size={15} /> Download
            </Link>
            {can("sales", "delete") && (
            <button type="button" className="btn" onClick={() => setConfirmingDelete(true)}>
              <Icon name="trash" size={15} /> Delete
            </button>
            )}
            {can("sales", "edit") && (
            <Link to={`/sales/invoices/${encodeURIComponent(invoice.id)}/edit`} className="btn btn-primary">
              <Icon name="edit" size={15} /> Edit
            </Link>
            )}
          </>
        }
      />

      {invoice.approvalStatus && invoice.approvalStatus !== "not_required" && (
        <div className={`approval-banner is-${invoice.approvalStatus}`}>
          <Icon
            name={
              invoice.approvalStatus === "approved"
                ? "checkCircle"
                : invoice.approvalStatus === "rejected"
                  ? "xCircle"
                  : "alertCircle"
            }
            size={18}
          />
          <span className="approval-banner-body">
            <strong>
              {invoice.approvalStatus === "pending"
                ? "Waiting for approval"
                : invoice.approvalStatus === "approved"
                  ? "Approved"
                  : "Rejected"}
            </strong>
            <em>
              {invoice.approvalStatus === "pending"
                ? invoice.approvalReason || "This invoice needs signing off."
                : `${invoice.approvedBy || "Someone"}${invoice.approvalNote ? ` — ${invoice.approvalNote}` : ""}`}
            </em>
          </span>
          {invoice.approvalStatus === "pending" && (
            <span className="approval-banner-actions">
              <button type="button" className="btn" disabled={deciding} onClick={() => decide("reject")}>
                Reject
              </button>
              <button type="button" className="btn btn-primary" disabled={deciding} onClick={() => decide("approve")}>
                {deciding ? "Saving…" : "Approve"}
              </button>
            </span>
          )}
        </div>
      )}

      <div className="list-card">
        <div className="section-title">Invoice Details</div>
        <div className="detail-grid">
          <div className="detail-field">
            <label>Customer</label>
            <div className="detail-value">{invoice.customer || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Billing Address</label>
            <div className="detail-value">{invoice.address || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Mobile No.</label>
            <div className="detail-value">{formatPhone(invoice.phone) || "—"}</div>
          </div>
          <div className="detail-field" style={{ gridColumn: "1 / -1" }}>
            <label>Shipping Address</label>
            <div className="detail-value">
              {invoice.shippingSameAsBilling === false && invoice.shippingAddress
                ? invoice.shippingAddress
                : `${invoice.address || "—"} (same as billing)`}
            </div>
          </div>
          <div className="detail-field">
            <label>Invoice Date</label>
            <div className="detail-value">{invoice.date || "—"}</div>
          </div>
          <div className="detail-field">
            <label>PO Number</label>
            <div className="detail-value">{invoice.poNumber || "—"}</div>
          </div>
          <div className="detail-field">
            <label>PO Date</label>
            <div className="detail-value">{invoice.poDate || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Payment Mode</label>
            <div className="detail-value">
              {invoice.paymentMode || "—"}
              {invoice.paymentReference && <span className="detail-sub"> · {invoice.paymentReference}</span>}
            </div>
          </div>
          <div className="detail-field">
            <label>Transport Name</label>
            <div className="detail-value">{invoice.transportName || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Vehicle Number</label>
            <div className="detail-value">{invoice.vehicleNo || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Delivery Date</label>
            <div className="detail-value">{invoice.deliveryDate || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Delivery Location</label>
            <div className="detail-value">{invoice.deliveryLocation || "—"}</div>
          </div>
          <div className="detail-field">
            <label>E-Way Bill No.</label>
            <div className="detail-value">{invoice.eWayBillNo || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Due Date</label>
            <div className="detail-value">{invoice.dueDate || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Status</label>
            <div className="detail-value"><StatusBadge status={invoice.status} /></div>
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
          <div className="txn-totals-row grand"><span>Total Amount</span><span>{inr(grandTotal)}</span></div>
          <div className="txn-totals-row"><span>Paid Amount</span><span>{inr(invoice.paidAmount)}</span></div>
          <div className="txn-totals-row grand"><span>Balance Due</span><span>{inr(invoice.balance)}</span></div>
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete invoice"
          message={`Delete ${invoice.id}? This cannot be undone.`}
          confirming={deleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
