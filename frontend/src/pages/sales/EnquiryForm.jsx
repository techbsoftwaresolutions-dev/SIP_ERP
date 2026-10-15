import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import AddRecordForm from "../../components/forms/AddRecordForm";
import { buildEnquiryFields, enquiryItemsFor } from "./enquiryFields";
import Loader from "../../components/ui/Loader";
import { useCustomFields, packCustomFields, unpackCustomFields } from "../../hooks/useCustomFields";

// One page for both Add and Edit — which mode depends only on whether a
// route param `:id` is present (`/sales/enquiries/new` vs.
// `/sales/enquiries/:id/edit`), so the two can never drift apart.
export default function EnquiryForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [initialValues, setInitialValues] = useState(isEdit ? null : {});
  const [loadError, setLoadError] = useState("");
  const [catalogItems, setCatalogItems] = useState([]);
  const { fields: customFields } = useCustomFields("enquiry");

  useEffect(() => {
    api.swr("/api/items?page=1&pageSize=200", (r) => setCatalogItems(r.data || []));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/api/sales/enquiries/${encodeURIComponent(id)}`)
      .then((r) => setInitialValues({ ...unpackCustomFields(r), items: enquiryItemsFor(r) }))
      .catch(() => setLoadError("Could not load that enquiry."));
  }, [id, isEdit]);

  const handleSubmit = async (values) => {
    const payload = packCustomFields(values);
    // Rows left blank are dropped; the server keeps the flat product / qty /
    // unit columns in step with what remains.
    payload.items = (values.items || []).filter((r) => String(r.product || "").trim());
    if (isEdit) {
      await api.put(`/api/sales/enquiries/${encodeURIComponent(id)}`, payload);
    } else {
      await api.post("/api/sales/enquiries", payload);
    }
    navigate("/sales/enquiries", { state: { toast: isEdit ? "Enquiry updated." : "Enquiry logged." } });
  };

  const title = isEdit ? `Edit Enquiry — ${id}` : "Add Enquiry";
  const crumbs = ["Dashboard", "Sales", "Enquiries", title];

  if (isEdit && !initialValues) {
    return (
      <div>
        <PageHeader title="Edit Enquiry" crumbs={["Dashboard", "Sales", "Enquiries", "Edit Enquiry"]} />
        <div className="loading-row">{loadError ? loadError : <Loader />}</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={title} crumbs={crumbs} />
      <div className="list-card add-page-card">
        <div className="section-title">Enquiry Details</div>
        <AddRecordForm
          fields={[...buildEnquiryFields(catalogItems), ...customFields]}
          initialValues={isEdit ? initialValues : undefined}
          onSubmit={handleSubmit}
          onCancel={() => navigate("/sales/enquiries")}
          submitLabel={isEdit ? "Save Changes" : "Add Enquiry"}
        />
      </div>
    </div>
  );
}
