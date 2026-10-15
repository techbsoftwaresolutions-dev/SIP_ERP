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
import { formatPhone } from "../../utils/formatPhone";
import { buildSalesOrderFromQuotation } from "./quotationConvert";

const inr = (n) => `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function QuotationDetail() {
  const { id } = useParams();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState(null);
  const [fieldLabels, setFieldLabels] = useState({});
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api
      .get(`/api/sales/quotations/${encodeURIComponent(id)}`)
      .then(setQ)
      .catch(() => setError("Could not load that quotation."));
    api
      .get("/api/custom-fields?entity=quotation")
      .then((r) => setFieldLabels(Object.fromEntries((r.fields || []).map((f) => [f.key, f.label]))))
      .catch(() => {});
  }, [id]);

  // Coming back here after saving an edit carries a toast in router state —
  // show it once, then clear the state so a refresh doesn't repeat it.
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
      await api.delete(`/api/sales/quotations/${encodeURIComponent(q.id)}`);
      navigate("/sales/quotations", { state: { toast: "Quotation deleted." } });
    } catch (err) {
      setError(err.message || "Failed to delete.");
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  if (error) {
    return (
      <div>
        <PageHeader title="Quotation" crumbs={["Dashboard", "Sales", "Quotations", id]} />
        <div className="loading-row">{error}</div>
      </div>
    );
  }
  if (!q) {
    return (
      <div>
        <PageHeader title="Quotation" crumbs={["Dashboard", "Sales", "Quotations", id]} />
        <div className="loading-row"><Loader /></div>
      </div>
    );
  }

  const items = q.items || [];
  const discount = Number(q.discountAmount) || 0;
  const freight = Number(q.freightCharges) || 0;
  const customRows = Object.entries(q.customFields || {}).filter(([k, v]) => fieldLabels[k] && v !== "" && v != null);
  const field = (label, value, wide) => (
    <div className="detail-field" style={wide ? { gridColumn: "1 / -1" } : undefined}>
      <label>{label}</label>
      <div className="detail-value">{value || "—"}</div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title={`Quotation — ${q.id}`}
        crumbs={["Dashboard", "Sales", "Quotations", q.id]}
        actions={
          <>
            <Link to={`/sales/quotations/${encodeURIComponent(q.id)}/print`} className="btn">
              <Icon name="download" size={15} /> Preview &amp; Download
            </Link>
            {can("sales", "create") && !q.salesOrderId && (
              <button
                type="button"
                className="btn"
                onClick={() => navigate("/sales/orders/new", { state: { fromQuotation: buildSalesOrderFromQuotation(q) } })}
              >
                <Icon name="cart" size={15} /> Convert to Sales Order
              </button>
            )}
            {can("sales", "delete") && (
              <button type="button" className="btn" onClick={() => setConfirmingDelete(true)}>
                <Icon name="trash" size={15} /> Delete
              </button>
            )}
            {can("sales", "edit") && (
              <Link to={`/sales/quotations/${encodeURIComponent(q.id)}/edit`} className="btn btn-primary">
                <Icon name="edit" size={15} /> Edit
              </Link>
            )}
          </>
        }
      />

      <div className="list-card">
        <div className="section-title">Quotation Details</div>
        <div className="detail-grid">
          {field("Quotation No", q.id)}
          {field("Date", q.date)}
          {field("Valid Till", q.validTill)}
          <div className="detail-field">
            <label>Status</label>
            <div className="detail-value"><StatusBadge status={q.status} /></div>
          </div>
          {field("Customer", q.customer)}
          {field("Mobile No.", formatPhone(q.phone))}
          {field("Address", q.address)}
          {field("Place of Supply", q.placeOfSupply)}
          {field("Subject", q.subject)}
          {field("Customer Reference", q.referenceNo)}
          {field("Payment Terms", q.paymentTerms)}
          {field("Delivery Terms", q.deliveryTerms)}
          <div className="detail-field">
            <label>Sales Order</label>
            <div className="detail-value">
              {q.salesOrderId ? (
                <Link to={`/sales/orders/${encodeURIComponent(q.salesOrderId)}`} className="cell-link">{q.salesOrderId}</Link>
              ) : (
                "Not converted"
              )}
            </div>
          </div>
          {customRows.map(([k, v]) => field(fieldLabels[k], String(v)))}
        </div>

        <div className="section-title" style={{ marginTop: 26 }}>Items</div>
        <div className="items-table-wrap">
          <table className="items-table">
            <thead>
              <tr>
                <th>#</th>
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
                <tr><td colSpan={8} className="items-empty">No items on this quotation.</td></tr>
              ) : (
                items.map((it, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{it.product}</td>
                    <td>{it.hsnCode || "—"}</td>
                    <td>{it.quantity}</td>
                    <td>{it.unit || "—"}</td>
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
          <div className="txn-totals-row"><span>Sub Total</span><span>{inr(q.subTotal)}</span></div>
          {discount > 0 && (
            <div className="txn-totals-row">
              <span>Discount{q.discountType === "percent" ? ` (${Number(q.discountValue) || 0}%)` : ""}</span>
              <span>− {inr(discount)}</span>
            </div>
          )}
          <div className="txn-totals-row"><span>Tax</span><span>{inr(q.taxTotal)}</span></div>
          {freight > 0 && <div className="txn-totals-row"><span>Freight / Other</span><span>{inr(freight)}</span></div>}
          <div className="txn-totals-row grand"><span>Total Amount</span><span>{inr(q.amount)}</span></div>
        </div>

        {q.notes && (
          <>
            <div className="section-title" style={{ marginTop: 26 }}>Terms &amp; Conditions</div>
            <div className="detail-value" style={{ whiteSpace: "pre-line" }}>{q.notes}</div>
          </>
        )}
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete quotation"
          message={`Delete ${q.id}? This cannot be undone.`}
          confirming={deleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
