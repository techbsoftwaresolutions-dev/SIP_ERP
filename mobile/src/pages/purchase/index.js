import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import api from "../../api/client";
import ListScreen, { inr } from "../../components/data/ListScreen";
import DocumentActions from "../../components/data/DocumentActions";
import Screen from "../../components/layout/Screen";
import { Button, Card, ErrorBox, KeyValueGrid, Loader, MiniTable, Note, SectionTitle, StatusBadge, TotalsBox, useFeedback } from "../../components/ui";
import { DateInput, FieldLabel, Input, ItemsEditor, SearchableSelect } from "../../components/forms";
import { usePermissions } from "../../context/SessionContext";
import { useGoBack, useLocation, useNavigate, useParams } from "../../navigation/router";
import useRecord, { useList } from "../../hooks/useRecord";
import { loadDocContext, purchaseOrderHtml } from "../../print/documents";
import { colors } from "../../theme";

// Ports of pages/purchase/* — Purchase Orders, Goods Receipts, Purchase
// Invoices and Purchase Returns, with the web forms' "type a PO/GRN/invoice
// number to pull its details" lookups.

const PO_STATUSES = ["Draft", "Pending", "Sent", "Partially Received", "Received", "Completed", "Cancelled"];
const PAYMENT_TERMS = ["Immediate", "15 Days", "30 Days", "45 Days", "60 Days"];
const isReal = (v) => Boolean(v && v !== "—");
const products = (items) => (items || []).map((i) => i.product).filter(Boolean).join(", ");
const sumOf = (items, key) => (items || []).reduce((a, i) => a + (Number(i[key]) || 0), 0);

function taxRow(row) {
  const quantity = Number(row.quantity) || 0;
  const unitPrice = Number(row.unitPrice) || 0;
  const taxPercent = Number(row.taxPercent) || 0;
  return { ...row, amount: quantity * unitPrice * (1 + taxPercent / 100) };
}
function returnRow(row) {
  return { ...row, amount: (Number(row.returnQty) || 0) * (Number(row.unitPrice) || 0) };
}

function Field({ label, required, children, hint, ok }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <FieldLabel label={label} required={required} />
      {children}
      {hint ? <Text style={{ fontSize: 12, color: ok ? colors.green : colors.textMuted, marginTop: 4 }}>{hint}</Text> : null}
    </View>
  );
}

function FormShell({ title, loading, loadError, error, children, footer }) {
  if (loading) return <Screen title={title}>{loadError ? <ErrorBox message={loadError} /> : <Loader />}</Screen>;
  return (
    <Screen title={title}>
      <ErrorBox message={error} />
      {children}
      {footer}
    </Screen>
  );
}

function useEditRecord(path, isEdit) {
  const [initial, setInitial] = useState(isEdit ? null : {});
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    if (!isEdit) return;
    api.get(path).then(setInitial).catch(() => setLoadError("Could not load this record."));
  }, [path, isEdit]);
  return { initial, loadError };
}

function DeleteRecord({ endpoint, id, label }) {
  const { confirm, toast } = useFeedback();
  const goBack = useGoBack();
  return (
    <Button
      small
      variant="secondary"
      icon="trash"
      title="Delete"
      onPress={async () => {
        if (!(await confirm({ title: "Delete", message: `Delete ${label}? This cannot be undone.`, confirmLabel: "Delete", danger: true }))) return;
        try {
          await api.delete(`${endpoint}/${encodeURIComponent(id)}`);
          toast(`${label} deleted.`);
          goBack();
        } catch (err) {
          toast(err.message || "Failed to delete.");
        }
      }}
    />
  );
}

// ================================================================ Purchase orders

export function PurchaseOrders() {
  const suppliers = useList("/api/suppliers?page=1&pageSize=200");
  return (
    <ListScreen
      title="Purchase Orders"
      endpoint="/api/purchase-orders"
      addPath="/purchase/orders/new"
      editPath={(r) => `/purchase/orders/${encodeURIComponent(r.id)}/edit`}
      detailPath={(r) => `/purchase/orders/${encodeURIComponent(r.id)}`}
      filters={[
        { key: "supplier", label: "Supplier", options: suppliers.map((s) => s.name) },
        { key: "status", label: "Status", options: PO_STATUSES },
        { key: "paymentTerms", label: "Payment Terms", options: PAYMENT_TERMS },
        { key: "dateFrom", label: "From date", type: "date" },
        { key: "dateTo", label: "To date", type: "date" },
      ]}
      card={(r) => ({
        title: r.supplier,
        subtitle: [r.id, r.orderDate].filter(Boolean).join(" · "),
        amount: inr(r.amount),
        meta: [
          { icon: "package", text: products(r.items) },
          { icon: "calendar", label: "Delivery", text: r.expectedDate },
          { label: "Terms", text: r.paymentTerms },
        ],
        badges: [r.grnStatus || "Not Received"],
        status: r.status,
        icon: "cart",
      })}
    />
  );
}

