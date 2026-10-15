import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import api from "../../api/client";
import Screen from "../../components/layout/Screen";
import { Button, Card, ErrorBox, Loader, Note, SectionTitle, TotalsBox, useFeedback } from "../../components/ui";
import { CheckboxField, DateInput, FieldLabel, Input, ItemsEditor, SearchableSelect } from "../../components/forms";
import { useAuth } from "../../context/AuthContext";
import { useGoBack, useLocation, useParams } from "../../navigation/router";
import { DEFAULT_INVOICE_NOTES, UNITS, computeRow, inr, useInvoiceLookups, usePaymentMethods } from "./invoiceFields";
import { INDIAN_STATES } from "../../utils/indianStates";
import { isIntraState } from "../../utils/gstStateCodes";
import { colors } from "../../theme";

function Field({ label, required, children, hint }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <FieldLabel label={label} required={required} />
      {children}
      {hint ? <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>{hint}</Text> : null}
    </View>
  );
}

// Port of frontend/src/pages/sales/InvoiceForm.jsx — same fields, same
// validation, same payload, including "Convert to Invoice" from a Sales
// Order (route state `fromSalesOrder`).
export default function InvoiceForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const goBack = useGoBack();
  const { toast } = useFeedback();
  const { state } = useLocation();
  const { user } = useAuth();
  const { customers, catalogItems, settings, poNumbers, refreshCustomers, createCustomer, createPoNumber } = useInvoiceLookups();
  const paymentMethods = usePaymentMethods();
  const fromSalesOrder = !isEdit && state && state.fromSalesOrder;

  const [customer, setCustomer] = useState(fromSalesOrder ? fromSalesOrder.customer || "" : "");
  const [address, setAddress] = useState(fromSalesOrder ? fromSalesOrder.address || "" : "");
  const [phone, setPhone] = useState(fromSalesOrder ? fromSalesOrder.phone || "" : "");
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [shippingSameAsBilling, setShippingSameAsBilling] = useState(true);
  const [shippingAddress, setShippingAddress] = useState("");
  const [poNumber, setPoNumber] = useState(fromSalesOrder ? fromSalesOrder.poNumber || "" : "");
  const [poDate, setPoDate] = useState(fromSalesOrder ? fromSalesOrder.poDate || "" : "");
  const [transportName, setTransportName] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [eWayBillNo, setEWayBillNo] = useState("");
  const [items, setItems] = useState(fromSalesOrder && Array.isArray(fromSalesOrder.items) ? fromSalesOrder.items.map((i) => computeRow(i)) : []);
  const [paidAmount, setPaidAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState(isEdit ? "" : DEFAULT_INVOICE_NOTES);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);
  const [loadError, setLoadError] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

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
        setTransportName(inv.transportName || "");
        setVehicleNo(inv.vehicleNo || "");
        setDeliveryDate(inv.deliveryDate || "");
        setDeliveryLocation(inv.deliveryLocation || "");
        setPaymentMode(inv.paymentMode || "");
        setPaymentReference(inv.paymentReference || "");
        setEWayBillNo(inv.eWayBillNo || "");
        setItems((inv.items || []).map((i) => computeRow(i)));
        setPaidAmount(inv.paidAmount ? String(inv.paidAmount) : "");
        setDueDate(inv.dueDate || "");
        setNotes(inv.notes || "");
        setLoaded(true);
      })
      .catch(() => setLoadError("Could not load that invoice."));
  }, [id, isEdit]);

  // "Convert to Invoice" fills the customer directly; fill Place of Supply
  // once the customer list arrives.
  useEffect(() => {
    if (!fromSalesOrder || placeOfSupply || !customers.length) return;
    const match = customers.find((c) => c.name === customer);
    if (match) setPlaceOfSupply(match.state || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers]);

  const handleCustomerChange = (name) => {
    setCustomer(name);
    const match = customers.find((c) => c.name === name);
    if (match) {
      setAddress(match.address || "");
      setPhone(match.phone || "");
      setPlaceOfSupply(match.state || "");
    }
  };

  const itemColumns = [
    {
      key: "product",
      label: "Item",
      type: "combo",
      options: catalogItems.map((p) => p.name),
      deriveFrom: { source: catalogItems, match: "name", fields: { hsnCode: "hsnCode", unit: "unit", taxPercent: "taxPercent", unitPrice: "sellingPrice" } },
    },
    { key: "hsnCode", label: "HSN/SAC" },
    { key: "quantity", label: "Qty", type: "number" },
    { key: "unit", label: "Unit", type: "combo", options: UNITS },
    { key: "unitPrice", label: "Unit Price", type: "number" },
    { key: "taxPercent", label: "Tax (%)", type: "number" },
    { key: "amount", label: "Amount", readOnly: true },
  ];

  const subTotal = items.reduce((a, i) => a + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const taxTotal = items.reduce((a, i) => a + ((i.amount || 0) - (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0)), 0);
  const grandTotal = subTotal + taxTotal;
  const balance = grandTotal - (Number(paidAmount) || 0);
  const selectedMethod = paymentMethods.find((m) => m.label === paymentMode);

  const generateNotes = async () => {
    setAiBusy(true);
    try {
      const res = await api.post("/api/ai/invoice-notes", {
        customer,
        paymentMode,
        items: items.map((i) => ({ product: i.product, quantity: i.quantity, unit: i.unit })),
      });
      if (res && res.notes) setNotes(res.notes);
    } catch (err) {
      toast(err.message || "Could not generate notes.");
    } finally {
      setAiBusy(false);
    }
  };

  const submit = async () => {
    setError("");
    if (!customer) return setError("Customer is required.");
    if (!address.trim()) return setError("Address is required.");
    if (!phone.trim()) return setError("Mobile number is required.");
    if (phone.trim().length !== 10) return setError("Mobile number must be a 10-digit number.");
    if (!placeOfSupply) return setError("Place of Supply is required — it decides CGST+SGST vs IGST.");
    if (items.length === 0) return setError("Add at least one item.");
    if (selectedMethod && selectedMethod.requiresReference && !paymentReference.trim()) {
      return setError(`${selectedMethod.referenceLabel || "A reference"} is required for ${paymentMode}.`);
    }
    if (items.some((i) => !String(i.product || "").trim() || !(Number(i.quantity) > 0))) {
      return setError("Every item needs a product and a quantity greater than 0.");
    }
    setSaving(true);
    const payload = {
      customer,
      address,
      phone,
      shippingSameAsBilling,
      shippingAddress: shippingSameAsBilling ? "" : shippingAddress,
      placeOfSupply,
      poNumber,
      poDate,
      transportName,
      vehicleNo,
      deliveryDate,
      deliveryLocation,
      paymentMode,
      paymentReference: selectedMethod && selectedMethod.requiresReference ? paymentReference : "",
      eWayBillNo,
      items,
      paidAmount: Number(paidAmount) || 0,
      dueDate,
      notes,
    };
    if (fromSalesOrder) payload.soNumber = fromSalesOrder.orderNo;
    try {
      const saved = isEdit
        ? await api.put(`/api/sales/invoices/${encodeURIComponent(id)}`, payload)
        : await api.post("/api/sales/invoices", payload);
      if (fromSalesOrder && saved && saved.id) {
        await api.put(`/api/sales/orders/${encodeURIComponent(fromSalesOrder.id)}`, { invoiceId: saved.id }).catch(() => {});
      }
      refreshCustomers();
      toast(isEdit ? "Invoice updated." : fromSalesOrder ? `Invoice created from ${fromSalesOrder.orderNo}.` : "Invoice created.");
      goBack();
    } catch (err) {
      setError(err.message || "Failed to save invoice.");
      setSaving(false);
    }
  };

  const title = isEdit ? `Edit ${id}` : fromSalesOrder ? `Invoice from ${fromSalesOrder.orderNo}` : "Add Invoice";

  if (isEdit && !loaded) {
    return <Screen title="Edit Invoice">{loadError ? <ErrorBox message={loadError} /> : <Loader />}</Screen>;
  }

  return (
    <Screen title={title}>
      <Card>
        <SectionTitle>Invoice Details</SectionTitle>
        <ErrorBox message={error} />
        <Field label="Customer" required>
          <SearchableSelect
            value={customer}
            onChange={handleCustomerChange}
            options={customers.map((c) => c.name)}
            placeholder="Select or search customer"
            title="Customer"
            onCreate={createCustomer}
            createLabel={(t) => `+ Use "${t}" as new customer`}
          />
        </Field>
        <Field label="Address" required>
          <Input value={address} onChangeText={setAddress} placeholder="Enter address" />
        </Field>
        <Field label="Mobile No." required>
          <Input value={phone} onChangeText={(v) => setPhone(v.replace(/\D/g, "").slice(0, 10))} keyboardType="number-pad" maxLength={10} placeholder="Enter mobile number" />
        </Field>
        <Field
          label="Place of Supply"
          required
          hint={
            placeOfSupply && settings?.gstin
              ? isIntraState(settings.gstin, placeOfSupply)
                ? "Same state as your business — CGST + SGST will apply."
                : "Different state — IGST will apply."
              : undefined
          }
        >
          <SearchableSelect value={placeOfSupply} onChange={setPlaceOfSupply} options={INDIAN_STATES} title="Place of Supply" placeholder="Select the state goods are supplied to" />
        </Field>
        <CheckboxField label="Shipping address same as billing address" value={shippingSameAsBilling} onChange={setShippingSameAsBilling} />
        {!shippingSameAsBilling ? (
          <Field label="Shipping Address">
            <Input value={shippingAddress} onChangeText={setShippingAddress} multiline placeholder="Enter shipping address" />
          </Field>
        ) : null}
        <Field label="PO Number">
          <SearchableSelect
            value={poNumber}
            onChange={setPoNumber}
            options={poNumbers}
            title="PO Number"
            placeholder="Select or type PO number"
            onCreate={createPoNumber}
            createLabel={(t) => `+ Use "${t}" as PO number`}
          />
        </Field>
        <Field label="PO Date">
          <DateInput value={poDate} onChange={setPoDate} />
        </Field>
        <Field label="Payment Mode">
          <SearchableSelect value={paymentMode} onChange={setPaymentMode} options={paymentMethods.map((m) => m.label)} title="Payment Mode" placeholder="Select payment mode" />
        </Field>
        {selectedMethod && selectedMethod.requiresReference ? (
          <Field label={selectedMethod.referenceLabel || "Reference"} required>
            <Input value={paymentReference} onChangeText={setPaymentReference} placeholder={`Enter the ${(selectedMethod.referenceLabel || "reference").toLowerCase()}`} />
          </Field>
        ) : null}
        <Field label="E-Way Bill No.">
          <Input value={eWayBillNo} onChangeText={setEWayBillNo} placeholder="Enter e-way bill number" />
        </Field>
        <Field label="Transport Name">
          <Input value={transportName} onChangeText={setTransportName} placeholder="Enter transporter name" />
        </Field>
        <Field label="Vehicle Number">
          <Input value={vehicleNo} onChangeText={setVehicleNo} autoCapitalize="characters" placeholder="Enter vehicle number" />
        </Field>
        <Field label="Delivery Date">
          <DateInput value={deliveryDate} onChange={setDeliveryDate} />
        </Field>
        <Field label="Delivery Location">
          <Input value={deliveryLocation} onChangeText={setDeliveryLocation} placeholder="Enter delivery location" />
        </Field>
        <Field label="Paid Amount (₹)">
          <Input value={paidAmount} onChangeText={setPaidAmount} keyboardType="decimal-pad" placeholder="Enter paid amount" />
        </Field>
        <Field label="Due Date">
          <DateInput value={dueDate} onChange={setDueDate} />
        </Field>
        <View style={{ marginBottom: 6 }}>
          <FieldLabel
            label="Notes / Terms (printed on the invoice)"
            right={user?.role === "Administrator" ? <Button small variant="ghost" icon="sparkles" title={aiBusy ? "Generating…" : "AI"} onPress={generateNotes} disabled={aiBusy} /> : null}
          />
          <Input value={notes} onChangeText={setNotes} multiline placeholder="e.g. Goods once sold will not be taken back." />
        </View>
      </Card>

      <Card>
        <SectionTitle>Items</SectionTitle>
        {fromSalesOrder ? <Note>Items copied from {fromSalesOrder.orderNo}. Review them before saving.</Note> : null}
        <ItemsEditor columns={itemColumns} rows={items} onChange={setItems} computeRow={computeRow} />
        <TotalsBox
          rows={[
            ["Sub Total", inr(subTotal)],
            ["Tax", inr(taxTotal)],
            ["Total Amount", inr(grandTotal), true],
            ["Paid Amount", inr(Number(paidAmount) || 0)],
            ["Balance Due", inr(balance), true],
          ]}
        />
      </Card>

      <ErrorBox message={error} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={goBack} disabled={saving} />
        <Button title={isEdit ? "Save Changes" : "Add Invoice"} style={{ flex: 1 }} onPress={submit} loading={saving} />
      </View>
    </Screen>
  );
}
