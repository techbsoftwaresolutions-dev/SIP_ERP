import { useEffect, useState } from "react";
import api from "../../api/client";
import ItemsEditor from "../../components/forms/ItemsEditor";
import SearchableSelect from "../../components/forms/SearchableSelect";
import DateInput from "../../components/forms/DateInput";
import CustomFieldsSection from "../../components/forms/CustomFieldsSection";

export const STATUS_OPTIONS = ["Draft", "Pending", "Sent", "Partially Received", "Received", "Completed", "Cancelled"];
export const PAYMENT_TERMS = ["Immediate", "15 Days", "30 Days", "45 Days", "60 Days"];
const UNITS = ["Nos", "Kg", "Litre", "Box", "Set", "Roll", "Sheet"];

export function inr(n) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

export function computeRow(row) {
  const quantity = Number(row.quantity) || 0;
  const unitPrice = Number(row.unitPrice) || 0;
  const taxPercent = Number(row.taxPercent) || 0;
  return { ...row, amount: quantity * unitPrice * (1 + taxPercent / 100) };
}

// Header fields + line-items editor + totals + actions for a Purchase
// Order — shared by the standalone Add Purchase Order page and the Edit
// modal on the list page, so the two can never drift apart.
export default function PurchaseOrderForm({ mode, editingId, initial, suppliers, catalogItems, onCancel, onSaved }) {
  const [previewPoNumber, setPreviewPoNumber] = useState("");
  const [supplier, setSupplier] = useState(initial?.supplier || "");
  const [expectedDate, setExpectedDate] = useState(initial?.expectedDate || "");
  const [paymentTerms, setPaymentTerms] = useState(initial?.paymentTerms || "30 Days");
  const [status, setStatus] = useState(initial?.status || "Draft");
  const [items, setItems] = useState((initial?.items || []).map((i) => computeRow(i)));
  const [customFieldValues, setCustomFieldValues] = useState(initial?.customFields || {});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // "" = no lookup attempted yet, "found" = typed PO No matched an existing
  // order and its details were fetched in, "not-found" = typed value doesn't
  // match anything (expected while typing the auto-suggested next number).
  const [poLookupStatus, setPoLookupStatus] = useState("");

  useEffect(() => {
    if (mode === "add") {
      setPreviewPoNumber("Fetching…");
      api.get("/api/purchase-orders/next-number").then((r) => setPreviewPoNumber(r.number || "—"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Typing an existing PO number into the "Purchase Order No" field on the
  // Add form fetches that order's full details and fills the rest of the
  // form with them. A non-match (e.g. the auto-suggested next number, or a
  // partially-typed value) is expected and silently ignored — no error shown.
  const fetchPoDetails = async (number) => {
    const trimmed = (number || "").trim();
    if (!trimmed) {
      setPoLookupStatus("");
      return;
    }
    try {
      const po = await api.get(`/api/purchase-orders/${encodeURIComponent(trimmed)}`);
      setSupplier(po.supplier || "");
      setExpectedDate(po.expectedDate || "");
      setPaymentTerms(po.paymentTerms || "30 Days");
      setItems((po.items || []).map((i) => computeRow(i)));
      setCustomFieldValues(po.customFields || {});
      setPoLookupStatus("found");
    } catch (err) {
      setPoLookupStatus("not-found");
    }
  };

  const subTotal = items.reduce((a, i) => a + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const taxTotal = items.reduce((a, i) => a + ((i.amount || 0) - (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0)), 0);
  const grandTotal = items.reduce((a, i) => a + (i.amount || 0), 0);

  const submitOrder = async (statusFlag) => {
    setError("");
    if (!supplier) return setError("Supplier is required.");
    if (items.length === 0) return setError("Add at least one item.");
    setSaving(true);
    try {
      if (mode === "edit") {
        await api.put(`/api/purchase-orders/${encodeURIComponent(editingId)}`, {
          supplier,
          expectedDate,
          paymentTerms,
          items,
          status,
          customFields: customFieldValues,
        });
        onSaved("Purchase order updated.");
      } else {
        await api.post("/api/purchase-orders", {
          supplier,
          expectedDate,
          paymentTerms,
          items,
          status: statusFlag,
          customFields: customFieldValues,
        });
        onSaved("Purchase order saved.");
      }
    } catch (err) {
      setError(err.message || "Failed to save purchase order.");
      setSaving(false);
    }
  };

  const itemColumns = [
    {
      key: "product",
      label: "Item",
      type: "combo",
      options: catalogItems.map((p) => p.name),
      // Picking an item pre-fills HSN / Unit / Tax / Unit Price from its
      // catalog record — the user can still edit any of those afterward.
      deriveFrom: {
        source: catalogItems,
        match: "name",
        fields: { hsnCode: "hsnCode", unit: "unit", taxPercent: "taxPercent", unitPrice: "purchasePrice" },
      },
    },
    { key: "hsnCode", label: "HSN/SAC" },
    { key: "quantity", label: "Qty", type: "number" },
    { key: "unit", label: "Unit", type: "combo", options: UNITS },
    { key: "unitPrice", label: "Unit Price", type: "number" },
    { key: "taxPercent", label: "Tax (%)", type: "number" },
    { key: "amount", label: "Amount", readOnly: true },
  ];

  return (
    <>
      {error && <div className="login-error">{error}</div>}
      <div className="txn-header-fields">
        <div className="field">
          <label>Purchase Order No</label>
          {mode === "edit" ? (
            <input type="text" value={editingId} readOnly className="field-readonly" />
          ) : (
            <>
              <input
                type="text"
                value={previewPoNumber}
                placeholder="Type a PO number to fetch its details"
                onChange={(e) => {
                  setPreviewPoNumber(e.target.value);
                  setPoLookupStatus("");
                }}
                onBlur={(e) => fetchPoDetails(e.target.value)}
              />
              {poLookupStatus === "found" && (
                <span className="field-hint field-hint-ok">Existing order found — details loaded below.</span>
              )}
            </>
          )}
        </div>
        <div className={`field${error === "Supplier is required." && !supplier ? " has-error" : ""}`}>
          <label>Supplier <span className="req">*</span></label>
          <SearchableSelect
            value={supplier}
            onChange={setSupplier}
            options={suppliers.map((s) => s.name)}
            placeholder="Select or search supplier"
          />
          {error === "Supplier is required." && !supplier && <span className="field-error">Supplier is required.</span>}
        </div>
        <div className="field">
          <label>Delivery</label>
          <DateInput value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Payment Terms</label>
          <SearchableSelect value={paymentTerms} onChange={setPaymentTerms} options={PAYMENT_TERMS} placeholder="Select payment terms" />
        </div>
        {mode === "edit" && (
          <div className="field">
            <label>Status</label>
            <SearchableSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} placeholder="Select status" />
          </div>
        )}
      </div>

      <CustomFieldsSection entity="purchase-order" values={customFieldValues} onChange={setCustomFieldValues} />

      <ItemsEditor columns={itemColumns} rows={items} onChange={setItems} computeRow={computeRow} />

      <div className="txn-totals">
        <div className="txn-totals-row"><span>Sub Total</span><span>{inr(subTotal)}</span></div>
        <div className="txn-totals-row"><span>Tax</span><span>{inr(taxTotal)}</span></div>
        <div className="txn-totals-row grand"><span>Total</span><span>{inr(grandTotal)}</span></div>
      </div>

      <div className="txn-form-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={saving}>Cancel</button>
        {mode === "edit" ? (
          <button type="button" className="btn btn-primary" onClick={() => submitOrder()} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        ) : (
          <>
            <button type="button" className="btn" onClick={() => submitOrder("Draft")} disabled={saving}>Save Draft</button>
            <button type="button" className="btn btn-primary" onClick={() => submitOrder("Submit")} disabled={saving}>
              {saving ? "Saving..." : "Submit"}
            </button>
          </>
        )}
      </div>
    </>
  );
}