export function PurchaseOrderForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const goBack = useGoBack();
  const { toast } = useFeedback();
  const suppliers = useList("/api/suppliers?page=1&pageSize=200");
  const catalogItems = useList("/api/items?page=1&pageSize=500");
  const { initial, loadError } = useEditRecord(`/api/purchase-orders/${encodeURIComponent(id || "")}`, isEdit);

  const [ready, setReady] = useState(!isEdit);
  const [poNo, setPoNo] = useState("");
  const [supplier, setSupplier] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("30 Days");
  const [status, setStatus] = useState("Draft");
  const [items, setItems] = useState([]);
  const [lookup, setLookup] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");

  useEffect(() => {
    if (!isEdit) {
      setPoNo("Fetching…");
      api.get("/api/purchase-orders/next-number").then((r) => setPoNo(r.number || "")).catch(() => setPoNo(""));
    }
  }, [isEdit]);

  useEffect(() => {
    if (isEdit && initial) {
      setSupplier(initial.supplier || "");
      setExpectedDate(initial.expectedDate || "");
      setPaymentTerms(initial.paymentTerms || "30 Days");
      setStatus(initial.status || "Draft");
      setItems((initial.items || []).map(taxRow));
      setReady(true);
    }
  }, [isEdit, initial]);

  // Typing an existing PO number pulls that order in (as on the web).
  const fetchPo = async (number) => {
    const t = (number || "").trim();
    if (!t) return setLookup("");
    try {
      const po = await api.get(`/api/purchase-orders/${encodeURIComponent(t)}`);
      setSupplier(po.supplier || "");
      setExpectedDate(po.expectedDate || "");
      setPaymentTerms(po.paymentTerms || "30 Days");
      setItems((po.items || []).map(taxRow));
      setLookup("found");
    } catch (_) {
      setLookup("");
    }
  };

  const columns = [
    {
      key: "product",
      label: "Item",
      type: "combo",
      options: catalogItems.map((p) => p.name),
      deriveFrom: { source: catalogItems, match: "name", fields: { hsnCode: "hsnCode", unit: "unit", taxPercent: "taxPercent", unitPrice: "purchasePrice" } },
    },
    { key: "hsnCode", label: "HSN/SAC" },
    { key: "quantity", label: "Qty", type: "number" },
    { key: "unit", label: "Unit", type: "combo", options: ["Nos", "Kg", "Litre", "Box", "Set", "Roll", "Sheet"] },
    { key: "unitPrice", label: "Unit Price", type: "number" },
    { key: "taxPercent", label: "Tax (%)", type: "number" },
    { key: "amount", label: "Amount", readOnly: true },
  ];

  const subTotal = items.reduce((a, i) => a + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const grandTotal = items.reduce((a, i) => a + (i.amount || 0), 0);

  const submit = async (flag) => {
    setError("");
    if (!supplier) return setError("Supplier is required.");
    if (items.length === 0) return setError("Add at least one item.");
    setSaving(flag || "save");
    try {
      if (isEdit) {
        await api.put(`/api/purchase-orders/${encodeURIComponent(id)}`, { supplier, expectedDate, paymentTerms, items, status });
        toast("Purchase order updated.");
      } else {
        await api.post("/api/purchase-orders", { supplier, expectedDate, paymentTerms, items, status: flag });
        toast("Purchase order saved.");
      }
      goBack();
    } catch (err) {
      setError(err.message || "Failed to save purchase order.");
      setSaving("");
    }
  };

  return (
    <FormShell
      title={isEdit ? `Edit ${id}` : "Add Purchase Order"}
      loading={!ready}
      loadError={loadError}
      error={error}
      footer={
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={goBack} />
          {isEdit ? (
            <Button title="Save Changes" style={{ flex: 1 }} loading={!!saving} onPress={() => submit()} />
          ) : (
            <>
              <Button title="Save Draft" variant="secondary" style={{ flex: 1 }} loading={saving === "Draft"} onPress={() => submit("Draft")} />
              <Button title="Submit" style={{ flex: 1 }} loading={saving === "Submit"} onPress={() => submit("Submit")} />
            </>
          )}
        </View>
      }
    >
      <Card>
        <SectionTitle>Order Details</SectionTitle>
        <Field label="Purchase Order No" hint={lookup === "found" ? "Existing order found — details loaded below." : undefined} ok>
          {isEdit ? (
            <Input value={id} readOnly />
          ) : (
            <Input value={poNo} onChangeText={(v) => { setPoNo(v); setLookup(""); }} onBlur={() => fetchPo(poNo)} placeholder="Type a PO number to fetch its details" autoCapitalize="characters" />
          )}
        </Field>
        <Field label="Supplier" required>
          <SearchableSelect value={supplier} onChange={setSupplier} options={suppliers.map((s) => s.name)} title="Supplier" placeholder="Select or search supplier" />
        </Field>
        <Field label="Delivery">
          <DateInput value={expectedDate} onChange={setExpectedDate} />
        </Field>
        <Field label="Payment Terms">
          <SearchableSelect value={paymentTerms} onChange={setPaymentTerms} options={PAYMENT_TERMS} title="Payment Terms" />
        </Field>
        {isEdit ? (
          <Field label="Status">
            <SearchableSelect value={status} onChange={setStatus} options={PO_STATUSES} title="Status" />
          </Field>
        ) : null}
      </Card>
      <Card>
        <SectionTitle>Items</SectionTitle>
        <ItemsEditor columns={columns} rows={items} onChange={setItems} computeRow={taxRow} />
        <TotalsBox rows={[["Sub Total", inr(subTotal)], ["Tax", inr(grandTotal - subTotal)], ["Total", inr(grandTotal), true]]} />
      </Card>
    </FormShell>
  );
}

