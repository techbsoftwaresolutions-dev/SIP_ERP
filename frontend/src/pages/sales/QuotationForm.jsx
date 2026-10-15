import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import ItemsEditor from "../../components/forms/ItemsEditor";
import SearchableSelect from "../../components/forms/SearchableSelect";
import CustomFieldsSection from "../../components/forms/CustomFieldsSection";
import DateInput from "../../components/forms/DateInput";
import Loader from "../../components/ui/Loader";
import { UNITS, inr, computeRow } from "./invoiceFields";
import { INDIAN_STATES } from "../../utils/indianStates";
import { isIntraState } from "../../utils/gstStateCodes";

const DISCOUNT_TYPES = { amount: "Amount (₹)", percent: "Percentage (%)" };
const STATUS_OPTIONS = ["Draft", "Sent", "Accepted", "Rejected", "Expired"];
const PAYMENT_TERM_OPTIONS = ["Advance", "50% Advance, 50% on Delivery", "Immediate", "7 Days", "15 Days", "30 Days", "45 Days", "60 Days"];

// Just a starting suggestion on a brand-new quotation — editable and
// clearable per quotation, and never hardcoded on the printout itself.
const DEFAULT_QUOTATION_NOTES =
  "Prices are valid until the date mentioned above.\nTaxes as applicable at the time of invoicing.\nDelivery subject to stock availability and receipt of the order.";

// Local-date formatting on purpose: toISOString() converts to UTC, which
// lands on the previous day for anyone east of UTC (e.g. India).
const localISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayISO = () => localISO(new Date());
const inDaysISO = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localISO(d);
};
const labelToISO = (label) => {
  const d = label ? new Date(label) : null;
  return d && !Number.isNaN(d.getTime()) ? localISO(d) : "";
};

