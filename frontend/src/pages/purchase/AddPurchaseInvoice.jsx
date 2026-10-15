import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import PurchaseInvoiceForm from "./PurchaseInvoiceForm";
import Loader from "../../components/ui/Loader";

// One page for both Add and Edit — which mode depends only on whether a
// route param `:id` is present (`/purchase/invoices/new` vs.
// `/purchase/invoices/:id/edit`), same pattern as AddPurchaseReturn.jsx.
export default function AddPurchaseInvoice() {
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
    // Prefer the single-record route; an older backend without it falls back
    // to finding the invoice in the list, so Edit works on both.
    api
      .get(`/api/purchase/invoices/${encodeURIComponent(id)}`)
      .catch(() =>
        api.get("/api/purchase/invoices?page=1&pageSize=500").then((r) => {
          const found = (r.data || []).find((inv) => inv.id === id);
          if (!found) throw new Error("not found");
          return found;
        })
      )
      .then(setInitial)
      .catch(() => setLoadError("Could not load that purchase invoice."));
  }, [id, isEdit]);

  const title = isEdit ? `Edit Purchase Invoice — ${id}` : "Add Purchase Invoice";
  const crumbs = ["Dashboard", "Purchase", "Purchase Invoice", title];

  if (isEdit && !initial) {
    return (
      <div>
        <PageHeader title="Edit Purchase Invoice" crumbs={["Dashboard", "Purchase", "Purchase Invoice", "Edit Purchase Invoice"]} />
        <div className="loading-row">{loadError ? loadError : <Loader />}</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={title} crumbs={crumbs} />
      <div className="list-card add-page-card">
        <div className="section-title">Invoice Details</div>
        <PurchaseInvoiceForm
          mode={isEdit ? "edit" : "add"}
          editingId={id}
          initial={initial}
          suppliers={suppliers}
          catalogItems={catalogItems}
          onCancel={() => navigate("/purchase/invoices")}
          onSaved={(message) => navigate("/purchase/invoices", { state: { toast: message } })}
        />
      </div>
    </div>
  );
}
