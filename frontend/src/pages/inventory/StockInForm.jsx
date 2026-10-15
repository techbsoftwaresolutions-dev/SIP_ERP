import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import AddRecordForm from "../../components/forms/AddRecordForm";
import { buildStockInFields, useStockInLookups } from "./stockInFields";
import Loader from "../../components/ui/Loader";

// One page for both Add and Edit — which mode depends only on whether a
// route param `:id` is present (`/inventory/stock-in/new` vs.
// `/inventory/stock-in/:id/edit`), so the two can never drift apart.
export default function StockInForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const { products, suppliers, warehouses, createWarehouse } = useStockInLookups();
  const [initialValues, setInitialValues] = useState(() => {
    if (isEdit) return null;
    if (location.state) {
      return {
        product: location.state.product || "",
        warehouse: location.state.warehouse || "",
        unit: location.state.unit || "",
      };
    }
    return {};
  });
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/api/inventory/stock-in/${encodeURIComponent(id)}`)
      .then(setInitialValues)
      .catch(() => setLoadError("Could not load that stock in record."));
  }, [id, isEdit]);

  const fields = buildStockInFields({ products, suppliers, warehouses, onCreateWarehouse: createWarehouse });

  const handleSubmit = async (values) => {
    if (isEdit) {
      await api.put(`/api/inventory/stock-in/${encodeURIComponent(id)}`, values);
      navigate("/inventory/stock-in", { state: { toast: "Stock in updated." } });
    } else {
      await api.post("/api/inventory/stock-in", values);
      navigate("/inventory/stock-in", { state: { toast: "Stock in recorded." } });
    }
  };

  const title = isEdit ? `Edit Stock In — ${id}` : "Add Stock In";
  const crumbs = isEdit
    ? ["Dashboard", "Inventory", "Stock In", id, "Edit"]
    : ["Dashboard", "Inventory", "Stock In", "Add Stock In"];

  if (isEdit && !initialValues) {
    return (
      <div>
        <PageHeader title="Edit Stock In" crumbs={["Dashboard", "Inventory", "Stock In", "Edit Stock In"]} />
        <div className="loading-row">{loadError ? loadError : <Loader />}</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={title} crumbs={crumbs} />
      <div className="list-card add-page-card">
        <div className="section-title">Stock In Details</div>
        <AddRecordForm
          fields={fields}
          initialValues={isEdit ? initialValues : undefined}
          onSubmit={handleSubmit}
          onCancel={() => navigate("/inventory/stock-in")}
          submitLabel={isEdit ? "Save Changes" : "Add Stock In"}
        />
      </div>
    </div>
  );
}
