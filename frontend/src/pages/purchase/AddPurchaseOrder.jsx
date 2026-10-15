import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import PurchaseOrderForm from "./PurchaseOrderForm";
import Loader from "../../components/ui/Loader";

// One page for both Add and Edit — which mode depends only on whether a
// route param `:id` is present (`/purchase/orders/new` vs.
// `/purchase/orders/:id/edit`), so the two can never drift apart.
export default function AddPurchaseOrder() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [initial, setInitial] = useState(isEdit ? null : {});
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    api.swr("/api/suppliers?page=1&pageSize=200", (r) => setSuppliers(r.data || []));
    api.swr("/api/items?page=1&pageSize=200", (r) => setCatalogItems(r.data || []));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/api/purchase-orders/${encodeURIComponent(id)}`)
      .then(setInitial)
      .catch(() => setLoadError("Could not load that purchase order."));
  }, [id, isEdit]);

  const title = isEdit ? `Edit Purchase Order — ${id}` : "Add Purchase Order";
  const crumbs = ["Dashboard", "Purchase", "Purchase Orders", title];

  if (isEdit && !initial) {
    return (
      <div>
        <PageHeader title="Edit Purchase Order" crumbs={["Dashboard", "Purchase", "Purchase Orders", "Edit Purchase Order"]} />
        <div className="loading-row">{loadError ? loadError : <Loader />}</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={title} crumbs={crumbs} />
      <div className="list-card add-page-card">
        <div className="section-title">Order Details</div>
        <PurchaseOrderForm
          mode={isEdit ? "edit" : "add"}
          editingId={id}
          initial={initial}
          suppliers={suppliers}
          catalogItems={catalogItems}
          onCancel={() => navigate(isEdit ? `/purchase/orders/${id}` : "/purchase/orders")}
          onSaved={(message) =>
            navigate(isEdit ? `/purchase/orders/${id}` : "/purchase/orders", { state: { toast: message } })
          }
        />
      </div>
    </div>
  );
}
