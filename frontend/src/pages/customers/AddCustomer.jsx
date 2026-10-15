import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import AddRecordForm from "../../components/forms/AddRecordForm";
import { CUSTOMER_FIELDS } from "./customerFields";
import Loader from "../../components/ui/Loader";
import { useCustomFields, packCustomFields, unpackCustomFields } from "../../hooks/useCustomFields";

// One page for both Add and Edit — which mode depends only on whether a
// route param `:id` is present (`/customers/new` vs. `/customers/:id/edit`),
// so the two can never drift apart.
export default function AddCustomer() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [initialValues, setInitialValues] = useState(isEdit ? null : {});
  const [loadError, setLoadError] = useState("");
  const { fields: customFields } = useCustomFields("customer");

  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/api/customers/${encodeURIComponent(id)}`)
      .then((r) => setInitialValues(unpackCustomFields(r)))
      .catch(() => setLoadError("Could not load that customer."));
  }, [id, isEdit]);

  const handleSubmit = async (values) => {
    const payload = packCustomFields(values);
    if (isEdit) {
      await api.put(`/api/customers/${encodeURIComponent(id)}`, payload);
      navigate(`/customers/${encodeURIComponent(id)}`, { state: { toast: "Customer updated successfully." } });
    } else {
      await api.post("/api/customers", payload);
      navigate("/customers", { state: { toast: "Customer added successfully." } });
    }
  };

  const title = isEdit ? `Edit Customer — ${id}` : "Add Customer";
  const crumbs = isEdit
    ? ["Dashboard", "Customers", "Customer List", id, "Edit"]
    : ["Dashboard", "Customers", "Customer List", "Add Customer"];

  if (isEdit && !initialValues) {
    return (
      <div>
        <PageHeader title="Edit Customer" crumbs={["Dashboard", "Customers", "Customer List", "Edit Customer"]} />
        <div className="loading-row">{loadError ? loadError : <Loader />}</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={title} crumbs={crumbs} />
      <div className="list-card add-page-card">
        <div className="section-title">Customer Details</div>
        <AddRecordForm
          fields={[...CUSTOMER_FIELDS, ...customFields]}
          initialValues={isEdit ? initialValues : undefined}
          onSubmit={handleSubmit}
          onCancel={() => navigate(isEdit ? `/customers/${id}` : "/customers")}
          submitLabel={isEdit ? "Save Changes" : "Add Customer"}
        />
      </div>
    </div>
  );
}