export function PurchaseOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { data: po, error, refreshing, reload } = useRecord(`/api/purchase-orders/${encodeURIComponent(id)}`);
  const [settings, setSettings] = useState(null);
  useEffect(() => {
    api.get("/api/settings").then(setSettings).catch(() => {});
  }, []);
  if (error) return <Screen title="Purchase Order"><ErrorBox message={error} /></Screen>;
  if (!po) return <Screen title="Purchase Order"><Loader /></Screen>;
  const items = po.items || [];
  const subTotal = items.reduce((a, i) => a + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const build = async () => {
    const { settings: s, party } = await loadDocContext("/api/suppliers", po.supplier);
    return purchaseOrderHtml({ po, supplier: party, settings: s });
  };
  return (
    <Screen
      title={po.id}
      refreshing={refreshing}
      onRefresh={reload}
      headerRight={can("purchase", "edit") ? [{ icon: "edit", onPress: () => navigate(`/purchase/orders/${encodeURIComponent(po.id)}/edit`) }] : undefined}
    >
      <Card>
        <View style={{ gap: 8, marginBottom: 12 }}>
          <DocumentActions build={build} filename={`purchase-order-${po.id}.pdf`} settings={settings} whatsapp={{ documentType: "purchase-order", documentId: po.id, partyName: po.supplier, amount: po.amount }} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            {can("purchase", "create") ? <Button small variant="secondary" icon="download" title="Record GRN" onPress={() => navigate("/purchase/goods-receipt/new", { state: { poNumber: po.id } })} /> : null}
            {can("purchase", "delete") ? <DeleteRecord endpoint="/api/purchase-orders" id={po.id} label={`Purchase order ${po.id}`} /> : null}
          </View>
        </View>
        <KeyValueGrid
          rows={[
            ["Supplier", po.supplier],
            ["Purchase Order Date", po.orderDate],
            ["Delivery", po.expectedDate],
            ["Payment Terms", po.paymentTerms],
            ["Status", <StatusBadge status={po.status} />],
            ["GRN Status", <StatusBadge status={po.grnStatus || "Not Received"} />],
          ]}
        />
      </Card>
      <Card>
        <SectionTitle>Items</SectionTitle>
        <MiniTable
          rows={items}
          columns={[
            { key: "product", label: "Item" },
            { key: "hsnCode", label: "HSN/SAC", render: (r) => r.hsnCode || "—" },
            { key: "quantity", label: "Qty", render: (r) => `${r.quantity || 0} ${r.unit || ""}` },
            { key: "unitPrice", label: "Unit Price", render: (r) => inr(r.unitPrice) },
            { key: "taxPercent", label: "Tax", render: (r) => `${r.taxPercent || 0}%` },
            { key: "amount", label: "Amount", render: (r) => inr(r.amount) },
          ]}
        />
        <TotalsBox rows={[["Sub Total", inr(subTotal)], ["Tax", inr((po.amount || 0) - subTotal)], ["Total", inr(po.amount), true]]} />
      </Card>
    </Screen>
  );
}

// ================================================================ Goods receipts

export function GoodsReceipts() {
  return (
    <ListScreen
      title="Goods Receipt"
      endpoint="/api/purchase/goods-receipts"
      addPath="/purchase/goods-receipt/new"
      editPath={(r) => `/purchase/goods-receipt/${encodeURIComponent(r.id)}/edit`}
      detailPath={(r) => `/purchase/goods-receipt/${encodeURIComponent(r.id)}`}
      card={(r) => ({
        title: r.supplier,
        subtitle: [r.id, r.date, isReal(r.poNumber) ? r.poNumber : ""].filter(Boolean).join(" · "),
        meta: [
          { icon: "package", text: products(r.items) },
          { label: "Ordered", text: sumOf(r.items, "poQty") },
          { label: "Received", text: sumOf(r.items, "receivedQty") },
          { label: "Rejected", text: sumOf(r.items, "rejectedQty") },
          { label: "Inspection", text: r.inspection },
        ],
        status: r.status,
        icon: "download",
      })}
    />
  );
}

const genInvoiceNo = () => `INV-${String(Math.floor(100000 + Math.random() * 900000))}`;
const todayISO = () => new Date().toISOString().slice(0, 10);

