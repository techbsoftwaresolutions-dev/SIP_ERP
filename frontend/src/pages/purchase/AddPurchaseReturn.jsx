import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import PurchaseReturnForm from "./PurchaseReturnForm";
import Loader from "../../components/ui/Loader";

// One page for both Add and Edit — which mode depends only on whether a
// route param `:id` is present (`/purchase/returns/new` vs.
// `/purchase/returns/:id/edit`), same pattern as AddPurchaseOrder.jsx.
export default function AddPurchaseReturn() {
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
      .get(`/api/purchase/returns/${encodeURIComponent(id)}`)
      .then(setInitial)
      .catch(() => setLoadError("Could not load that purchase return."));
  }, [id, isEdit]);

  const title = isEdit ? `Edit Purchase Return — ${id}` : "Add Purchase Return";
  const crumbs = ["Dashboard", "Purchase", "Purchase Return", title];

  if (isEdit && !initial) {
    return (
      <div>
        <PageHeader title="Edit Purchase Return" crumbs={["Dashboard", "Purchase", "Purchase Return", "Edit Purchase Return"]} />
        <div className="loading-row">{loadError ? loadError : <Loader />}</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={title} crumbs={crumbs} />
      <div className="list-card add-page-card">
        <div className="section-title">Return Details</div>
        <PurchaseReturnForm
          mode={isEdit ? "edit" : "add"}
          editingId={id}
          initial={initial}
          suppliers={suppliers}
          catalogItems={catalogItems}
          onCancel={() => navigate("/purchase/returns")}
          onSaved={(message) => navigate("/purchase/returns", { state: { toast: message } })}
        />
      </div>
    </div>
  );
}
