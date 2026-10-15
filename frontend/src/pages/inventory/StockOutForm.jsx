import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import AddRecordForm from "../../components/forms/AddRecordForm";
import { buildStockOutFields, useStockOutLookups } from "./stockOutFields";
import Loader from "../../components/ui/Loader";

// One page for both Add and Edit — which mode depends only on whether a
// route param `:id` is present (`/inventory/stock-out/new` vs.
// `/inventory/stock-out/:id/edit`), so the two can never drift apart.
export default function StockOutForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const { products, suppliers, customers, warehouses, createWarehouse } = useStockOutLookups();
  const [initialValues, setInitialValues] = useState(() => {
    if (isEdit) return null;
    if (location.state) {
      return {
        product: location.state.product || "",
        warehouse: location.state.warehouse || "",
        unit: location.state.unit || "",
        batchNo: location.state.batchNo || "",
      };
    }
    return {};
  });
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/api/inventory/stock-out/${encodeURIComponent(id)}`)
      .then((data) => {
        if (data) {
          if (!data.supplier && data.departmentOrCustomer) {
            data.supplier = data.departmentOrCustomer;
          }
          if (!data.poNumber && data.referenceNo) {
            data.poNumber = data.referenceNo;
          }
          setInitialValues(data);
        }
      })
      .catch(() => setLoadError("Could not load that stock out record."));
  }, [id, isEdit]);

  const fields = buildStockOutFields({
    products,
    suppliers,
    customers,
    warehouses,
    onCreateWarehouse: createWarehouse,
  });

  const handleSubmit = async (values) => {
    const payload = {
      ...values,
      departmentOrCustomer: values.supplier || values.departmentOrCustomer || "",
      referenceNo: values.poNumber || values.referenceNo || "",
    };
    if (isEdit) {
      await api.put(`/api/inventory/stock-out/${encodeURIComponent(id)}`, payload);
      navigate("/inventory/stock-out", { state: { toast: "Stock out updated." } });
    } else {
      await api.post("/api/inventory/stock-out", payload);
      navigate("/inventory/stock-out", { state: { toast: "Stock out recorded." } });
    }
  };

  const title = isEdit ? `Edit Stock Out — ${id}` : "Add Stock Out";
  const crumbs = isEdit
    ? ["Dashboard", "Inventory", "Stock Out", id, "Edit"]
    : ["Dashboard", "Inventory", "Stock Out", "Add Stock Out"];

  if (isEdit && !initialValues) {
    return (
      <div>
        <PageHeader title="Edit Stock Out" crumbs={["Dashboard", "Inventory", "Stock Out", "Edit Stock Out"]} />
        <div className="loading-row">{loadError ? loadError : <Loader />}</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={title} crumbs={crumbs} />
      <div className="list-card add-page-card">
        <div className="section-title">Stock Out Details</div>
        <AddRecordForm
          fields={fields}
          initialValues={isEdit ? initialValues : undefined}
          onSubmit={handleSubmit}
          onCancel={() => navigate("/inventory/stock-out")}
          submitLabel={isEdit ? "Save Changes" : "Add Stock Out"}
        />
      </div>
    </div>
  );
}
