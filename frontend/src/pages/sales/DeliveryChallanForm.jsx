import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import AddRecordForm from "../../components/forms/AddRecordForm";
import { buildDeliveryChallanFields, useDeliveryChallanLookups } from "./deliveryChallanFields";
import Loader from "../../components/ui/Loader";
import { useCustomFields, packCustomFields, unpackCustomFields } from "../../hooks/useCustomFields";

// One page for both Add and Edit — which mode depends only on whether a
// route param `:id` is present (`/sales/delivery-challan/new` vs.
// `/sales/delivery-challan/:id/edit`), so the two can never drift apart.
export default function DeliveryChallanForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const { customers, salesOrders } = useDeliveryChallanLookups();

  // Set when the user hit "Convert to Delivery Challan" on an Invoice row —
  // the Add form opens pre-filled from that invoice but saves nothing until
  // the user reviews it and clicks "Add Delivery Challan".
  const fromInvoice = !isEdit && location.state && location.state.fromInvoice;

  const [initialValues, setInitialValues] = useState(isEdit ? null : fromInvoice || {});
  const [loadError, setLoadError] = useState("");
  const { fields: customFields } = useCustomFields("delivery-challan");

  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/api/sales/delivery-challans/${encodeURIComponent(id)}`)
      .then((r) => setInitialValues(unpackCustomFields(r)))
      .catch(() => setLoadError("Could not load that delivery challan."));
  }, [id, isEdit]);

  const fields = [...buildDeliveryChallanFields({ customers, salesOrders }), ...customFields];

  const handleSubmit = async (values) => {
    const payload = packCustomFields(values);
    if (isEdit) {
      await api.put(`/api/sales/delivery-challans/${encodeURIComponent(id)}`, payload);
    } else {
      const created = await api.post("/api/sales/delivery-challans", payload);
      // Link the new challan back to the invoice it came from, so that
      // invoice's "Convert to Delivery Challan" button shows it's done.
      if (fromInvoice && fromInvoice.fromInvoiceId && created && created.id) {
        try {
          await api.put(`/api/sales/invoices/${encodeURIComponent(fromInvoice.fromInvoiceId)}/dc-number`, { dcNumber: created.id });
        } catch {
          /* non-fatal — the challan itself was created */
        }
      }
    }
    navigate("/sales/delivery-challan", {
      state: {
        toast: isEdit
          ? "Delivery challan updated."
          : fromInvoice
            ? `Delivery challan created from ${fromInvoice.fromInvoiceId}.`
            : "Delivery challan created.",
      },
    });
  };

  const title = isEdit
    ? `Edit Delivery Challan — ${id}`
    : fromInvoice
      ? `Add Delivery Challan — from ${fromInvoice.fromInvoiceId}`
      : "Add Delivery Challan";
  const crumbs = ["Dashboard", "Sales", "Delivery Challan", title];

  if (isEdit && !initialValues) {
    return (
      <div>
        <PageHeader title="Edit Delivery Challan" crumbs={["Dashboard", "Sales", "Delivery Challan", "Edit Delivery Challan"]} />
        <div className="loading-row">{loadError ? loadError : <Loader />}</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={title} crumbs={crumbs} />
      <div className="list-card add-page-card">
        <div className="section-title">Delivery Challan Details</div>
        <AddRecordForm
          fields={fields}
          initialValues={isEdit ? initialValues : fromInvoice || undefined}
          onSubmit={handleSubmit}
          onCancel={() => navigate("/sales/delivery-challan")}
          submitLabel={isEdit ? "Save Changes" : "Add Delivery Challan"}
        />
      </div>
    </div>
  );
}
