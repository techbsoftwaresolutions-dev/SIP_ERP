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
import { enquiryItemsFor } from "./enquiryFields";

export default function EnquiryDetail() {
  const { id } = useParams();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [enquiry, setEnquiry] = useState(null);
  const [fieldLabels, setFieldLabels] = useState({});
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api
      .get(`/api/sales/enquiries/${encodeURIComponent(id)}`)
      .then(setEnquiry)
      .catch(() => setError("Could not load that enquiry."));
    api
      .get("/api/custom-fields?entity=enquiry")
      .then((r) => setFieldLabels(Object.fromEntries((r.fields || []).map((f) => [f.key, f.label]))))
      .catch(() => {});
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
      await api.delete(`/api/sales/enquiries/${encodeURIComponent(enquiry.id)}`);
      navigate("/sales/enquiries", { state: { toast: "Enquiry deleted." } });
    } catch (err) {
      setError(err.message || "Failed to delete.");
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  if (error) {
    return (
      <div>
        <PageHeader title="Enquiry" crumbs={["Dashboard", "Sales", "Enquiries", id]} />
        <div className="loading-row">{error}</div>
      </div>
    );
  }
  if (!enquiry) {
    return (
      <div>
        <PageHeader title="Enquiry" crumbs={["Dashboard", "Sales", "Enquiries", id]} />
        <div className="loading-row"><Loader /></div>
      </div>
    );
  }

  const items = enquiryItemsFor(enquiry);
  const customRows = Object.entries(enquiry.customFields || {}).filter(([k, v]) => fieldLabels[k] && v !== "" && v != null);
  const field = (label, value) => (
    <div className="detail-field">
      <label>{label}</label>
      <div className="detail-value">{value || "—"}</div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title={`Enquiry — ${enquiry.id}`}
        crumbs={["Dashboard", "Sales", "Enquiries", enquiry.id]}
        actions={
          <>
            <Link to={`/sales/enquiries/${encodeURIComponent(enquiry.id)}/print`} className="btn">
              <Icon name="download" size={15} /> Preview &amp; Download
            </Link>
            {can("sales", "delete") && (
              <button type="button" className="btn" onClick={() => setConfirmingDelete(true)}>
                <Icon name="trash" size={15} /> Delete
              </button>
            )}
            {can("sales", "edit") && (
              <Link to={`/sales/enquiries/${encodeURIComponent(enquiry.id)}/edit`} className="btn btn-primary">
                <Icon name="edit" size={15} /> Edit
              </Link>
            )}
          </>
        }
      />

      <div className="list-card">
        <div className="section-title">Enquiry Details</div>
        <div className="detail-grid">
          {field("Enquiry No", enquiry.id)}
          {field("Enquiry Date", enquiry.date)}
          {field("Required Date", enquiry.requiredDate)}
          {field("Customer", enquiry.customer)}
          {field("Contact Person", enquiry.contactPerson)}
          {field("Source", enquiry.source)}
          {field("Priority", enquiry.priority)}
          {field("Est. Value", enquiry.estValue ? `₹${Number(enquiry.estValue).toLocaleString("en-IN")}` : "")}
          <div className="detail-field">
            <label>Status</label>
            <div className="detail-value"><StatusBadge status={enquiry.status} /></div>
          </div>
          {customRows.map(([k, v]) => field(fieldLabels[k], String(v)))}
        </div>

        <div className="section-title" style={{ marginTop: 26 }}>Products</div>
        <div className="items-table-wrap">
          <table className="items-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={5} className="items-empty">No products listed on this enquiry.</td></tr>
              ) : (
                items.map((it, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{it.product}</td>
                    <td>{Number(it.qty) || 0}</td>
                    <td>{it.unit || "—"}</td>
                    <td>{it.remarks || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete enquiry"
          message={`Delete ${enquiry.id}? This cannot be undone.`}
          confirming={deleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