// One page for both Add and Edit — `/sales/quotations/new` vs.
// `/sales/quotations/:id/edit`.
export default function QuotationForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [customers, setCustomers] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [settings, setSettings] = useState(null);

  const [customer, setCustomer] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [date, setDate] = useState(isEdit ? "" : todayISO());
  const [validTill, setValidTill] = useState(isEdit ? "" : inDaysISO(15));
  const [subject, setSubject] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [deliveryTerms, setDeliveryTerms] = useState("");
  const [status, setStatus] = useState("Draft");
  const [items, setItems] = useState([]);
  const [discountType, setDiscountType] = useState("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [freightCharges, setFreightCharges] = useState("");
  const [legacyAmount, setLegacyAmount] = useState(0);
  const [notes, setNotes] = useState(isEdit ? "" : DEFAULT_QUOTATION_NOTES);
  const [customFieldValues, setCustomFieldValues] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    api.swr("/api/customers?page=1&pageSize=200", (r) => setCustomers(r.data || []));
    api.swr("/api/items?page=1&pageSize=200", (r) => setCatalogItems(r.data || []));
    api.get("/api/settings").then(setSettings).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/api/sales/quotations/${encodeURIComponent(id)}`)
      .then((q) => {
        setCustomer(q.customer || "");
        setAddress(q.address || "");
        setPhone(q.phone || "");
        setPlaceOfSupply(q.placeOfSupply || "");
        setDate(labelToISO(q.date));
        setValidTill(labelToISO(q.validTill));
        setSubject(q.subject || "");
        setReferenceNo(q.referenceNo || "");
        setPaymentTerms(q.paymentTerms || "");
        setDeliveryTerms(q.deliveryTerms || "");
        setStatus(q.status || "Draft");
        setItems((q.items || []).map((i) => computeRow(i)));
        setDiscountType(q.discountType === "percent" ? "percent" : "amount");
        setDiscountValue(q.discountValue || "");
        setFreightCharges(q.freightCharges || "");
        // A quotation made with the old amount-only form has no lines; its
        // amount is kept until lines are added.
        setLegacyAmount(!(q.items || []).length ? Number(q.amount) || 0 : 0);
        setNotes(q.notes || "");
        setCustomFieldValues(q.customFields || {});
        setLoaded(true);
      })
      .catch(() => setLoadError("Could not load that quotation."));
  }, [id, isEdit]);

  // Picking a customer fills Address / Mobile / Place of Supply from their
  // record; a brand-new name typed in leaves whatever was entered alone.
  const handleCustomerChange = (name) => {
    setCustomer(name);
    const match = customers.find((c) => c.name === name);
    if (match) {
      setAddress(match.address || "");
      setPhone(match.phone || "");
      setPlaceOfSupply(match.state || "");
      if (!paymentTerms && match.paymentTerms) setPaymentTerms(match.paymentTerms);
    }
  };

  const itemColumns = [
    {
      key: "product",
      label: "Item",
      type: "combo",
      options: catalogItems.map((p) => p.name),
      // Picking a catalog Item pre-fills HSN/Unit/Tax/Price — all editable.
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
    { key: "amount", label: "Amount", readOnly: true },
  ];

  const subTotal = items.reduce((a, i) => a + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const rawTax = items.reduce((a, i) => a + ((i.amount || 0) - (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0)), 0);
  // The discount comes off before tax, so tax is charged only on what the
  // customer actually pays for — same arithmetic the server uses.
  const discountInput = Math.max(Number(discountValue) || 0, 0);
  const discountAmount = Math.min(
    discountType === "percent" ? (subTotal * Math.min(discountInput, 100)) / 100 : discountInput,
    subTotal
  );
  const taxTotal = subTotal > 0 ? rawTax * ((subTotal - discountAmount) / subTotal) : rawTax;
  const freight = Number(freightCharges) || 0;
  const grandTotal = items.length ? subTotal - discountAmount + taxTotal + freight : legacyAmount;

  const submit = async () => {
    setError("");
    if (!customer) return setError("Customer is required.");
    if (phone && phone.length !== 10) return setError("Mobile number must be a 10-digit number.");
    if (items.length === 0) return setError("Add at least one item.");
    if (items.some((i) => !String(i.product || "").trim() || !(Number(i.quantity) > 0)))
      return setError("Every item needs a product and a quantity greater than 0.");
    if (discountType === "percent" && discountInput > 100) return setError("Discount cannot be more than 100%.");
    if (discountType === "amount" && discountInput > subTotal) return setError("Discount cannot be more than the sub total.");
    if (date && validTill && validTill < date) return setError("Valid Till cannot be before the quotation date.");
    setSaving(true);
    const payload = {
      customer,
      address,
      phone,
      placeOfSupply,
      date,
      validTill,
      subject,
      referenceNo,
      paymentTerms,
      deliveryTerms,
      items,
      discountType,
      discountValue: discountInput,
      freightCharges: freight,
      notes,
      customFields: customFieldValues,
    };
    try {
      if (isEdit) {
        payload.status = status;
        await api.put(`/api/sales/quotations/${encodeURIComponent(id)}`, payload);
      } else {
        await api.post("/api/sales/quotations", payload);
      }
      navigate("/sales/quotations", { state: { toast: isEdit ? "Quotation updated." : "Quotation created." } });
    } catch (err) {
      setError(err.message || "Failed to save quotation.");
      setSaving(false);
    }
  };

  const title = isEdit ? `Edit Quotation — ${id}` : "New Quotation";

  if (isEdit && !loaded) {
    return (
      <div>
        <PageHeader title="Edit Quotation" crumbs={["Dashboard", "Sales", "Quotations", "Edit Quotation"]} />
        <div className="loading-row">{loadError ? loadError : <Loader />}</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={title} crumbs={["Dashboard", "Sales", "Quotations", title]} />
      <div className="list-card add-page-card">
        <div className="section-title">Quotation Details</div>
        {error && <div className="login-error">{error}</div>}

        <div className="add-form">
          <div className="field">
            <label>Customer <span style={{ color: "var(--red)" }}>*</span></label>
            <SearchableSelect
              value={customer}
              onChange={handleCustomerChange}
              options={customers.map((c) => c.name)}
              placeholder="Select or search customer"
              onCreate={async (v) => v}
              createLabel={(text) => `+ Use "${text}" as new customer`}
            />
          </div>
          <div className="field">
            <label>Mobile No.</label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={phone}
              placeholder="Enter mobile number"
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              style={phone && phone.length !== 10 ? { borderColor: "var(--red)" } : undefined}
            />
            {phone && phone.length !== 10 && (
              <span className="field-hint" style={{ color: "var(--red)" }}>
                Mobile number must be 10 digits ({phone.length}/10).
              </span>
            )}
          </div>
          <div className="field">
            <label>Address</label>
            <input type="text" value={address} placeholder="Enter address" onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="field">
            <label>Place of Supply</label>
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

          <div className="field">
            <label>Quotation Date</label>
            <DateInput value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Valid Till</label>
            <DateInput value={validTill} onChange={(e) => setValidTill(e.target.value)} />
          </div>
          <div className="field">
            <label>Subject</label>
            <input type="text" value={subject} placeholder="e.g. Quotation for CNC machine spares" onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="field">
            <label>Customer Reference / Enquiry No.</label>
            <input type="text" value={referenceNo} placeholder="Customer's enquiry or RFQ number" onChange={(e) => setReferenceNo(e.target.value)} />
          </div>

          <div className="field">
            <label>Payment Terms</label>
            <SearchableSelect
              value={paymentTerms}
              onChange={setPaymentTerms}
              options={PAYMENT_TERM_OPTIONS}
              placeholder="Select or type payment terms"
              onCreate={async (v) => v}
              createLabel={(text) => `+ Use "${text}"`}
            />
          </div>
          <div className="field">
            <label>Delivery Terms</label>
            <input type="text" value={deliveryTerms} placeholder="e.g. Ex-works, delivery within 2 weeks" onChange={(e) => setDeliveryTerms(e.target.value)} />
          </div>
          {isEdit && (
            <div className="field">
              <label>Status</label>
              <SearchableSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} placeholder="Select status" />
            </div>
          )}
        </div>

        <CustomFieldsSection entity="quotation" values={customFieldValues} onChange={setCustomFieldValues} />

        <div className="section-title" style={{ marginTop: 26 }}>Items</div>
        <ItemsEditor columns={itemColumns} rows={items} onChange={setItems} computeRow={computeRow} />

        <div className="add-form" style={{ marginTop: 18 }}>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label>Terms &amp; Conditions (printed on the quotation)</label>
            <textarea
              rows={3}
              value={notes}
              placeholder="e.g. Prices are valid for 15 days."
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Discount Type</label>
            <SearchableSelect
              value={DISCOUNT_TYPES[discountType]}
              onChange={(label) => setDiscountType(label === DISCOUNT_TYPES.percent ? "percent" : "amount")}
              options={Object.values(DISCOUNT_TYPES)}
              placeholder="Select discount type"
            />
          </div>
          <div className="field">
            <label>Total Discount {discountType === "percent" ? "(%)" : "(₹)"}</label>
            <input
              type="number"
              min="0"
              value={discountValue}
              placeholder="0"
              onChange={(e) => setDiscountValue(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Freight / Other Charges (₹)</label>
            <input type="number" value={freightCharges} placeholder="0" onChange={(e) => setFreightCharges(e.target.value)} />
          </div>
        </div>

        <div className="txn-totals" style={{ marginTop: 18 }}>
          <div className="txn-totals-row"><span>Sub Total</span><span>{inr(subTotal)}</span></div>
          {discountAmount > 0 && (
            <div className="txn-totals-row">
              <span>Discount{discountType === "percent" ? ` (${discountInput}%)` : ""}</span>
              <span>− {inr(discountAmount)}</span>
            </div>
          )}
          <div className="txn-totals-row"><span>Tax</span><span>{inr(taxTotal)}</span></div>
          {freight > 0 && <div className="txn-totals-row"><span>Freight / Other</span><span>{inr(freight)}</span></div>}
          <div className="txn-totals-row grand"><span>Total Amount</span><span>{inr(grandTotal)}</span></div>
        </div>

        <div className="add-form-actions">
          <button type="button" className="btn" onClick={() => navigate("/sales/quotations")} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Quotation"}
          </button>
        </div>
      </div>
    </div>
  );
}
