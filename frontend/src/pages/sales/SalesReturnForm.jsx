import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import AddRecordForm from "../../components/forms/AddRecordForm";
import { buildSalesReturnFields, useSalesReturnLookups } from "./salesReturnFields";
import Loader from "../../components/ui/Loader";
import { useCustomFields, packCustomFields, unpackCustomFields } from "../../hooks/useCustomFields";

// One page for both Add and Edit — which mode depends only on whether a
// route param `:id` is present (`/sales/returns/new` vs.
// `/sales/returns/:id/edit`), so the two can never drift apart.
export default function SalesReturnForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { customers, invoices, salesOrders, challans } = useSalesReturnLookups();
  const [initialValues, setInitialValues] = useState(isEdit ? null : {});
  const [loadError, setLoadError] = useState("");
  const { fields: customFields } = useCustomFields("sales-return");

  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/api/sales/returns/${encodeURIComponent(id)}`)
      .then((r) => setInitialValues(unpackCustomFields(r)))
      .catch(() => setLoadError("Could not load that sales return."));
  }, [id, isEdit]);

  const fields = [...buildSalesReturnFields({ customers, invoices, salesOrders, challans }), ...customFields];

  const handleSubmit = async (values) => {
    const payload = packCustomFields(values);
    if (isEdit) {
      await api.put(`/api/sales/returns/${encodeURIComponent(id)}`, payload);
    } else {
      await api.post("/api/sales/returns", payload);
    }
    navigate("/sales/returns", { state: { toast: isEdit ? "Sales return updated." : "Return request logged." } });
  };

  const title = isEdit ? `Edit Sales Return — ${id}` : "Add Sales Return";
  const crumbs = ["Dashboard", "Sales", "Sales Return", title];

  if (isEdit && !initialValues) {
    return (
      <div>
        <PageHeader title="Edit Sales Return" crumbs={["Dashboard", "Sales", "Sales Return", "Edit Sales Return"]} />
        <div className="loading-row">{loadError ? loadError : <Loader />}</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={title} crumbs={crumbs} />
      <div className="list-card add-page-card">
        <div className="section-title">Sales Return Details</div>
        <AddRecordForm
          fields={fields}
          initialValues={isEdit ? initialValues : undefined}
          onSubmit={handleSubmit}
          onCancel={() => navigate("/sales/returns")}
          submitLabel={isEdit ? "Save Changes" : "Add Sales Return"}
        />
      </div>
    </div>
  );
}
