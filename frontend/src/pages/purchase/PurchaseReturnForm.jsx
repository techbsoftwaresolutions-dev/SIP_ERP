import { useState } from "react";
import api from "../../api/client";
import ItemsEditor from "../../components/forms/ItemsEditor";
import SearchableSelect from "../../components/forms/SearchableSelect";
import CustomFieldsSection from "../../components/forms/CustomFieldsSection";

export const STATUS_OPTIONS = ["Pending", "Approved", "Completed", "Rejected"];
export const REASON_OPTIONS = ["Damaged", "Quality Issue", "Wrong Specification", "Excess Quantity", "Other"];
const UNITS = ["Pcs", "Box", "Kg", "Litre", "Set"];

export function inr(n) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

export function computeRow(row) {
  const returnQty = Number(row.returnQty) || 0;
  const unitPrice = Number(row.unitPrice) || 0;
  return { ...row, amount: returnQty * unitPrice };
}

// Header fields + line-items editor + totals + actions for a Purchase
// Return — shared by the standalone Add page and its Edit route, so the two
// can never drift apart (same reasoning as PurchaseOrderForm.jsx).
export default function PurchaseReturnForm({ mode, editingId, initial, suppliers, catalogItems, onCancel, onSaved }) {
  const [supplier, setSupplier] = useState(initial?.supplier || "");
  const [poNumber, setPoNumber] = useState(initial?.poNumber && initial.poNumber !== "—" ? initial.poNumber : "");
  const [grNumber, setGrNumber] = useState(initial?.grNumber && initial.grNumber !== "—" ? initial.grNumber : "");
  const [invoiceNumber, setInvoiceNumber] = useState(
    initial?.invoiceNumber && initial.invoiceNumber !== "—" ? initial.invoiceNumber : ""
  );
  const [reason, setReason] = useState(initial?.reason || "Damaged");
  const [creditNote, setCreditNote] = useState(initial?.creditNote && initial.creditNote !== "Pending" ? initial.creditNote : "");
  const [status, setStatus] = useState(initial?.status || "Pending");
  const [items, setItems] = useState((initial?.items || []).map((i) => computeRow(i)));
  const [customFieldValues, setCustomFieldValues] = useState(initial?.customFields || {});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // Which number the user last looked up, and how it went: "" = nothing yet,
  // "found", or "not-found". One status per field so each shows its own hint.
  const [lookup, setLookup] = useState({ po: "", gr: "", inv: "" });
  const [lookupBusy, setLookupBusy] = useState("");
  const setLookupStatus = (patch) => setLookup((l) => ({ ...l, ...patch }));

  const isReal = (v) => Boolean(v && v !== "—");
  const getJson = (path) => api.get(path).catch(() => null);
  // Lists are searched client-side so this works against any backend version.
  const findIn = async (path, predicate) => {
    const list = await getJson(`${path}?page=1&pageSize=500`);
    return ((list && list.data) || []).find(predicate) || null;
  };

  // Lines a return can be raised against: the invoice's own lines if there is
  // one, else what the goods receipt accepted (priced from the PO), else the
  // order's lines. The user only adjusts "Return Qty" afterwards.
  const buildLines = ({ po, gr, inv }) => {
    if (inv && (inv.items || []).length) {
      return inv.items.map((i) =>
        computeRow({ product: i.product, invoicedQty: i.quantity, returnQty: 0, unitPrice: i.unitPrice, unit: i.unit || "Pcs" })
      );
    }
    if (gr && (gr.items || []).length) {
      const prices = new Map(((po && po.items) || []).map((i) => [i.product, i]));
      return gr.items.map((i) => {
        const accepted = (Number(i.receivedQty) || 0) - (Number(i.rejectedQty) || 0);
        return computeRow({
          product: i.product,
          invoicedQty: accepted > 0 ? accepted : Number(i.receivedQty) || Number(i.poQty) || 0,
          returnQty: 0,
          unitPrice: (prices.get(i.product) || {}).unitPrice || 0,
          unit: i.unit || "Pcs",
        });
      });
    }
    return ((po && po.items) || []).map((i) =>
      computeRow({ product: i.product, invoicedQty: i.quantity, returnQty: 0, unitPrice: i.unitPrice, unit: i.unit || "Pcs" })
    );
  };

  // Typing a PO, GRN or purchase-invoice number and leaving the field pulls in
  // everything linked to it: supplier, the other two numbers, and the items.
  const fetchDetails = async (kind, number) => {
    const trimmed = (number || "").trim();
    if (!trimmed) {
      setLookupStatus({ [kind]: "" });
      return;
    }
    setLookupBusy(kind);
    try {
      let po = null;
      let gr = null;
      let inv = null;
      if (kind === "po") {
        po = await api.get(`/api/purchase-orders/${encodeURIComponent(trimmed)}`);
        gr = await findIn("/api/purchase/goods-receipts", (g) => g.poNumber === po.id);
        inv = await findIn("/api/purchase/invoices", (v) => v.poNumber === po.id || (gr && v.grNumber === gr.id));
      } else if (kind === "gr") {
        gr = await api.get(`/api/purchase/goods-receipts/${encodeURIComponent(trimmed)}`);
        if (isReal(gr.poNumber)) po = await getJson(`/api/purchase-orders/${encodeURIComponent(gr.poNumber)}`);
        inv = await findIn("/api/purchase/invoices", (v) => v.grNumber === gr.id);
      } else {
        inv = await findIn("/api/purchase/invoices", (v) => v.id === trimmed);
        if (!inv) throw new Error("not found");
        if (isReal(inv.poNumber)) po = await getJson(`/api/purchase-orders/${encodeURIComponent(inv.poNumber)}`);
        if (isReal(inv.grNumber)) gr = await getJson(`/api/purchase/goods-receipts/${encodeURIComponent(inv.grNumber)}`);
      }
      setSupplier((po && po.supplier) || (gr && gr.supplier) || (inv && inv.supplier) || "");
      if (po) setPoNumber(po.id);
      if (gr) setGrNumber(gr.id);
      if (inv) setInvoiceNumber(inv.id);
      setItems(buildLines({ po, gr, inv }));
      setLookup({ po: po ? "found" : lookup.po, gr: gr ? "found" : lookup.gr, inv: inv ? "found" : lookup.inv, [kind]: "found" });
    } catch (err) {
      setLookupStatus({ [kind]: "not-found" });
    } finally {
      setLookupBusy("");
    }
  };

  const hint = (kind, label) => (
    <>
      {lookupBusy === kind && <span className="field-hint">Fetching…</span>}
      {lookupBusy !== kind && lookup[kind] === "found" && (
        <span className="field-hint field-hint-ok">{label} found — supplier, numbers and items loaded below.</span>
      )}
      {lookupBusy !== kind && lookup[kind] === "not-found" && (
        <span className="field-hint">No {label.toLowerCase()} with that number — fill in items manually.</span>
      )}
    </>
  );

  const grandTotal = items.reduce((a, i) => a + (i.amount || 0), 0);

  const submitReturn = async () => {
    setError("");
    if (!supplier) return setError("Supplier is required.");
    if (items.length === 0) return setError("Add at least one item.");
    if (!items.some((i) => (Number(i.returnQty) || 0) > 0)) {
      return setError("At least one item needs a Return Qty greater than 0.");
    }
    setSaving(true);
    try {
      const payload = {
        supplier,
        poNumber,
        grNumber,
        invoiceNumber,
        reason,
        creditNote,
        items,
        customFields: customFieldValues,
      };
      if (mode === "edit") {
        await api.put(`/api/purchase/returns/${encodeURIComponent(editingId)}`, { ...payload, status });
        onSaved("Purchase return updated.");
      } else {
        await api.post("/api/purchase/returns", payload);
        onSaved("Purchase return recorded — stock updated.");
      }
    } catch (err) {
      setError(err.message || "Failed to save purchase return.");
      setSaving(false);
    }
  };

  const itemColumns = [
    { key: "product", label: "Item", type: "select", options: catalogItems.map((p) => p.name) },
    { key: "invoicedQty", label: "Invoiced Qty", type: "number" },
    { key: "returnQty", label: "Return Qty", type: "number" },
    { key: "unitPrice", label: "Unit Price", type: "number" },
    { key: "unit", label: "Unit", type: "select", options: UNITS },
    { key: "amount", label: "Amount", readOnly: true },
  ];

  return (
    <>
      {error && <div className="login-error">{error}</div>}
      <div className="txn-header-fields">
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
          <label>Purchase Order No</label>
          <input
            type="text"
            value={poNumber}
            placeholder="Type a PO number to fetch its details"
            onChange={(e) => {
              setPoNumber(e.target.value);
              setLookupStatus({ po: "" });
            }}
            onBlur={(e) => fetchDetails("po", e.target.value)}
          />
          {hint("po", "Purchase order")}
        </div>
        <div className="field">
          <label>GRN No.</label>
          <input
            value={grNumber}
            onChange={(e) => {
              setGrNumber(e.target.value);
              setLookupStatus({ gr: "" });
            }}
            onBlur={(e) => fetchDetails("gr", e.target.value)}
            placeholder="Type a GRN number to fetch its details"
          />
          {hint("gr", "Goods receipt")}
        </div>
        <div className="field">
          <label>Invoice No.</label>
          <input
            value={invoiceNumber}
            onChange={(e) => {
              setInvoiceNumber(e.target.value);
              setLookupStatus({ inv: "" });
            }}
            onBlur={(e) => fetchDetails("inv", e.target.value)}
            placeholder="Type an invoice number to fetch its details"
          />
          {hint("inv", "Purchase invoice")}
        </div>
        <div className="field">
          <label>Reason</label>
          <SearchableSelect value={reason} onChange={setReason} options={REASON_OPTIONS} placeholder="Select reason" />
        </div>
        <div className="field">
          <label>Credit Note</label>
          <input value={creditNote} onChange={(e) => setCreditNote(e.target.value)} placeholder="Enter your credit note number" />
        </div>
        {mode === "edit" && (
          <div className="field">
            <label>Status</label>
            <SearchableSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} placeholder="Select status" />
          </div>
        )}
      </div>

      <CustomFieldsSection entity="purchase-return" values={customFieldValues} onChange={setCustomFieldValues} />

      <ItemsEditor columns={itemColumns} rows={items} onChange={setItems} computeRow={computeRow} />

      <div className="txn-totals">
        <div className="txn-totals-row grand"><span>Total</span><span>{inr(grandTotal)}</span></div>
      </div>

      <div className="txn-form-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={submitReturn} disabled={saving}>
          {saving ? "Saving..." : mode === "edit" ? "Save Changes" : "Save Return"}
        </button>
      </div>
    </>
  );
}