export function GoodsReceiptForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const goBack = useGoBack();
  const { toast } = useFeedback();
  const { state } = useLocation();
  const suppliers = useList("/api/suppliers?page=1&pageSize=200");
  const catalogItems = useList("/api/items?page=1&pageSize=500");
  const purchaseOrders = useList("/api/purchase-orders?page=1&pageSize=200");
  const receipts = useList("/api/purchase/goods-receipts?page=1&pageSize=500");
  const { initial, loadError } = useEditRecord(`/api/purchase/goods-receipts/${encodeURIComponent(id || "")}`, isEdit);

  const [ready, setReady] = useState(!isEdit);
  const [supplier, setSupplier] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [invoiceNo, setInvoiceNo] = useState(genInvoiceNo());
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [inspection, setInspection] = useState("Pending");
  const [status, setStatus] = useState("Pending");
  const [items, setItems] = useState([]);
  const [lookup, setLookup] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit && initial) {
      setSupplier(initial.supplier || "");
      setPoNumber(isReal(initial.poNumber) ? initial.poNumber : "");
      setInvoiceNo(initial.invoiceNo || "");
      setInvoiceDate(initial.invoiceDate || "");
      setInspection(initial.inspection || "Pending");
      setStatus(initial.status || "Pending");
      setItems(initial.items || []);
      setReady(true);
    }
  }, [isEdit, initial]);

  const fetchPo = async (number) => {
    const t = (number || "").trim();
    if (!t) return setLookup("");
    try {
      const po = await api.get(`/api/purchase-orders/${encodeURIComponent(t)}`);
      setSupplier(po.supplier || "");
      setItems((po.items || []).map((i) => ({ product: i.product || "", poQty: i.quantity || 0, receivedQty: 0, rejectedQty: 0, unit: i.unit || "Nos" })));
      setLookup("found");
    } catch (_) {
      setLookup("not-found");
    }
  };

  // "Record GRN" from a PO detail screen arrives with that PO number.
  useEffect(() => {
    if (!isEdit && state && state.poNumber) {
      setPoNumber(state.poNumber);
      fetchPo(state.poNumber);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const usedPo = receipts.map((g) => g.poNumber).filter(Boolean);
  const poOptions = purchaseOrders.filter((po) => !supplier || po.supplier === supplier).filter((po) => po.id === poNumber || !usedPo.includes(po.id));

  const submit = async () => {
    setError("");
    if (!supplier) return setError("Supplier is required.");
    if (items.length === 0) return setError("Add at least one item.");
    setSaving(true);
    try {
      const payload = { supplier, poNumber, invoiceNo, invoiceDate, inspection, items, status: isEdit ? status : undefined };
      if (isEdit) await api.put(`/api/purchase/goods-receipts/${encodeURIComponent(id)}`, payload);
      else await api.post("/api/purchase/goods-receipts", payload);
      toast(isEdit ? "Goods receipt updated." : "Goods receipt recorded.");
      goBack();
    } catch (err) {
      setError(err.message || "Failed to save goods receipt.");
      setSaving(false);
    }
  };

  const columns = [
    { key: "product", label: "Item", type: "select", options: catalogItems.map((p) => p.name) },
    { key: "poQty", label: "PO Qty", type: "number" },
    { key: "receivedQty", label: "Received Qty", type: "number" },
    { key: "rejectedQty", label: "Rejected Qty", type: "number" },
    { key: "unit", label: "Unit", type: "select", options: ["Pcs", "Box", "Kg", "Litre", "Set", "Nos", "Roll", "Sheet"] },
  ];

  return (
    <FormShell
      title={isEdit ? `Edit ${id}` : "Add Goods Receipt"}
      loading={!ready}
      loadError={loadError}
      error={error}
      footer={
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={goBack} />
          <Button title={isEdit ? "Save Changes" : "Save Receipt"} style={{ flex: 1 }} loading={saving} onPress={submit} />
        </View>
      }
    >
      <Card>
        <SectionTitle>Receipt Details</SectionTitle>
        <Field label="Supplier" required>
          <SearchableSelect value={supplier} onChange={setSupplier} options={suppliers.map((s) => s.name)} title="Supplier" placeholder="Select or search supplier" />
        </Field>
        <Field label="Purchase Order No" hint={lookup === "found" ? "Existing order found — supplier & items loaded below." : undefined} ok>
          <SearchableSelect
            value={poNumber}
            onChange={(v) => {
              setPoNumber(v);
              fetchPo(v);
            }}
            options={poOptions.map((po) => po.id)}
            title="Purchase Order"
            placeholder={supplier ? "Select PO number" : "Select supplier, or search any PO"}
            allowClear
          />
        </Field>
        <Field label="Invoice No">
          <Input value={invoiceNo} onChangeText={setInvoiceNo} placeholder="Enter supplier invoice no" />
        </Field>
        <Field label="Invoice Date">
          <DateInput value={invoiceDate} onChange={setInvoiceDate} />
        </Field>
        <Field label="Inspection">
          <SearchableSelect value={inspection} onChange={setInspection} options={["Pending", "Passed", "Partial", "Failed"]} title="Inspection" />
        </Field>
        {isEdit ? (
          <Field label="Status">
            <SearchableSelect value={status} onChange={setStatus} options={["Pending", "Received", "Partially Accepted", "Completed", "Inspection Pending", "Rejected"]} title="Status" />
          </Field>
        ) : null}
      </Card>
      <Card>
        <SectionTitle>Items</SectionTitle>
        <ItemsEditor columns={columns} rows={items} onChange={setItems} />
      </Card>
    </FormShell>
  );
}

export function GoodsReceiptDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { data: gr, error, refreshing, reload } = useRecord(`/api/purchase/goods-receipts/${encodeURIComponent(id)}`);
  if (error) return <Screen title="Goods Receipt"><ErrorBox message={error} /></Screen>;
  if (!gr) return <Screen title="Goods Receipt"><Loader /></Screen>;
  return (
    <Screen
      title={gr.id}
      refreshing={refreshing}
      onRefresh={reload}
      headerRight={can("purchase", "edit") ? [{ icon: "edit", onPress: () => navigate(`/purchase/goods-receipt/${encodeURIComponent(gr.id)}/edit`) }] : undefined}
    >
      <Card>
        {can("purchase", "delete") ? (
          <View style={{ flexDirection: "row", marginBottom: 12 }}>
            <DeleteRecord endpoint="/api/purchase/goods-receipts" id={gr.id} label={`Goods receipt ${gr.id}`} />
          </View>
        ) : null}
        <KeyValueGrid
          rows={[
            ["GRN Number", gr.id],
            ["GRN Date", gr.date],
            ["Purchase Order No", isReal(gr.poNumber) ? gr.poNumber : "—"],
            ["Supplier", gr.supplier],
            ["Invoice No", gr.invoiceNo],
            ["Invoice Date", gr.invoiceDate],
            ["Warehouse", gr.warehouse],
            ["Inspection", gr.inspection],
            ["Status", <StatusBadge status={gr.status} />],
          ]}
        />
        {isReal(gr.poNumber) ? (
          <Button small variant="ghost" title={`Open ${gr.poNumber} ›`} onPress={() => navigate(`/purchase/orders/${encodeURIComponent(gr.poNumber)}`)} style={{ alignSelf: "flex-start", marginTop: 8 }} />
        ) : null}
      </Card>
      <Card>
        <SectionTitle>Items</SectionTitle>
        <MiniTable
          rows={gr.items || []}
          columns={[
            { key: "product", label: "Item" },
            { key: "poQty", label: "PO Qty", render: (r) => Number(r.poQty) || 0 },
            { key: "receivedQty", label: "Received", render: (r) => Number(r.receivedQty) || 0 },
            { key: "rejectedQty", label: "Rejected", render: (r) => Number(r.rejectedQty) || 0 },
            { key: "accepted", label: "Accepted", render: (r) => Math.max((Number(r.receivedQty) || 0) - (Number(r.rejectedQty) || 0), 0) },
            { key: "unit", label: "Unit", render: (r) => r.unit || "—" },
          ]}
        />
      </Card>
    </Screen>
  );
}

// ================================================================ Purchase invoices

export function PurchaseInvoices() {
  return (
    <ListScreen
      title="Purchase Invoice"
      endpoint="/api/purchase/invoices"
      addPath="/purchase/invoices/new"
      editPath={(r) => `/purchase/invoices/${encodeURIComponent(r.id)}/edit`}
      tabs={{ field: "status", options: [{ label: "All", value: undefined }, ...["Unpaid", "Partially Paid", "Paid", "Overdue"].map((s) => ({ label: s, value: s }))] }}
      card={(r) => ({
        title: r.supplier,
        subtitle: [r.id, r.date].filter(Boolean).join(" · "),
        amount: inr(r.amount),
        meta: [
          { label: "Paid", text: inr(r.paidAmount) },
          { label: "Balance", text: inr((r.amount || 0) - (r.paidAmount || 0)) },
          { icon: "calendar", label: "Due", text: r.dueDate },
          { label: "PO", text: isReal(r.poNumber) ? r.poNumber : "" },
          { label: "GRN", text: isReal(r.grNumber) ? r.grNumber : "" },
        ],
        status: r.status,
        icon: "banknote",
      })}
    />
  );
}

export function PurchaseInvoiceForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const goBack = useGoBack();
  const { toast } = useFeedback();
  const catalogItems = useList("/api/items?page=1&pageSize=500");
  const suppliers = useList("/api/suppliers?page=1&pageSize=200");
  const { initial, loadError } = useEditRecord(`/api/purchase/invoices/${encodeURIComponent(id || "")}`, isEdit);

  const [ready, setReady] = useState(!isEdit);
  const [supplier, setSupplier] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [grNumber, setGrNumber] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [status, setStatus] = useState("Unpaid");
  const [items, setItems] = useState([]);
  const [hint, setHint] = useState({ po: "", gr: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit && initial) {
      setSupplier(initial.supplier || "");
      setPoNumber(isReal(initial.poNumber) ? initial.poNumber : "");
      setGrNumber(isReal(initial.grNumber) ? initial.grNumber : "");
      setDueDate(initial.dueDate || "");
      setPaidAmount(initial.paidAmount ? String(initial.paidAmount) : "");
      setStatus(initial.status || "Unpaid");
      setItems((initial.items || []).map(taxRow));
      setReady(true);
    }
  }, [isEdit, initial]);

  const linesFromPo = (po) => (po.items || []).map((i) => taxRow({ product: i.product || "", quantity: i.quantity || 0, unitPrice: i.unitPrice || 0, taxPercent: i.taxPercent || 0 }));
  const linesFromReceipt = (gr, po) => {
    const price = new Map(((po && po.items) || []).map((i) => [i.product, i]));
    return (gr.items || []).map((i) => {
      const p = price.get(i.product) || {};
      const accepted = (Number(i.receivedQty) || 0) - (Number(i.rejectedQty) || 0);
      return taxRow({ product: i.product || "", quantity: accepted > 0 ? accepted : Number(i.receivedQty) || Number(i.poQty) || 0, unitPrice: p.unitPrice || 0, taxPercent: p.taxPercent || 0 });
    });
  };

  const fetchPo = async (number) => {
    const t = (number || "").trim();
    if (!t) return;
    setHint((h) => ({ ...h, po: "Fetching…" }));
    try {
      const po = await api.get(`/api/purchase-orders/${encodeURIComponent(t)}`);
      setSupplier(po.supplier || "");
      let lines = linesFromPo(po);
      const list = await api.get("/api/purchase/goods-receipts?page=1&pageSize=500").catch(() => null);
      const gr = ((list && list.data) || []).find((g) => g.poNumber === po.id);
      if (gr) {
        setGrNumber(gr.id);
        lines = linesFromReceipt(gr, po);
      }
      setItems(lines);
      setHint({ po: "Order found — supplier and items loaded.", gr: gr ? "Linked receipt found." : "" });
    } catch (_) {
      setHint((h) => ({ ...h, po: "No purchase order with that number — fill in items manually." }));
    }
  };

  const fetchGr = async (number) => {
    const t = (number || "").trim();
    if (!t) return;
    setHint((h) => ({ ...h, gr: "Fetching…" }));
    try {
      const gr = await api.get(`/api/purchase/goods-receipts/${encodeURIComponent(t)}`);
      setSupplier(gr.supplier || "");
      let po = null;
      if (isReal(gr.poNumber)) {
        setPoNumber(gr.poNumber);
        po = await api.get(`/api/purchase-orders/${encodeURIComponent(gr.poNumber)}`).catch(() => null);
      }
      setItems(linesFromReceipt(gr, po));
      setHint({ gr: "Receipt found — accepted quantities loaded.", po: po ? "Linked order found." : "" });
    } catch (_) {
      setHint((h) => ({ ...h, gr: "No goods receipt with that number — fill in items manually." }));
    }
  };

  const subTotal = items.reduce((a, i) => a + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const grandTotal = items.reduce((a, i) => a + (i.amount || 0), 0);

  const submit = async () => {
    setError("");
    if (!supplier) return setError("Supplier is required.");
    if (items.length === 0) return setError("Add at least one item.");
    setSaving(true);
    try {
      const payload = { supplier, poNumber, grNumber, dueDate, paidAmount: Number(paidAmount) || 0, items, status: isEdit ? status : undefined };
      if (isEdit) await api.put(`/api/purchase/invoices/${encodeURIComponent(id)}`, payload);
      else await api.post("/api/purchase/invoices", payload);
      toast(isEdit ? "Purchase invoice updated." : "Purchase invoice recorded.");
      goBack();
    } catch (err) {
      setError(err.message || "Failed to save purchase invoice.");
      setSaving(false);
    }
  };

  return (
    <FormShell
      title={isEdit ? `Edit ${id}` : "Add Purchase Invoice"}
      loading={!ready}
      loadError={loadError}
      error={error}
      footer={
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={goBack} />
          <Button title={isEdit ? "Save Changes" : "Save Invoice"} style={{ flex: 1 }} loading={saving} onPress={submit} />
        </View>
      }
    >
      <Card>
        <SectionTitle>Invoice Details</SectionTitle>
        <Field label="Supplier" required>
          <SearchableSelect value={supplier} onChange={setSupplier} options={suppliers.map((s) => s.name)} title="Supplier" placeholder="Select or search supplier" />
        </Field>
        <Field label="Purchase Order No" hint={hint.po}>
          <Input value={poNumber} onChangeText={setPoNumber} onBlur={() => fetchPo(poNumber)} placeholder="Type a PO number to fetch its details" autoCapitalize="characters" />
        </Field>
        <Field label="GRN Number" hint={hint.gr}>
          <Input value={grNumber} onChangeText={setGrNumber} onBlur={() => fetchGr(grNumber)} placeholder="Type a GRN number to fetch its details" autoCapitalize="characters" />
        </Field>
        <Field label="Due Date">
          <DateInput value={dueDate} onChange={setDueDate} />
        </Field>
        <Field label="Paid Amount (₹)">
          <Input value={paidAmount} onChangeText={setPaidAmount} keyboardType="decimal-pad" placeholder="Enter your paid amount" />
        </Field>
        {isEdit ? (
          <Field label="Status">
            <SearchableSelect value={status} onChange={setStatus} options={["Unpaid", "Paid", "Partially Paid", "Overdue"]} title="Status" />
          </Field>
        ) : null}
      </Card>
      <Card>
        <SectionTitle>Items</SectionTitle>
        <ItemsEditor
          columns={[
            { key: "product", label: "Item", type: "select", options: catalogItems.map((p) => p.name) },
            { key: "quantity", label: "Qty", type: "number" },
            { key: "unitPrice", label: "Unit Price", type: "number" },
            { key: "taxPercent", label: "Tax (%)", type: "number" },
            { key: "amount", label: "Amount", readOnly: true },
          ]}
          rows={items}
          onChange={setItems}
          computeRow={taxRow}
        />
        <TotalsBox
          rows={[
            ["Sub Total", inr(subTotal)],
            ["Tax", inr(grandTotal - subTotal)],
            ["Total", inr(grandTotal), true],
            ["Paid", inr(Number(paidAmount) || 0)],
            ["Balance", inr(grandTotal - (Number(paidAmount) || 0)), true],
          ]}
        />
      </Card>
    </FormShell>
  );
}

