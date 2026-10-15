import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import { usePermissions } from "../../context/PermissionsContext";
import StatusBadge from "../../components/ui/StatusBadge";
import Icon from "../../components/ui/Icon";
import Loader from "../../components/ui/Loader";
import Toast from "../../components/ui/Toast";

function inr(n) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

export default function SupplierDetail() {
  const { id } = useParams();
  const { can } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    api
      .get(`/api/suppliers/${encodeURIComponent(id)}`)
      .then(setSupplier)
      .catch(() => setError("Could not load that supplier."));
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
        <PageHeader title="Supplier" crumbs={["Dashboard", "Suppliers", "Supplier List", id]} />
        <div className="loading-row">{error}</div>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div>
        <PageHeader title="Supplier" crumbs={["Dashboard", "Suppliers", "Supplier List", id]} />
        <div className="loading-row"><Loader /></div>
      </div>
    );
  }

  const orders = supplier.recentOrders || [];
  const invoices = supplier.recentInvoices || [];

  return (
    <div>
      <PageHeader
        title={supplier.name}
        crumbs={["Dashboard", "Suppliers", "Supplier List", supplier.id]}
        actions={
          <>
            <Link to="/suppliers" className="btn">
              ‹ Back to Supplier List
            </Link>
            {can("suppliers", "edit") && (
            <Link to={`/suppliers/${encodeURIComponent(supplier.id)}/edit`} className="btn btn-primary">
              <Icon name="edit" size={15} /> Edit
            </Link>
            )}
          </>
        }
      />

      <div className="list-card">
        <div className="section-title">Supplier Details</div>
        <div className="detail-grid">
          <div className="detail-field">
            <label>Supplier Code</label>
            <div className="detail-value">{supplier.id}</div>
          </div>
          <div className="detail-field">
            <label>Supplier Type</label>
            <div className="detail-value">{supplier.supplierType || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Contact Person</label>
            <div className="detail-value">{supplier.contactPerson || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Phone</label>
            <div className="detail-value">{supplier.phone || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Email</label>
            <div className="detail-value">{supplier.email || "—"}</div>
          </div>
          <div className="detail-field">
            <label>GST No.</label>
            <div className="detail-value">{supplier.gstNo || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Payment Terms</label>
            <div className="detail-value">{supplier.paymentTerms || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Status</label>
            <div className="detail-value"><StatusBadge status={supplier.status} /></div>
          </div>
          <div className="detail-field">
            <label>City</label>
            <div className="detail-value">{supplier.city || "—"}</div>
          </div>
          <div className="detail-field">
            <label>State</label>
            <div className="detail-value">{supplier.state || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Pincode</label>
            <div className="detail-value">{supplier.pincode || "—"}</div>
          </div>
          <div className="detail-field" style={{ gridColumn: "1 / -1" }}>
            <label>Address</label>
            <div className="detail-value">{supplier.address || "—"}</div>
          </div>
        </div>
      </div>

      <div className="list-card" style={{ marginTop: 20 }}>
        <div className="section-title">Summary</div>
        <div className="detail-grid">
          <div className="detail-field">
            <label>Items Supplied</label>
            <div className="detail-value">{supplier.itemsSupplied ?? 0}</div>
          </div>
          <div className="detail-field">
            <label>Outstanding</label>
            <div className="detail-value">{inr(supplier.outstanding)}</div>
          </div>
        </div>
      </div>

      <div className="list-card" style={{ marginTop: 20 }}>
        <div className="section-title">Recent Purchase Orders</div>
        <div className="items-table-wrap">
          <table className="items-table">
            <thead>
              <tr>
                <th>PO No.</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="items-empty">No purchase orders yet.</td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id}>
                    <td><Link to={`/purchase/orders/${encodeURIComponent(o.id)}`} className="cell-link">{o.id}</Link></td>
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
        <div className="section-title">Recent Purchase Invoices</div>
        <div className="items-table-wrap">
          <table className="items-table">
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={4} className="items-empty">No purchase invoices yet.</td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.id}</td>
                    <td>{inv.date || "—"}</td>
                    <td>{inr(inv.amount)}</td>
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
