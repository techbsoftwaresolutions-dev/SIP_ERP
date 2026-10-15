import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import GoodsReceiptForm from "./GoodsReceiptForm";
import Loader from "../../components/ui/Loader";

// One page for both Add and Edit — which mode depends only on whether a
// route param `:id` is present (`/purchase/goods-receipt/new` vs.
// `/purchase/goods-receipt/:id/edit`), same pattern as AddPurchaseReturn.jsx.
export default function AddGoodsReceipt() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  // Every PO number that already has a Goods Receipt against it, so the PO
  // dropdown doesn't offer one a second time.
  const [usedPoNumbers, setUsedPoNumbers] = useState([]);
  const [initial, setInitial] = useState(isEdit ? null : {});
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    api.swr("/api/suppliers?page=1&pageSize=200", (r) => setSuppliers(r.data || []));
    api.swr("/api/items?page=1&pageSize=200", (r) => setCatalogItems(r.data || []));
    api.swr("/api/purchase-orders?page=1&pageSize=200", (r) => setPurchaseOrders(r.data || []));
    api
      .get("/api/purchase/goods-receipts?page=1&pageSize=500")
      .then((r) => setUsedPoNumbers((r.data || []).map((gr) => gr.poNumber).filter(Boolean)));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/api/purchase/goods-receipts/${encodeURIComponent(id)}`)
      .then(setInitial)
      .catch(() => setLoadError("Could not load that goods receipt."));
  }, [id, isEdit]);

  const title = isEdit ? `Edit Goods Receipt — ${id}` : "Add Goods Receipt";
  const crumbs = ["Dashboard", "Purchase", "Goods Receipt", title];

  if (isEdit && !initial) {
    return (
      <div>
        <PageHeader title="Edit Goods Receipt" crumbs={["Dashboard", "Purchase", "Goods Receipt", "Edit Goods Receipt"]} />
        <div className="loading-row">{loadError ? loadError : <Loader />}</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={title} crumbs={crumbs} />
      <div className="list-card add-page-card">
        <div className="section-title">Receipt Details</div>
        <GoodsReceiptForm
          mode={isEdit ? "edit" : "add"}
          editingId={id}
          initial={initial}
          suppliers={suppliers}
          catalogItems={catalogItems}
          purchaseOrders={purchaseOrders}
          usedPoNumbers={usedPoNumbers}
          onCancel={() => navigate("/purchase/goods-receipt")}
          onSaved={(message) => navigate("/purchase/goods-receipt", { state: { toast: message } })}
        />
      </div>
    </div>
  );
}
