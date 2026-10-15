import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import ItemsEditor from "../../components/forms/ItemsEditor";
import DateInput from "../../components/forms/DateInput";
import BarcodeScanField from "../../components/forms/BarcodeScanField";
import CustomFieldsSection from "../../components/forms/CustomFieldsSection";
import { usePermissions } from "../../context/PermissionsContext";
import Select from "../../components/forms/Select";

const STATUS_OPTIONS = ["Unpaid", "Paid", "Partially Paid", "Overdue"];

function inr(n) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

function computeRow(row) {
  const quantity = Number(row.quantity) || 0;
  const unitPrice = Number(row.unitPrice) || 0;
  const taxPercent = Number(row.taxPercent) || 0;
  return { ...row, amount: quantity * unitPrice * (1 + taxPercent / 100) };
}

const blank = (v) => (v && v !== "—" ? v : "");

// Header fields + line-items editor + totals + actions for a Purchase
// Invoice — shared by the standalone Add page and its Edit route, same
// reasoning as PurchaseReturnForm.jsx.
export default function PurchaseInvoiceForm({ mode, editingId, initial, suppliers, catalogItems, onCancel, onSaved }) {
  const { can } = usePermissions();
  const [scanMessage, setScanMessage] = useState(null); // { ok: bool, text: string, code?: string }
  const [supplier, setSupplier] = useState(initial?.supplier || "");
  const [poNumber, setPoNumber] = useState(blank(initial?.poNumber));
  const [grNumber, setGrNumber] = useState(blank(initial?.grNumber));
  const [dueDate, setDueDate] = useState(initial?.dueDate || "");
  const [paidAmount, setPaidAmount] = useState(initial?.paidAmount || 0);
  const [status, setStatus] = useState(initial?.status || "Unpaid");
  const [customFieldValues, setCustomFieldValues] = useState(initial?.customFields || {});
  const [items, setItems] = useState((initial?.items || []).map((i) => computeRow(i)));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // "" = nothing typed / not looked up, "found" = the PO number matched and
  // its supplier + items were pulled in below, "not-found" = typed value
  // doesn't match any purchase order.
  const [poLookupStatus, setPoLookupStatus] = useState("");
  const [poLookupBusy, setPoLookupBusy] = useState(false);
  // Same idea for the GRN Number field.
  const [grLookupStatus, setGrLookupStatus] = useState("");
  const [grLookupBusy, setGrLookupBusy] = useState(false);

  const isReal = (v) => Boolean(v && v !== "—");

  // Billable lines from a purchase order: ordered qty, the order's own prices.
  const linesFromPo = (po) =>
    (po.items || []).map((i) =>
      computeRow({
        product: i.product || "",
        quantity: i.quantity || 0,
        unitPrice: i.unitPrice || 0,
        taxPercent: i.taxPercent || 0,
      })
    );

  // Typing a real Purchase Order number and leaving the field fetches that
  // order's supplier and items directly — no picker dialog needed.
  const fetchPoDetails = async (number) => {
    const trimmed = (number || "").trim();
    if (!trimmed) {
      setPoLookupStatus("");
      return;
    }
    setPoLookupBusy(true);
    try {
      const po = await api.get(`/api/purchase-orders/${encodeURIComponent(trimmed)}`);
      setSupplier(po.supplier || "");
      let lines = linesFromPo(po);
      // If goods were already received against this order, bill what was
      // actually accepted and fill in the GRN number too.
      try {
        const list = await api.get("/api/purchase/goods-receipts?page=1&pageSize=500");
        const gr = (list.data || []).find((g) => g.poNumber === po.id);
        if (gr) {
          setGrNumber(gr.id);
          setGrLookupStatus("found");
          lines = linesFromReceipt(gr, po);
        }
      } catch (e) {
        // GRN lookup is a convenience; the PO details alone are enough.
      }
      setItems(lines);
      setPoLookupStatus("found");
    } catch (err) {
      setPoLookupStatus("not-found");
    } finally {
      setPoLookupBusy(false);
    }
  };

  // Accepted quantity per item from a goods receipt, priced from its PO.
  const linesFromReceipt = (gr, po) => {
    const priceByProduct = new Map(((po && po.items) || []).map((i) => [i.product, i]));
    return (gr.items || []).map((i) => {
      const p = priceByProduct.get(i.product) || {};
      const accepted = (Number(i.receivedQty) || 0) - (Number(i.rejectedQty) || 0);
      return computeRow({
        product: i.product || "",
        quantity: accepted > 0 ? accepted : Number(i.receivedQty) || Number(i.poQty) || 0,
        unitPrice: p.unitPrice || 0,
        taxPercent: p.taxPercent || 0,
      });
    });
  };

  // Typing a GRN number and leaving the field pulls in that receipt's
  // supplier and items, plus the purchase order it belongs to (and that
  // order's prices).
  const fetchGrDetails = async (number) => {
    const trimmed = (number || "").trim();
    if (!trimmed) {
      setGrLookupStatus("");
      return;
    }
    setGrLookupBusy(true);
    try {
      const gr = await api.get(`/api/purchase/goods-receipts/${encodeURIComponent(trimmed)}`);
      setSupplier(gr.supplier || "");
      let po = null;
      if (isReal(gr.poNumber)) {
        setPoNumber(gr.poNumber);
        setPoLookupStatus("found");
        try {
          po = await api.get(`/api/purchase-orders/${encodeURIComponent(gr.poNumber)}`);
        } catch (e) {
          setPoLookupStatus("");
        }
      }
      setItems(linesFromReceipt(gr, po));
      setGrLookupStatus("found");
    } catch (err) {
      setGrLookupStatus("not-found");
    } finally {
      setGrLookupBusy(false);
    }
  };

  const subTotal = items.reduce((a, i) => a + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const taxTotal = items.reduce((a, i) => a + ((i.amount || 0) - (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0)), 0);
  const grandTotal = items.reduce((a, i) => a + (i.amount || 0), 0);

  const submitInvoice = async () => {
    setError("");
    if (!supplier) return setError("Supplier is required.");
    if (items.length === 0) return setError("Add at least one item.");
    setSaving(true);
    try {
      const payload = {
        supplier,
        poNumber,
        grNumber,
        dueDate,
        paidAmount,
        items,
        status: mode === "edit" ? status : undefined,
        customFields: customFieldValues,
      };
      if (mode === "edit") {
        await api.put(`/api/purchase/invoices/${encodeURIComponent(editingId)}`, payload);
        onSaved("Purchase invoice updated.");
      } else {
        await api.post("/api/purchase/invoices", payload);
        onSaved("Purchase invoice recorded.");
      }
    } catch (err) {
      setError(err.message || "Failed to save purchase invoice.");
      setSaving(false);
    }
  };

  const itemColumns = [
    { key: "product", label: "Item", type: "select", options: catalogItems.map((p) => p.name) },
    { key: "quantity", label: "Qty", type: "number" },
    { key: "unitPrice", label: "Unit Price", type: "number" },
    { key: "taxPercent", label: "Tax (%)", type: "number" },
    // Serial / Warranty No. column switched off for now with the rest of the
    // barcode / serial features — to be implemented later. Serials already
    // saved on invoices are kept.
    // { key: "serials", label: "Serial / Warranty No.", type: "tags" },
    { key: "amount", label: "Amount", readOnly: true },
  ];

  // Scanning a barcode already on this invoice bumps its quantity instead of
  // adding a second row for the same item. An unrecognised barcode most
  // likely means the supplier's item isn't in the catalog yet — pointed at
  // Add Item rather than silently dropped, since that's the fix.
  const handleScan = (code) => {
    const match = catalogItems.find((p) => p.barcode && p.barcode === code);
    if (!match) {
      setScanMessage({ ok: false, text: `No item found with barcode "${code}".`, code });
      return;
    }
    setItems((prev) => {
      const i = prev.findIndex((r) => r.product === match.name);
      if (i >= 0) {
        const next = [...prev];
        next[i] = computeRow({ ...next[i], quantity: (Number(next[i].quantity) || 0) + 1 });
        return next;
      }
      return [
        ...prev,
        computeRow({
          product: match.name,
          quantity: 1,
          unitPrice: match.purchasePrice || 0,
          taxPercent: match.taxPercent || 0,
          serials: [],
        }),
      ];
    });
    setScanMessage({ ok: true, text: `Added ${match.name}.` });
  };

  return (
    <>
      {error && <div className="login-error">{error}</div>}
      <div className="txn-header-fields">
        <div className={`field${error === "Supplier is required." && !supplier ? " has-error" : ""}`}>
          <label>Supplier <span className="req">*</span></label>
          <Select value={supplier} onChange={(e) => setSupplier(e.target.value)}>
            <option value="">Select Supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </Select>
          {error === "Supplier is required." && !supplier && <span className="field-error">Supplier is required.</span>}
        </div>
        <div className="field">
          <label>Purchase Order No</label>
          <input
            value={poNumber}
            onChange={(e) => {
              setPoNumber(e.target.value);
              setPoLookupStatus("");
            }}
            onBlur={(e) => fetchPoDetails(e.target.value)}
            placeholder="Type a PO number to fetch its details"
          />
          {poLookupBusy && <span className="field-hint">Fetching…</span>}
          {!poLookupBusy && poLookupStatus === "found" && (
            <span className="field-hint field-hint-ok">Order found — supplier and items loaded below.</span>
          )}
          {!poLookupBusy && poLookupStatus === "not-found" && (
            <span className="field-hint">No purchase order with that number — fill in items manually.</span>
          )}
        </div>
        <div className="field">
          <label>GRN Number</label>
          <input
            value={grNumber}
            onChange={(e) => {
              setGrNumber(e.target.value);
              setGrLookupStatus("");
            }}
            onBlur={(e) => fetchGrDetails(e.target.value)}
            placeholder="Type a GRN number to fetch its details"
          />
          {grLookupBusy && <span className="field-hint">Fetching…</span>}
          {!grLookupBusy && grLookupStatus === "found" && (
            <span className="field-hint field-hint-ok">Receipt found — supplier, PO and items loaded below.</span>
          )}
          {!grLookupBusy && grLookupStatus === "not-found" && (
            <span className="field-hint">No goods receipt with that number.</span>
          )}
        </div>
        <div className="field">
          <label>Due Date</label>
          <DateInput value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Paid Amount (₹)</label>
          <input
            type="number"
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value)}
            placeholder="Enter your paid amount"
          />
        </div>
        {mode === "edit" && (
          <div className="field">
            <label>Status</label>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <CustomFieldsSection entity="purchase-invoice" values={customFieldValues} onChange={setCustomFieldValues} />

      {/* Scan-to-add is switched off for now — to be implemented later.
      {can("barcode-scanner", "view") && (
        <>
          <BarcodeScanField
            onScan={handleScan}
            label="Scan Barcode / QR to Add Item"
            placeholder="Scan, or type a barcode and press Enter"
          />
          {scanMessage && (
            <div className={`scan-add-feedback ${scanMessage.ok ? "ok" : "err"}`}>
              {scanMessage.text}
              {!scanMessage.ok && (
                <>
                  {" "}
                  <Link to="/products/items/new" className="cell-link">Add it as a new item</Link>
                </>
              )}
            </div>
          )}
        </>
      )}
      */}
      <ItemsEditor columns={itemColumns} rows={items} onChange={setItems} computeRow={computeRow} />

      <div className="txn-totals">
        <div className="txn-totals-row"><span>Sub Total</span><span>{inr(subTotal)}</span></div>
        <div className="txn-totals-row"><span>Tax</span><span>{inr(taxTotal)}</span></div>
        <div className="txn-totals-row grand"><span>Total</span><span>{inr(grandTotal)}</span></div>
      </div>

      <div className="txn-form-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={submitInvoice} disabled={saving}>
          {saving ? "Saving..." : mode === "edit" ? "Save Changes" : "Save Invoice"}
        </button>
      </div>
    </>
  );
}
