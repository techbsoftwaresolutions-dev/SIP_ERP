import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import ItemsEditor from "../../components/forms/ItemsEditor";
import SearchableSelect from "../../components/forms/SearchableSelect";
import BarcodeScanField from "../../components/forms/BarcodeScanField";
import CustomFieldsSection from "../../components/forms/CustomFieldsSection";
import Icon from "../../components/ui/Icon";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../context/PermissionsContext";
import { usePaymentMethods, UNITS, DEFAULT_INVOICE_NOTES, inr, computeRow, useInvoiceLookups } from "./invoiceFields";
import Loader from "../../components/ui/Loader";
import { INDIAN_STATES } from "../../utils/indianStates";
import { isIntraState } from "../../utils/gstStateCodes";
import DateInput from "../../components/forms/DateInput";
import { labelToIso, todayIso } from "../../utils/dateLabels";

// One page for both Add and Edit — which mode depends only on whether a
// route param `:id` is present (`/sales/invoices/new` vs.
// `/sales/invoices/:id/edit`), so the two can never drift apart.
export default function InvoiceForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { can } = usePermissions();
  const { customers, catalogItems, settings, poNumbers, refreshCustomers, createCustomer, createPoNumber } = useInvoiceLookups();
  const [scanMessage, setScanMessage] = useState(null); // { ok: bool, text: string }
  const [notesAiBusy, setNotesAiBusy] = useState(false);
  const [notesAiError, setNotesAiError] = useState("");

  // Set when the user hit "Convert to Invoice" on a Sales Order row — the
  // Add Invoice form opens pre-filled from that order but saves nothing until
  // the user reviews it and clicks "Add Invoice".
  const fromSalesOrder = !isEdit && location.state && location.state.fromSalesOrder;

  const [customer, setCustomer] = useState(fromSalesOrder ? fromSalesOrder.customer || "" : "");
  const [address, setAddress] = useState(fromSalesOrder ? fromSalesOrder.address || "" : "");
  const [phone, setPhone] = useState(fromSalesOrder ? fromSalesOrder.phone || "" : "");
  // The GST "Place of Supply" — decides CGST+SGST (same state as the seller)
  // vs IGST (different state). Defaults from the selected customer's state
  // but stays independently editable, since where an order is actually
  // being supplied to doesn't always match a customer's registered address.
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [shippingSameAsBilling, setShippingSameAsBilling] = useState(true);
  const [shippingAddress, setShippingAddress] = useState("");
  const [poNumber, setPoNumber] = useState(fromSalesOrder ? fromSalesOrder.poNumber || "" : "");
  // The invoice's own date. Defaults to today but can be any date, earlier or later,
  // for a client who asks for an invoice dated before or after it is raised.
  const [invoiceDate, setInvoiceDate] = useState(todayIso());
  const [poDate, setPoDate] = useState(fromSalesOrder ? fromSalesOrder.poDate || "" : "");
  const [transportName, setTransportName] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  // Configured per platform in the admin panel, not hardcoded here.
  const paymentMethods = usePaymentMethods();
  const [eWayBillNo, setEWayBillNo] = useState("");
  const [items, setItems] = useState(
    fromSalesOrder && Array.isArray(fromSalesOrder.items) ? fromSalesOrder.items.map((i) => computeRow(i)) : []
  );
  const [paidAmount, setPaidAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState(isEdit ? "" : DEFAULT_INVOICE_NOTES);
  const [customFieldValues, setCustomFieldValues] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/api/sales/invoices/${encodeURIComponent(id)}`)
      .then((inv) => {
        setCustomer(inv.customer || "");
        setAddress(inv.address || "");
        setPhone(inv.phone || "");
        setShippingSameAsBilling(inv.shippingSameAsBilling !== false);
        setShippingAddress(inv.shippingAddress || "");
        setPlaceOfSupply(inv.placeOfSupply || "");
        setPoNumber(inv.poNumber || "");
        setPoDate(inv.poDate || "");
        setInvoiceDate(labelToIso(inv.date) || todayIso());
        setTransportName(inv.transportName || "");
        setVehicleNo(inv.vehicleNo || "");
        setDeliveryDate(inv.deliveryDate || "");
        setDeliveryLocation(inv.deliveryLocation || "");
        setPaymentMode(inv.paymentMode || "");
        setPaymentReference(inv.paymentReference || "");
        setEWayBillNo(inv.eWayBillNo || "");
        setItems((inv.items || []).map((i) => computeRow(i)));
        setPaidAmount(inv.paidAmount || "");
        setDueDate(inv.dueDate || "");
        setNotes(inv.notes || "");
        setCustomFieldValues(inv.customFields || {});
        setLoaded(true);
      })
      .catch(() => setLoadError("Could not load that invoice."));
  }, [id, isEdit]);

  // Selecting a Customer refreshes Address/Phone from their record — typing
  // a brand-new name (via "+ Use ... as new customer") leaves whatever the
  // user has already entered alone, since there's no record to pull from.
  const handleCustomerChange = (name) => {
    setCustomer(name);
    const match = customers.find((c) => c.name === name);
    if (match) {
      setAddress(match.address || "");
      setPhone(match.phone || "");
      setPlaceOfSupply(match.state || "");
    }
  };

  // Coming from "Convert to Invoice" pre-fills Customer directly (not via
  // handleCustomerChange above), so Place of Supply needs its own fill-in
  // once the customer list has actually loaded.
  useEffect(() => {
    if (!fromSalesOrder || placeOfSupply || !customers.length) return;
    const match = customers.find((c) => c.name === customer);
    if (match) setPlaceOfSupply(match.state || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers]);

  const itemColumns = [
    {
      key: "product",
      label: "Item",
      type: "combo",
      options: catalogItems.map((p) => p.name),
      // Picking a catalog Item pre-fills HSN/Unit/Tax/Price from it — every
      // one of those stays editable afterward.
      deriveFrom: {
        source: catalogItems,
        match: "name",
        fields: { hsnCode: "hsnCode", unit: "unit", taxPercent: "taxPercent", unitPrice: "sellingPrice" },
      },
    },
    { key: "hsnCode", label: "HSN/SAC" },
    { key: "quantity", label: "Qty", type: "number" },
    { key: "unit", label: "Unit", type: "combo", options: UNITS },
    { key: "unitPrice", label: "Unit Price", type: "number" },
    { key: "taxPercent", label: "Tax (%)", type: "number" },
    // Serial / Warranty No. column switched off for now with the rest of the
    // barcode / serial features — to be implemented later. Serials already
    // saved on invoices are kept.
    // { key: "serials", label: "Serial / Warranty No.", type: "tags" },
    { key: "amount", label: "Amount", readOnly: true },
  ];

  // Scanning a barcode already on an invoice bumps its quantity instead of
  // adding a second row for the same item — the natural behaviour at a
  // point of sale, where the same product often gets scanned more than once.
  const handleScan = (code) => {
    const match = catalogItems.find((p) => p.barcode && p.barcode === code);
    if (!match) {
      setScanMessage({ ok: false, text: `No item found with barcode "${code}".` });
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
          hsnCode: match.hsnCode || "",
          quantity: 1,
          unit: match.unit || "",
          unitPrice: match.sellingPrice || 0,
          taxPercent: match.taxPercent || 0,
          serials: [],
        }),
      ];
    });
    setScanMessage({ ok: true, text: `Added ${match.name}.` });
  };

  const subTotal = items.reduce((a, i) => a + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const taxTotal = items.reduce((a, i) => a + ((i.amount || 0) - (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0)), 0);
  const grandTotal = subTotal + taxTotal;
  const balance = grandTotal - (Number(paidAmount) || 0);
  // Matched on the LABEL, because that is what an invoice stores — a method
  // renamed or withdrawn since simply stops matching, and the invoice keeps
  // the text it was filed under.
  const selectedMethod = paymentMethods.find((m) => m.label === paymentMode);

  const generateNotes = async () => {
    setNotesAiBusy(true);
    setNotesAiError("");
    try {
      const res = await api.post("/api/ai/invoice-notes", {
        customer,
        paymentMode,
        items: items.map((i) => ({ product: i.product, quantity: i.quantity, unit: i.unit })),
      });
      if (res && res.notes) setNotes(res.notes);
    } catch (err) {
      setNotesAiError(err.message || "Could not generate notes.");
    } finally {
      setNotesAiBusy(false);
    }
  };

  const submitInvoice = async () => {
    setError("");
    if (!customer) return setError("Customer is required.");
    if (!invoiceDate) return setError("Invoice date is required.");
    if (!address.trim()) return setError("Address is required.");
    if (!phone.trim()) return setError("Mobile number is required.");
    if (phone.trim().length !== 10) return setError("Mobile number must be a 10-digit number.");
    if (!placeOfSupply) return setError("Place of Supply is required — it decides CGST+SGST vs IGST.");
    if (items.length === 0) return setError("Add at least one item.");
    if (selectedMethod && selectedMethod.requiresReference && !paymentReference.trim()) {
      return setError(`${selectedMethod.referenceLabel || "A reference"} is required for ${paymentMode}.`);
    }
    if (items.some((i) => !String(i.product || "").trim() || !(Number(i.quantity) > 0)))
      return setError("Every item needs a product and a quantity greater than 0.");
    setSaving(true);
    const payload = {
      customer,
      address,
      phone,
      shippingSameAsBilling,
      shippingAddress: shippingSameAsBilling ? "" : shippingAddress,
      date: invoiceDate,
      placeOfSupply,
      poNumber,
      poDate,
      transportName,
      vehicleNo,
      deliveryDate,
      deliveryLocation,
      paymentMode,
      // Cleared when the chosen method does not ask for one, so switching
      // from Cheque to Cash never leaves a stale cheque number behind.
      paymentReference: selectedMethod && selectedMethod.requiresReference ? paymentReference : "",
      eWayBillNo,
      items,
      paidAmount: Number(paidAmount) || 0,
      dueDate,
      notes,
      customFields: customFieldValues,
    };
    if (fromSalesOrder) payload.soNumber = fromSalesOrder.orderNo;
    try {
      let saved;
      if (isEdit) {
        saved = await api.put(`/api/sales/invoices/${encodeURIComponent(id)}`, payload);
      } else {
        saved = await api.post("/api/sales/invoices", payload);
      }
      // Link the new invoice back to the Sales Order it came from, so that
      // order's "Convert to Invoice" button now reads "Already converted".
      if (fromSalesOrder && saved && saved.id) {
        try {
          await api.put(`/api/sales/orders/${encodeURIComponent(fromSalesOrder.id)}`, { invoiceId: saved.id });
        } catch {
          /* non-fatal — the invoice itself was created */
        }
      }
      refreshCustomers();
      const toast = isEdit
        ? "Invoice updated."
        : fromSalesOrder
          ? `Invoice created from ${fromSalesOrder.orderNo}.`
          : "Invoice created.";
      navigate("/sales/invoices", { state: { toast } });
    } catch (err) {
      setError(err.message || "Failed to save invoice.");
      setSaving(false);
    }
  };

  const title = isEdit ? `Edit Invoice — ${id}` : fromSalesOrder ? `Add Invoice — from ${fromSalesOrder.orderNo}` : "Add Invoice";
  const crumbs = ["Dashboard", "Sales", "Invoices", title];

  if (isEdit && !loaded) {
    return (
      <div>
        <PageHeader title="Edit Invoice" crumbs={["Dashboard", "Sales", "Invoices", "Edit Invoice"]} />
        <div className="loading-row">{loadError ? loadError : <Loader />}</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={title} crumbs={crumbs} />
      <div className="list-card add-page-card">
        <div className="section-title">Invoice Details</div>
        {error && <div className="login-error">{error}</div>}

        <div className="add-form">
          <div className="field">
            <label>Invoice Date <span style={{ color: "var(--red)" }}>*</span></label>
            <DateInput value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Customer <span style={{ color: "var(--red)" }}>*</span></label>
            <SearchableSelect
              value={customer}
              onChange={handleCustomerChange}
              options={customers.map((c) => c.name)}
              placeholder="Select or search customer"
              onCreate={createCustomer}
              createLabel={(text) => `+ Use "${text}" as new customer`}
            />
          </div>
          <div className="field">
            <label>Address <span style={{ color: "var(--red)" }}>*</span></label>
            <input type="text" value={address} placeholder="Enter address" onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="field">
            <label>Mobile No. <span style={{ color: "var(--red)" }}>*</span></label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={phone}
              placeholder="Enter mobile number"
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            />
          </div>
          <div className="field">
            <label>Place of Supply <span style={{ color: "var(--red)" }}>*</span></label>
            <SearchableSelect
              value={placeOfSupply}
              onChange={setPlaceOfSupply}
              options={INDIAN_STATES}
              placeholder="Select the state goods are supplied to"
            />
            {placeOfSupply && settings?.gstin && (
              <span className="field-hint">
                {isIntraState(settings.gstin, placeOfSupply)
                  ? "Same state as your business — CGST + SGST will apply."
                  : "Different state — IGST will apply."}
              </span>
            )}
          </div>

          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label className="checkbox-field-label">
              <input
                type="checkbox"
                checked={shippingSameAsBilling}
                onChange={(e) => setShippingSameAsBilling(e.target.checked)}
              />
              Shipping address same as billing address
            </label>
          </div>
          {!shippingSameAsBilling && (
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Shipping Address</label>
              <textarea
                rows={2}
                value={shippingAddress}
                placeholder="Enter shipping address"
                onChange={(e) => setShippingAddress(e.target.value)}
              />
            </div>
          )}

          <div className="field">
            <label>PO Number</label>
            <SearchableSelect
              value={poNumber}
              onChange={setPoNumber}
              options={poNumbers}
              placeholder="Select or search PO number"
              onCreate={createPoNumber}
              createLabel={(text) => `+ Use "${text}" as PO number`}
            />
          </div>
          <div className="field">
            <label>PO Date</label>
            <DateInput value={poDate} onChange={(e) => setPoDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Payment Mode</label>
            <SearchableSelect
              value={paymentMode}
              onChange={setPaymentMode}
              options={paymentMethods.map((m) => m.label)}
              placeholder="Select payment mode"
            />
          </div>
          {/* Only for methods the platform says need one — a cheque number,
              a UPI transaction ID. Nothing is asked for cash. */}
          {selectedMethod && selectedMethod.requiresReference && (
            <div className="field">
              <label>
                {selectedMethod.referenceLabel || "Reference"} <span style={{ color: "var(--red)" }}>*</span>
              </label>
              <input
                type="text"
                value={paymentReference}
                placeholder={`Enter the ${(selectedMethod.referenceLabel || "reference").toLowerCase()}`}
                onChange={(e) => setPaymentReference(e.target.value)}
              />
            </div>
          )}

          <div className="field">
            <label>E-Way Bill No.</label>
            <input type="text" value={eWayBillNo} placeholder="Enter e-way bill number" onChange={(e) => setEWayBillNo(e.target.value)} />
          </div>
          <div className="field">
            <label>Transport Name</label>
            <input type="text" value={transportName} placeholder="Enter transporter name" onChange={(e) => setTransportName(e.target.value)} />
          </div>
          <div className="field">
            <label>Vehicle Number</label>
            <input type="text" value={vehicleNo} placeholder="Enter vehicle number" onChange={(e) => setVehicleNo(e.target.value)} />
          </div>
          <div className="field">
            <label>Delivery Date</label>
            <DateInput value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
          </div>

          <div className="field">
            <label>Delivery Location</label>
            <input type="text" value={deliveryLocation} placeholder="Enter delivery location" onChange={(e) => setDeliveryLocation(e.target.value)} />
          </div>
          <div className="field">
            <label>Paid Amount (₹)</label>
            <input type="number" value={paidAmount} placeholder="Enter paid amount" onChange={(e) => setPaidAmount(e.target.value)} />
          </div>
          <div className="field">
            <label>Due Date</label>
            <DateInput value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span>Notes / Terms (printed on the invoice)</span>
              {user?.role === "Administrator" && (
                <button
                  type="button"
                  className="btn"
                  onClick={generateNotes}
                  disabled={notesAiBusy}
                  style={{ padding: "5px 10px", fontSize: 12, fontWeight: 500 }}
                >
                  <Icon name="sparkles" size={13} /> {notesAiBusy ? "Generating…" : "Generate with AI"}
                </button>
              )}
            </label>
            <textarea
              rows={3}
              value={notes}
              placeholder="e.g. Goods once sold will not be taken back."
              onChange={(e) => setNotes(e.target.value)}
            />
            {notesAiError && <div className="login-error" style={{ marginTop: 6 }}>{notesAiError}</div>}
          </div>
        </div>

        <CustomFieldsSection entity="sales-invoice" values={customFieldValues} onChange={setCustomFieldValues} />

        <div className="section-title" style={{ marginTop: 26 }}>Items</div>
        {/* Scan-to-add is switched off for now — to be implemented later.
        {can("barcode-scanner", "view") && (
          <>
            <BarcodeScanField
              onScan={handleScan}
              label="Scan Barcode / QR to Add Item"
              placeholder="Scan, or type a barcode and press Enter"
            />
            {scanMessage && (
              <div className={`scan-add-feedback ${scanMessage.ok ? "ok" : "err"}`}>{scanMessage.text}</div>
            )}
          </>
        )}
        */}
        <ItemsEditor columns={itemColumns} rows={items} onChange={setItems} computeRow={computeRow} />

        <div className="txn-totals" style={{ marginTop: 18 }}>
          <div className="txn-totals-row"><span>Sub Total</span><span>{inr(subTotal)}</span></div>
          <div className="txn-totals-row"><span>Tax</span><span>{inr(taxTotal)}</span></div>
          <div className="txn-totals-row grand"><span>Total Amount</span><span>{inr(grandTotal)}</span></div>
          <div className="txn-totals-row"><span>Paid Amount</span><span>{inr(Number(paidAmount) || 0)}</span></div>
          <div className="txn-totals-row grand"><span>Balance Due</span><span>{inr(balance)}</span></div>
        </div>

        <div className="add-form-actions">
          <button type="button" className="btn" onClick={() => navigate("/sales/invoices")} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={submitInvoice} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}
