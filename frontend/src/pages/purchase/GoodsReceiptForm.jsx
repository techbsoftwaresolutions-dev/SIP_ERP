import { useState } from "react";
import api from "../../api/client";
import ItemsEditor from "../../components/forms/ItemsEditor";
import SearchableSelect from "../../components/forms/SearchableSelect";
import DateInput from "../../components/forms/DateInput";
import CustomFieldsSection from "../../components/forms/CustomFieldsSection";
import Select from "../../components/forms/Select";

const INSPECTION_OPTIONS = ["Pending", "Passed", "Partial", "Failed"];
const STATUS_OPTIONS = ["Pending", "Received", "Partially Accepted", "Completed", "Inspection Pending", "Rejected"];
const UNITS = ["Pcs", "Box", "Kg", "Litre", "Set", "Nos", "Roll", "Sheet"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function generateInvoiceNo() {
  return `INV-${String(Math.floor(100000 + Math.random() * 900000))}`;
}

// Header fields + line-items editor + actions for a Goods Receipt — shared by
// the standalone Add page and its Edit route, same reasoning as
// PurchaseReturnForm.jsx.
export default function GoodsReceiptForm({
  mode,
  editingId,
  initial,
  suppliers,
  catalogItems,
  purchaseOrders,
  usedPoNumbers,
  onCancel,
  onSaved,
}) {
  const [supplier, setSupplier] = useState(initial?.supplier || "");
  const [poNumber, setPoNumber] = useState(initial?.poNumber && initial.poNumber !== "—" ? initial.poNumber : "");
  const [invoiceNo, setInvoiceNo] = useState(initial?.invoiceNo || generateInvoiceNo());
  const [invoiceNoMode, setInvoiceNoMode] = useState(initial?.invoiceNo ? "manual" : "auto");
  const [invoiceDate, setInvoiceDate] = useState(initial?.invoiceDate || todayISO());
  const [invoiceDateMode, setInvoiceDateMode] = useState(initial?.invoiceDate ? "manual" : "auto");
  const [inspection, setInspection] = useState(initial?.inspection || "Pending");
  const [status, setStatus] = useState(initial?.status || "Pending");
  const [items, setItems] = useState(initial?.items || []);
  const [customFieldValues, setCustomFieldValues] = useState(initial?.customFields || {});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // "" = no lookup yet, "found" = the chosen PO's details were fetched in.
  const [poLookupStatus, setPoLookupStatus] = useState("");

  const setInvoiceNoModeSafe = (m) => {
    if (m === invoiceNoMode) return;
    setInvoiceNoMode(m);
    setInvoiceNo(m === "auto" ? generateInvoiceNo() : "");
  };

  const setInvoiceDateModeSafe = (m) => {
    if (m === invoiceDateMode) return;
    setInvoiceDateMode(m);
    setInvoiceDate(m === "auto" ? todayISO() : "");
  };

  // Picking an existing Purchase Order No fetches that order's Supplier and
  // Items straight into this form — no manual typing needed.
  const fetchPoDetails = async (number) => {
    const trimmed = (number || "").trim();
    if (!trimmed) {
      setPoLookupStatus("");
      return;
    }
    try {
      const po = await api.get(`/api/purchase-orders/${encodeURIComponent(trimmed)}`);
      setSupplier(po.supplier || "");
      setItems(
        (po.items || []).map((i) => ({
          product: i.product || "",
          poQty: i.quantity || 0,
          receivedQty: 0,
          rejectedQty: 0,
          unit: i.unit || "Nos",
        }))
      );
      setPoLookupStatus("found");
    } catch  {
      setPoLookupStatus("not-found");
    }
  };

  // Once a Supplier is chosen, the PO dropdown narrows to that supplier's own
  // purchase orders; a PO that already has a Goods Receipt is excluded, except
  // the one attached to the receipt being edited.
  const filteredPurchaseOrders = purchaseOrders
    .filter((po) => !supplier || po.supplier === supplier)
    .filter((po) => po.id === poNumber || !usedPoNumbers.includes(po.id));

  const submitReceipt = async () => {
    setError("");
    if (!supplier) return setError("Supplier is required.");
    if (items.length === 0) return setError("Add at least one item.");
    setSaving(true);
    try {
      const payload = {
        supplier,
        poNumber,
        invoiceNo,
        invoiceDate,
        inspection,
        items,
        status: mode === "edit" ? status : undefined,
        customFields: customFieldValues,
      };
      if (mode === "edit") {
        await api.put(`/api/purchase/goods-receipts/${encodeURIComponent(editingId)}`, payload);
        onSaved("Goods receipt updated.");
      } else {
        await api.post("/api/purchase/goods-receipts", payload);
        onSaved("Goods receipt recorded.");
      }
    } catch (err) {
      setError(err.message || "Failed to save goods receipt.");
      setSaving(false);
    }
  };

  const itemColumns = [
    { key: "product", label: "Item", type: "select", options: catalogItems.map((p) => p.name) },
    { key: "poQty", label: "Purchase Order Qty", type: "number" },
    { key: "receivedQty", label: "Received Qty", type: "number" },
    { key: "rejectedQty", label: "Rejected Qty", type: "number" },
    { key: "unit", label: "Unit", type: "select", options: UNITS },
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
          <SearchableSelect
            value={poNumber}
            onChange={(val) => {
              setPoNumber(val);
              fetchPoDetails(val);
            }}
            options={filteredPurchaseOrders.map((po) => po.id)}
            placeholder={supplier ? "Select or search PO number" : "Select supplier, or search any PO number"}
          />
          {poLookupStatus === "found" && (
            <span className="field-hint field-hint-ok">Existing order found — Supplier &amp; Items loaded below.</span>
          )}
        </div>
        <div className="field">
          <label className="field-label-row">
            <span>Invoice No</span>
            <span className="field-mode-toggle">
              <button type="button" className={invoiceNoMode === "auto" ? "active" : ""} onClick={() => setInvoiceNoModeSafe("auto")}>Auto Generate</button>
              <button type="button" className={invoiceNoMode === "manual" ? "active" : ""} onClick={() => setInvoiceNoModeSafe("manual")}>Manual</button>
            </span>
          </label>
          <input
            type="text"
            value={invoiceNo}
            placeholder="Enter your invoice no"
            onChange={(e) => setInvoiceNo(e.target.value)}
            readOnly={invoiceNoMode === "auto"}
            className={invoiceNoMode === "auto" ? "field-readonly" : undefined}
          />
        </div>
        <div className="field">
          <label className="field-label-row">
            <span>Invoice Date</span>
            <span className="field-mode-toggle">
              <button type="button" className={invoiceDateMode === "auto" ? "active" : ""} onClick={() => setInvoiceDateModeSafe("auto")}>Auto Generate</button>
              <button type="button" className={invoiceDateMode === "manual" ? "active" : ""} onClick={() => setInvoiceDateModeSafe("manual")}>Manual</button>
            </span>
          </label>
          <DateInput
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            readOnly={invoiceDateMode === "auto"}
          />
        </div>
        <div className="field">
          <label>Inspection</label>
          <Select value={inspection} onChange={(e) => setInspection(e.target.value)}>
            {INSPECTION_OPTIONS.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </Select>
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

      <CustomFieldsSection entity="goods-receipt" values={customFieldValues} onChange={setCustomFieldValues} />

      <ItemsEditor columns={itemColumns} rows={items} onChange={setItems} />

      <div className="txn-form-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={submitReceipt} disabled={saving}>
          {saving ? "Saving..." : mode === "edit" ? "Save Changes" : "Save Receipt"}
        </button>
      </div>
    </>
  );
}
