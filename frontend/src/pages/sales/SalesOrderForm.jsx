import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import AddRecordForm from "../../components/forms/AddRecordForm";
import { buildSalesOrderFields, useSalesOrderLookups } from "./salesOrderFields";
import Loader from "../../components/ui/Loader";
import { useCustomFields, packCustomFields, unpackCustomFields } from "../../hooks/useCustomFields";

// One page for both Add and Edit — which mode depends only on whether a
// route param `:id` is present (`/sales/orders/new` vs.
// `/sales/orders/:id/edit`), so the two can never drift apart.
export default function SalesOrderForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  // Set when "Convert to Sales Order" was used on a quotation — the form opens
  // pre-filled from it, and the quotation is linked back once the order is saved.
  const fromQuotation = !isEdit && location.state && location.state.fromQuotation;
  const { customers, purchaseOrders, purchaseOrderLookup, catalogItems } = useSalesOrderLookups();
  const [initialValues, setInitialValues] = useState(
    isEdit
      ? null
      : fromQuotation
        ? { customer: fromQuotation.customer, poNumber: fromQuotation.poNumber, lineItems: fromQuotation.lineItems }
        : {}
  );
  const [loadError, setLoadError] = useState("");
  const { fields: customFields } = useCustomFields("sales-order");

  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/api/sales/orders/${encodeURIComponent(id)}`)
      .then((r) => setInitialValues(unpackCustomFields(r)))
      .catch(() => setLoadError("Could not load that sales order."));
  }, [id, isEdit]);

  const fields = [
    ...buildSalesOrderFields({ customers, purchaseOrders, purchaseOrderLookup, catalogItems, isEdit }),
    ...customFields,
  ];

  const handleSubmit = async (values) => {
    const matchedCustomer = customers.find((c) => c.name === values.customer);
    // product / qty / unit / amount / items / requiredDate are derived
    // server-side from lineItems — see deriveSalesOrderScalars in server.js.
    const payload = {
      customer: values.customer,
      city: matchedCustomer?.city || "Chennai",
      poNumber: values.poNumber,
      poDate: values.poDate,
      lineItems: values.lineItems || [],
      deliveryStatus: values.deliveryStatus,
      paymentStatus: values.paymentStatus,
      customFields: packCustomFields(values).customFields,
    };
    if (isEdit) {
      payload.status = values.status;
      await api.put(`/api/sales/orders/${encodeURIComponent(id)}`, payload);
    } else {
      const created = await api.post("/api/sales/orders", payload);
      if (fromQuotation && created && created.id) {
        try {
          await api.put(`/api/sales/quotations/${encodeURIComponent(fromQuotation.id)}`, {
            salesOrderId: created.id,
            status: "Accepted",
          });
        } catch {
          /* non-fatal — the order itself was created */
        }
      }
      navigate("/sales/orders", {
        state: { toast: fromQuotation ? `Sales order created from ${fromQuotation.id}.` : "Sales order created." },
      });
      return;
    }
    navigate("/sales/orders", { state: { toast: "Sales order updated." } });
  };

  const title = isEdit
    ? `Edit Sales Order — ${id}`
    : fromQuotation
      ? `New Sales Order — from ${fromQuotation.id}`
      : "New Sales Order";
  const crumbs = ["Dashboard", "Sales", "Sales Orders", title];

  if (isEdit && !initialValues) {
    return (
      <div>
        <PageHeader title="Edit Sales Order" crumbs={["Dashboard", "Sales", "Sales Orders", "Edit Sales Order"]} />
        <div className="loading-row">{loadError ? loadError : <Loader />}</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={title} crumbs={crumbs} />
      <div className="list-card add-page-card">
        <div className="section-title">Sales Order Details</div>
        <AddRecordForm
          fields={fields}
          initialValues={isEdit || fromQuotation ? initialValues : undefined}
          onSubmit={handleSubmit}
          onCancel={() => navigate("/sales/orders")}
          submitLabel={isEdit ? "Save Changes" : "New Sales Order"}
        />
      </div>
    </div>
  );
}