// ================================================================ Purchase returns

export function PurchaseReturns() {
  return (
    <ListScreen
      title="Purchase Return"
      endpoint="/api/purchase/returns"
      addPath="/purchase/returns/new"
      editPath={(r) => `/purchase/returns/${encodeURIComponent(r.id)}/edit`}
      card={(r) => ({
        title: r.supplier,
        subtitle: [r.id, r.date].filter(Boolean).join(" · "),
        amount: inr(r.amount),
        meta: [
          { icon: "package", text: products(r.items) },
          { label: "Qty", text: sumOf(r.items, "returnQty") },
          { label: "Reason", text: r.reason },
          { label: "Credit note", text: r.creditNote || "Pending" },
        ],
        status: r.status,
        icon: "arrowLeft",
      })}
    />
  );
}

export function PurchaseReturnForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const goBack = useGoBack();
  const { toast } = useFeedback();
  const catalogItems = useList("/api/items?page=1&pageSize=500");
  const suppliers = useList("/api/suppliers?page=1&pageSize=200");
  const { initial, loadError } = useEditRecord(`/api/purchase/returns/${encodeURIComponent(id || "")}`, isEdit);

  const [ready, setReady] = useState(!isEdit);
  const [supplier, setSupplier] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [grNumber, setGrNumber] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [reason, setReason] = useState("Damaged");
  const [creditNote, setCreditNote] = useState("");
  const [status, setStatus] = useState("Pending");
  const [items, setItems] = useState([]);
  const [hint, setHint] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit && initial) {
      setSupplier(initial.supplier || "");
      setPoNumber(isReal(initial.poNumber) ? initial.poNumber : "");
      setGrNumber(isReal(initial.grNumber) ? initial.grNumber : "");
      setInvoiceNumber(isReal(initial.invoiceNumber) ? initial.invoiceNumber : "");
      setReason(initial.reason || "Damaged");
      setCreditNote(initial.creditNote && initial.creditNote !== "Pending" ? initial.creditNote : "");
      setStatus(initial.status || "Pending");
      setItems((initial.items || []).map(returnRow));
      setReady(true);
    }
  }, [isEdit, initial]);

  const getJson = (path) => api.get(path).catch(() => null);
  const findIn = async (path, pred) => {
    const list = await getJson(`${path}?page=1&pageSize=500`);
    return ((list && list.data) || []).find(pred) || null;
  };
  const buildLines = ({ po, gr, inv }) => {
    if (inv && (inv.items || []).length) {
      return inv.items.map((i) => returnRow({ product: i.product, invoicedQty: i.quantity, returnQty: 0, unitPrice: i.unitPrice, unit: i.unit || "Pcs" }));
    }
    if (gr && (gr.items || []).length) {
      const prices = new Map(((po && po.items) || []).map((i) => [i.product, i]));
      return gr.items.map((i) => {
        const accepted = (Number(i.receivedQty) || 0) - (Number(i.rejectedQty) || 0);
        return returnRow({ product: i.product, invoicedQty: accepted > 0 ? accepted : Number(i.receivedQty) || Number(i.poQty) || 0, returnQty: 0, unitPrice: (prices.get(i.product) || {}).unitPrice || 0, unit: i.unit || "Pcs" });
      });
    }
    return ((po && po.items) || []).map((i) => returnRow({ product: i.product, invoicedQty: i.quantity, returnQty: 0, unitPrice: i.unitPrice, unit: i.unit || "Pcs" }));
  };

  // Same three-way lookup as the web PurchaseReturnForm.
  const fetchDetails = async (kind, number) => {
    const t = (number || "").trim();
    if (!t) return;
    setHint("Fetching…");
    try {
      let po = null;
      let gr = null;
      let inv = null;
      if (kind === "po") {
        po = await api.get(`/api/purchase-orders/${encodeURIComponent(t)}`);
        gr = await findIn("/api/purchase/goods-receipts", (g) => g.poNumber === po.id);
        inv = await findIn("/api/purchase/invoices", (v) => v.poNumber === po.id || (gr && v.grNumber === gr.id));
      } else if (kind === "gr") {
        gr = await api.get(`/api/purchase/goods-receipts/${encodeURIComponent(t)}`);
        if (isReal(gr.poNumber)) po = await getJson(`/api/purchase-orders/${encodeURIComponent(gr.poNumber)}`);
        inv = await findIn("/api/purchase/invoices", (v) => v.grNumber === gr.id);
      } else {
        inv = await findIn("/api/purchase/invoices", (v) => v.id === t);
        if (!inv) throw new Error("not found");
        if (isReal(inv.poNumber)) po = await getJson(`/api/purchase-orders/${encodeURIComponent(inv.poNumber)}`);
        if (isReal(inv.grNumber)) gr = await getJson(`/api/purchase/goods-receipts/${encodeURIComponent(inv.grNumber)}`);
      }
      setSupplier((po && po.supplier) || (gr && gr.supplier) || (inv && inv.supplier) || "");
      if (po) setPoNumber(po.id);
      if (gr) setGrNumber(gr.id);
      if (inv) setInvoiceNumber(inv.id);
      setItems(buildLines({ po, gr, inv }));
      setHint("Found — supplier, numbers and items loaded below. Enter the Return Qty.");
    } catch (_) {
      setHint("Nothing found with that number — fill in items manually.");
    }
  };

  const total = items.reduce((a, i) => a + (i.amount || 0), 0);

  const submit = async () => {
    setError("");
    if (!supplier) return setError("Supplier is required.");
    if (items.length === 0) return setError("Add at least one item.");
    if (!items.some((i) => (Number(i.returnQty) || 0) > 0)) return setError("At least one item needs a Return Qty greater than 0.");
    setSaving(true);
    try {
      const payload = { supplier, poNumber, grNumber, invoiceNumber, reason, creditNote, items };
      if (isEdit) await api.put(`/api/purchase/returns/${encodeURIComponent(id)}`, { ...payload, status });
      else await api.post("/api/purchase/returns", payload);
      toast(isEdit ? "Purchase return updated." : "Purchase return recorded — stock updated.");
      goBack();
    } catch (err) {
      setError(err.message || "Failed to save purchase return.");
      setSaving(false);
    }
  };

  return (
    <FormShell
      title={isEdit ? `Edit ${id}` : "Add Purchase Return"}
      loading={!ready}
      loadError={loadError}
      error={error}
      footer={
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={goBack} />
          <Button title={isEdit ? "Save Changes" : "Save Return"} style={{ flex: 1 }} loading={saving} onPress={submit} />
        </View>
      }
    >
      <Card>
        <SectionTitle>Return Details</SectionTitle>
        {hint ? <Note>{hint}</Note> : null}
        <Field label="Supplier" required>
          <SearchableSelect value={supplier} onChange={setSupplier} options={suppliers.map((s) => s.name)} title="Supplier" placeholder="Select or search supplier" />
        </Field>
        <Field label="Purchase Order No">
          <Input value={poNumber} onChangeText={setPoNumber} onBlur={() => fetchDetails("po", poNumber)} placeholder="Type a PO number" autoCapitalize="characters" />
        </Field>
        <Field label="GRN No.">
          <Input value={grNumber} onChangeText={setGrNumber} onBlur={() => fetchDetails("gr", grNumber)} placeholder="Type a GRN number" autoCapitalize="characters" />
        </Field>
        <Field label="Invoice No.">
          <Input value={invoiceNumber} onChangeText={setInvoiceNumber} onBlur={() => fetchDetails("inv", invoiceNumber)} placeholder="Type a purchase invoice number" autoCapitalize="characters" />
        </Field>
        <Field label="Reason">
          <SearchableSelect value={reason} onChange={setReason} options={["Damaged", "Quality Issue", "Wrong Specification", "Excess Quantity", "Other"]} title="Reason" />
        </Field>
        <Field label="Credit Note">
          <Input value={creditNote} onChangeText={setCreditNote} placeholder="Credit note number (if issued)" />
        </Field>
        {isEdit ? (
          <Field label="Status">
            <SearchableSelect value={status} onChange={setStatus} options={["Pending", "Approved", "Completed", "Rejected"]} title="Status" />
          </Field>
        ) : null}
      </Card>
      <Card>
        <SectionTitle>Items</SectionTitle>
        <ItemsEditor
          columns={[
            { key: "product", label: "Item", type: "select", options: catalogItems.map((p) => p.name) },
            { key: "invoicedQty", label: "Invoiced Qty", type: "number" },
            { key: "returnQty", label: "Return Qty", type: "number" },
            { key: "unitPrice", label: "Unit Price", type: "number" },
            { key: "unit", label: "Unit", type: "select", options: ["Pcs", "Box", "Kg", "Litre", "Set"] },
            { key: "amount", label: "Amount", readOnly: true },
          ]}
          rows={items}
          onChange={setItems}
          computeRow={returnRow}
        />
        <TotalsBox rows={[["Return Value", inr(total), true]]} />
      </Card>
    </FormShell>
  );
}
