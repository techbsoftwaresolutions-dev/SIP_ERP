import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import AddRecordForm from "../../components/forms/AddRecordForm";
import { SUPPLIER_FIELDS } from "./supplierFields";
import Loader from "../../components/ui/Loader";
import { useCustomFields, packCustomFields, unpackCustomFields } from "../../hooks/useCustomFields";

// One page for both Add and Edit — which mode depends only on whether a
// route param `:id` is present (`/suppliers/new` vs. `/suppliers/:id/edit`),
// so the two can never drift apart.
export default function AddSupplier() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [initialValues, setInitialValues] = useState(isEdit ? null : {});
  const [loadError, setLoadError] = useState("");
  const { fields: customFields } = useCustomFields("supplier");

  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/api/suppliers/${encodeURIComponent(id)}`)
      .then((r) => setInitialValues(unpackCustomFields(r)))
      .catch(() => setLoadError("Could not load that supplier."));
  }, [id, isEdit]);

  const handleSubmit = async (values) => {
    const payload = packCustomFields(values);
    if (isEdit) {
      await api.put(`/api/suppliers/${encodeURIComponent(id)}`, payload);
      navigate(`/suppliers/${encodeURIComponent(id)}`, { state: { toast: "Supplier updated successfully." } });
    } else {
      await api.post("/api/suppliers", payload);
      navigate("/suppliers", { state: { toast: "Supplier added successfully." } });
    }
  };

  const title = isEdit ? `Edit Supplier — ${id}` : "Add Supplier";
  const crumbs = isEdit
    ? ["Dashboard", "Suppliers", "Supplier List", id, "Edit"]
    : ["Dashboard", "Suppliers", "Supplier List", "Add Supplier"];

  if (isEdit && !initialValues) {
    return (
      <div>
        <PageHeader title="Edit Supplier" crumbs={["Dashboard", "Suppliers", "Supplier List", "Edit Supplier"]} />
        <div className="loading-row">{loadError ? loadError : <Loader />}</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={title} crumbs={crumbs} />
      <div className="list-card add-page-card">
        <div className="section-title">Supplier Details</div>
        <AddRecordForm
          fields={[...SUPPLIER_FIELDS, ...customFields]}
          initialValues={isEdit ? initialValues : undefined}
          onSubmit={handleSubmit}
          onCancel={() => navigate(isEdit ? `/suppliers/${id}` : "/suppliers")}
          submitLabel={isEdit ? "Save Changes" : "Add Supplier"}
        />
      </div>
    </div>
  );
}
